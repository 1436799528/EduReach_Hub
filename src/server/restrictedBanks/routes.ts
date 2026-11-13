/**
 * Bank security administration: classification, candidate assignment,
 * correction release and the audit trail for restricted question banks.
 *
 * Authorization has two independent layers, and both must agree:
 *   1. this file requires the `cbt.read` / `cbt.manage` capability, resolved
 *      from the caller's bearer token and trusted profile row;
 *   2. every write calls a database function that re-checks
 *      `cbt_bank_is_manager()` against `auth.uid()`, so the RPC is executed with
 *      the caller's own token - never the service-role key. A request that
 *      somehow reached this module without the capability still cannot change
 *      policy.
 *
 * Reads of policy data use the same caller-scoped client, so a missing grant or
 * a revoked session fails closed rather than falling back to the service role.
 */

import type { Express, Request, Response } from 'express';
import type { Capability } from '../../lib/capabilities';

type RpcResult = { data?: unknown; error?: { message?: string; code?: string } | null };
type ScopedClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
  from: (table: string) => any;
};
type SupabaseError = { message?: string; code?: string } | null | undefined;

export interface RestrictedBankDeps {
  requireCapability: (...capabilities: Capability[]) => (req: Request, res: Response, next: () => void) => any;
  /** Caller-scoped client (publishable key + the caller's access token). */
  getUserScoped: (accessToken: string) => ScopedClient | null;
  getSupabase: () => ScopedClient;
  recordAudit: (
    supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error?: unknown }> },
    entry: {
      actorId: string;
      action: string;
      resourceType: string;
      resourceId?: string | null;
      metadata?: Record<string, unknown>;
      result?: 'success' | 'failure';
    },
  ) => Promise<void>;
}

/** Missing policy objects mean the reviewed database change is not applied. */
function isUnavailable(error: SupabaseError): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  if (code === '42883' || code === '42P01' || code === 'PGRST202' || code === 'PGRST205') return true;
  return /could not find the function|does not exist|schema cache/i.test(String(error.message || ''));
}

function isPermissionDenied(error: SupabaseError): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  if (code === '42501') return true;
  return /permission denied/i.test(String(error.message || ''));
}

function isValidationError(error: SupabaseError): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  if (['22007', '22023', '23514', '22P02'].includes(code)) return true;
  return /invalid|must be|required|future|not found|already|cannot/i.test(String(error.message || ''));
}

/** Human-readable, non-leaking message. Never echo raw SQL or policy details. */
function userMessage(error: SupabaseError, fallback: string): string {
  const message = String(error?.message || '').replace(/^.*?ERROR:\s*/i, '').trim();
  if (!message || message.length > 240) return fallback;
  return message;
}

function uuid(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function isoDate(value: unknown): string | null | undefined {
  if (value === null || value === '' || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

const UNAVAILABLE_MESSAGE = 'Bank security management is unavailable until the reviewed bank policy database change is applied. No change was made.';

export function registerRestrictedBankAdminRoutes(app: Express, deps: RestrictedBankDeps): void {
  const read = deps.requireCapability('cbt.read');
  const manage = deps.requireCapability('cbt.manage');

  /** Caller-scoped client, or null when the deployment cannot authenticate. */
  function callerClient(req: Request): ScopedClient | null {
    const token = (req.header('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;
    return deps.getUserScoped(token);
  }

  async function denied(res: Response, action: string, examId: string | null, actorId: string, status = 403) {
    await deps.recordAudit(deps.getSupabase(), {
      actorId: actorId || '00000000-0000-0000-0000-000000000000',
      action,
      resourceType: 'cbt_bank',
      resourceId: examId,
      result: 'failure',
    }).catch(() => undefined);
    return res.status(status).json({ error: 'You do not have permission to change bank security.' });
  }

  // --- Inventory ----------------------------------------------------------
  app.get('/api/admin/cbt/banks', read, async (req, res) => {
    const client = callerClient(req);
    if (!client) return res.status(503).json({ error: 'Bank security management is unavailable: the caller-scoped database connection is not configured.' });
    try {
      const { data, error } = await client.rpc('cbt_bank_admin_inventory');
      if (error) throw error;
      const items = Array.isArray(data) ? data : [];
      res.json({
        items,
        summary: {
          total: items.length,
          unclassified: items.filter((row: any) => !row.visibility).length,
          public: items.filter((row: any) => row.visibility === 'public').length,
          restricted: items.filter((row: any) => row.visibility === 'restricted').length,
          embargoed: items.filter((row: any) => row.visibility === 'restricted' && !row.released).length,
        },
      });
    } catch (error) {
      if (isUnavailable(error as SupabaseError)) return res.status(503).json({ error: UNAVAILABLE_MESSAGE });
      if (isPermissionDenied(error as SupabaseError)) return denied(res, 'bank_inventory_denied', null, String((req as any).adminUser?.id || ''));
      console.error('Bank inventory failed:', (error as SupabaseError)?.message || 'unknown');
      res.status(503).json({ error: 'Unable to load question banks.' });
    }
  });

  app.get('/api/admin/cbt/banks/:examId/candidates', read, async (req, res) => {
    const examId = uuid(req.params.examId);
    if (!examId) return res.status(400).json({ error: 'Choose a valid question bank.' });
    const client = callerClient(req);
    if (!client) return res.status(503).json({ error: 'Bank security management is unavailable: the caller-scoped database connection is not configured.' });
    try {
      const { data, error } = await client.rpc('cbt_bank_admin_candidates', { p_exam: examId });
      if (error) throw error;
      res.json({ items: Array.isArray(data) ? data : [] });
    } catch (error) {
      if (isUnavailable(error as SupabaseError)) return res.status(503).json({ error: UNAVAILABLE_MESSAGE });
      if (isPermissionDenied(error as SupabaseError)) return denied(res, 'bank_candidates_denied', examId, String((req as any).adminUser?.id || ''));
      console.error('Bank candidate list failed:', (error as SupabaseError)?.message || 'unknown');
      res.status(503).json({ error: 'Unable to load candidates for this bank.' });
    }
  });

  app.get('/api/admin/cbt/banks/:examId/history', read, async (req, res) => {
    const examId = uuid(req.params.examId);
    if (!examId) return res.status(400).json({ error: 'Choose a valid question bank.' });
    const client = callerClient(req);
    if (!client) return res.status(503).json({ error: 'Bank security management is unavailable: the caller-scoped database connection is not configured.' });
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const { data, error } = await client.rpc('cbt_bank_admin_history', { p_exam: examId, p_limit: limit });
      if (error) throw error;
      res.json({ items: Array.isArray(data) ? data : [] });
    } catch (error) {
      if (isUnavailable(error as SupabaseError)) return res.status(503).json({ error: UNAVAILABLE_MESSAGE });
      if (isPermissionDenied(error as SupabaseError)) return denied(res, 'bank_history_denied', examId, String((req as any).adminUser?.id || ''));
      console.error('Bank history failed:', (error as SupabaseError)?.message || 'unknown');
      res.status(503).json({ error: 'Unable to load the bank audit history.' });
    }
  });

  // --- Candidate lookup for assignment ------------------------------------
  // Account identifiers and names only; no answers, scores or question content.
  // The service client is used after the cbt.manage check, bounded to 20 rows.
  app.get('/api/admin/cbt/bank-candidates', manage, async (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
      if (search.length < 2) return res.json({ items: [] });
      // PostgREST filter grammar treats , . ( ) \\ as structure; strip them.
      const safe = search.replace(/[%,_.()\\]/g, '');
      if (!safe) return res.json({ items: [] });
      const { data, error } = await deps.getSupabase()
        .from('profiles')
        .select('id,full_name,matric_number,school')
        .or(`full_name.ilike.%${safe}%,matric_number.ilike.%${safe}%,school.ilike.%${safe}%`)
        .order('full_name', { ascending: true })
        .limit(20);
      if (error) throw error;
      res.json({ items: data || [] });
    } catch (error) {
      console.error('Bank candidate search failed:', (error as SupabaseError)?.message || 'unknown');
      res.status(503).json({ error: 'Unable to search student accounts.' });
    }
  });

  // --- Classification -----------------------------------------------------
  app.patch('/api/admin/cbt/banks/:examId/classification', manage, async (req, res) => {
    const examId = uuid(req.params.examId);
    if (!examId) return res.status(400).json({ error: 'Choose a valid question bank.' });
    const visibility = req.body?.visibility;
    if (!['public', 'restricted'].includes(visibility)) return res.status(400).json({ error: 'Choose public or restricted.' });
    const releaseAt = isoDate(req.body?.releaseAt);
    if (releaseAt === undefined) return res.status(400).json({ error: 'Enter a valid correction release date.' });
    // Shape checks only: the database still decides whether the release time is
    // in the future and whether the bank is already classified.
    if (visibility === 'restricted' && !releaseAt) {
      return res.status(400).json({ error: 'A restricted bank needs a future correction release time.' });
    }
    if (visibility === 'public' && releaseAt) {
      return res.status(400).json({ error: 'A public bank has no correction release time.' });
    }
    const actorId = String((req as any).adminUser?.id || '');
    const client = callerClient(req);
    if (!client) return res.status(503).json({ error: 'Bank security management is unavailable: the caller-scoped database connection is not configured.' });
    try {
      const { error } = await client.rpc('cbt_bank_classify', {
        p_exam: examId,
        p_visibility: visibility,
        p_release_at: releaseAt,
      });
      if (error) throw error;
      res.json({ ok: true, examId, visibility, releaseAt });
    } catch (error) {
      if (isUnavailable(error as SupabaseError)) return res.status(503).json({ error: UNAVAILABLE_MESSAGE });
      if (isPermissionDenied(error as SupabaseError)) return denied(res, 'bank_classify_denied', examId, actorId);
      console.error('Bank classification failed:', (error as SupabaseError)?.message || 'unknown');
      res.status(400).json({ error: userMessage(error as SupabaseError, 'Unable to classify this bank.') });
    }
  });

  // --- Correction release -------------------------------------------------
  app.patch('/api/admin/cbt/banks/:examId/release', manage, async (req, res) => {
    const examId = uuid(req.params.examId);
    if (!examId) return res.status(400).json({ error: 'Choose a valid question bank.' });
    const releaseAt = isoDate(req.body?.releaseAt);
    if (releaseAt === undefined || releaseAt === null) return res.status(400).json({ error: 'Enter a valid correction release date.' });
    const actorId = String((req as any).adminUser?.id || '');
    const client = callerClient(req);
    if (!client) return res.status(503).json({ error: 'Bank security management is unavailable: the caller-scoped database connection is not configured.' });
    try {
      const { error } = await client.rpc('cbt_bank_set_release', { p_exam: examId, p_release_at: releaseAt });
      if (error) throw error;
      res.json({ ok: true, examId, releaseAt });
    } catch (error) {
      if (isUnavailable(error as SupabaseError)) return res.status(503).json({ error: UNAVAILABLE_MESSAGE });
      if (isPermissionDenied(error as SupabaseError)) return denied(res, 'bank_release_denied', examId, actorId);
      console.error('Bank release change failed:', (error as SupabaseError)?.message || 'unknown');
      res.status(400).json({ error: userMessage(error as SupabaseError, 'Unable to change the correction release time.') });
    }
  });

  // --- Assignment ---------------------------------------------------------
  app.post('/api/admin/cbt/banks/:examId/candidates', manage, async (req, res) => {
    const examId = uuid(req.params.examId);
    const candidateId = uuid(req.body?.candidateId);
    if (!examId || !candidateId) return res.status(400).json({ error: 'Choose a bank and a student account.' });
    const actorId = String((req as any).adminUser?.id || '');
    const client = callerClient(req);
    if (!client) return res.status(503).json({ error: 'Bank security management is unavailable: the caller-scoped database connection is not configured.' });
    try {
      const { error } = await client.rpc('cbt_bank_admin_assign', { p_exam: examId, p_candidate: candidateId, p_assign: true });
      if (error) throw error;
      res.status(201).json({ ok: true, examId, candidateId, status: 'active' });
    } catch (error) {
      if (isUnavailable(error as SupabaseError)) return res.status(503).json({ error: UNAVAILABLE_MESSAGE });
      if (isPermissionDenied(error as SupabaseError)) return denied(res, 'bank_assign_denied', examId, actorId);
      if (isValidationError(error as SupabaseError)) return res.status(400).json({ error: userMessage(error as SupabaseError, 'Unable to assign this candidate.') });
      console.error('Bank assignment failed:', (error as SupabaseError)?.message || 'unknown');
      res.status(503).json({ error: 'Unable to assign this candidate.' });
    }
  });

  app.delete('/api/admin/cbt/banks/:examId/candidates/:candidateId', manage, async (req, res) => {
    const examId = uuid(req.params.examId);
    const candidateId = uuid(req.params.candidateId);
    if (!examId || !candidateId) return res.status(400).json({ error: 'Choose a bank and a student account.' });
    const actorId = String((req as any).adminUser?.id || '');
    const client = callerClient(req);
    if (!client) return res.status(503).json({ error: 'Bank security management is unavailable: the caller-scoped database connection is not configured.' });
    try {
      const { error } = await client.rpc('cbt_bank_admin_assign', { p_exam: examId, p_candidate: candidateId, p_assign: false });
      if (error) throw error;
      res.json({ ok: true, examId, candidateId, status: 'revoked' });
    } catch (error) {
      if (isUnavailable(error as SupabaseError)) return res.status(503).json({ error: UNAVAILABLE_MESSAGE });
      if (isPermissionDenied(error as SupabaseError)) return denied(res, 'bank_revoke_denied', examId, actorId);
      if (isValidationError(error as SupabaseError)) return res.status(400).json({ error: userMessage(error as SupabaseError, 'Unable to revoke this candidate.') });
      console.error('Bank revocation failed:', (error as SupabaseError)?.message || 'unknown');
      res.status(503).json({ error: 'Unable to revoke this candidate.' });
    }
  });
}

export const RESTRICTED_BANK_UNAVAILABLE_MESSAGE = UNAVAILABLE_MESSAGE;
