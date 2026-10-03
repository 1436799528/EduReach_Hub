import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  assertOwnership,
  hasCapability,
  recordAudit,
  requireCapability,
  requireStaff,
  type AuthorizedRequest,
} from './middleware';
import { getServerSupabaseKey } from './lib/supabase-config';
import { verifyJWT } from './lib/auth';
import { notifyServiceRequestStatus } from './src/server/notifications';
import { type Capability } from './src/lib/capabilities';
import { userFacingError as normalizeUserFacingError } from './lib/errors';
import { createRateLimiter, RATE_LIMIT_RULES } from './lib/rate-limit';
import { runNewsroomRefresh } from './src/server/newsroom/run';
import { expiresAtFor } from './src/server/newsroom/qualityGate';
import { buildRobotsTxt, buildSitemapXml, collectSitemapEntries, isNonIndexablePath, resolveSiteOrigin } from './src/server/seo';
import { isAnalyticsEvent, sanitizeAnalyticsPath, sanitizeReferrer, sanitizeUserAgent, validateAnalyticsMetadata } from './src/lib/analyticsTaxonomy';
import { STALE_AFTER_HOURS, evaluateJobHealth } from './src/server/jobRuns';

export const app = express();
const publicErrorMessage = normalizeUserFacingError;

const PORT = Number(process.env.PORT || 3000);
const LIVE_SERVICE_KEYS = ['nelfund-loan', 'results', 'jamb-slip', 'admission-letters'] as const;
app.disable('x-powered-by');

/**
 * Abuse control. The in-process limiter is always active; the durable counter
 * (public.check_rate_limit) makes the sensitive routes hold across instances.
 * See lib/rate-limit.ts for the policy table.
 */
const rateLimitFor = createRateLimiter({
  callRpc: async (fn, args) => {
    if (!isServerSupabaseConfigured()) return { data: null, error: { message: 'Supabase is not configured.' } };
    const result = await getServerSupabase().rpc(fn, args);
    return { data: result.data, error: result.error ? { message: result.error.message } : null };
  },
  log: (message, meta) => console.warn(`[rate-limit] ${message}`, meta ? JSON.stringify(meta) : ''),
});

app.use((_req, res, next) => {
  if (
    _req.url === '/.netlify/functions/api' ||
    _req.url.startsWith('/.netlify/functions/api/') ||
    _req.url.startsWith('/.netlify/functions/api?')
  ) {
    _req.url = _req.url.slice('/.netlify/functions'.length);
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    // Strict production headers. Keep in sync with public/_headers (Netlify).
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // HSTS: the site is HTTPS-only in production. Deliberately without
    // `includeSubDomains` or `preload` - both are one-way decisions that would
    // also bind any future subdomain (staging, a CDN host) to HTTPS-only.
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https://wa.me; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self'",
    );
  } else {
    // Development/preview: the Vite dev client needs inline scripts, HMR
    // websockets and cross-origin iframe embedding (sandbox previews), so the
    // strict production CSP/X-Frame-Options would blank the page entirely.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self' https://wa.me; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' ws: wss: http: https:; frame-ancestors *",
    );
  }
  if (_req.path === '/api' || _req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  // Server-side indexability. A client-rendered noindex is a hint; this header
  // is what a crawler actually receives for student, admin and tracker routes.
  if (isPrivatePath(_req.path)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// Broad per-IP ceiling for the whole API surface, then per-route limits below.
app.use('/api', rateLimitFor(RATE_LIMIT_RULES.apiGeneral));

/**
 * Paths that must never be indexed: student, admin, auth, tracker and
 * placeholder routes, plus service pages with no live workflow. The rule lives
 * in src/server/seo.ts (`isNonIndexablePath`) so the header, robots.txt and the
 * sitemap cannot drift apart.
 */
function isPrivatePath(pathname: string): boolean {
  return isNonIndexablePath(pathname);
}

function isServerSupabaseConfigured() {
  return Boolean(process.env.VITE_SUPABASE_URL && getServerSupabaseKey());
}

function getServerSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = getServerSupabaseKey();
  if (!url || !key) {
    throw new Error('Supabase server admin key is missing or invalid. Configure SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_SECRET_KEY with the server secret key, not a publishable/anon key.');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * A user-scoped Supabase client (publishable key + the caller's access token).
 * Ownership-critical RPCs resolve the caller with `auth.uid()`, which is null
 * for the service-role client — using it here would make those RPCs run as
 * nobody. Returns null when no publishable key is configured, and the caller
 * falls back to the service client (the RPC then refuses, as it did before).
 */
function getUserScopedSupabase(accessToken: string) {
  const url = process.env.VITE_SUPABASE_URL;
  const publishableKey = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !publishableKey) return null;
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Resolve the caller from their session, then authorize them. Authorization
 * failures throw, and every handler maps them to 401 (not signed in) or 403
 * (signed in, not allowed) — the operation never runs.
 */
async function requireUser(req: express.Request, capability: Capability = 'dashboard.access') {
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) throw new Error('Authentication required.');
  const token = auth.slice('Bearer '.length).trim();
  const caller = await verifyJWT(token);
  if (!caller) throw new Error('Invalid or expired session.');
  if (!hasCapability(caller, capability)) throw new Error('You do not have permission to perform this action.');
  return {
    supabase: getServerSupabase(),
    rpcSupabase: getUserScopedSupabase(token) || getServerSupabase(),
    user: caller,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'edureach' });
});

/**
 * Readiness/dependency health, separate from the liveness probe above.
 * `/api/health` answers "is the process up"; this answers "can it serve
 * requests", which is the question a deploy gate or uptime monitor needs.
 */
app.get('/api/health/ready', async (_req, res) => {
  const checks: Record<string, { ok: boolean; detail?: string }> = {
    server: { ok: true },
    supabase_configured: {
      ok: isServerSupabaseConfigured(),
      detail: isServerSupabaseConfigured() ? undefined : 'VITE_SUPABASE_URL or the server secret key is missing.',
    },
  };

  let databaseLatencyMs: number | null = null;
  if (checks.supabase_configured.ok) {
    const started = Date.now();
    try {
      const supabase = getServerSupabase();
      const { error } = await supabase.from('news_articles').select('id').limit(1);
      databaseLatencyMs = Date.now() - started;
      checks.database = { ok: !error, detail: error ? 'Database read failed.' : undefined };
    } catch (error) {
      checks.database = { ok: false, detail: normalizeUserFacingError(error, 'Database read failed.') };
    }
  }

  const ready = Object.values(checks).every((check) => check.ok);
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    checked_at: new Date().toISOString(),
    checks,
    database_latency_ms: databaseLatencyMs,
  });
});


// Parse uploads only after authorization, using the endpoint's larger limit.
const jsonBody = express.json({ limit: '1mb' });
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/api/admin/uploads') return next();
  return jsonBody(req, res, next);
});

app.post('/api/admin/bootstrap', rateLimitFor(RATE_LIMIT_RULES.adminBootstrap), async (req, res) => {
  try {
    const configuredEmail = String(process.env.EDUREACH_ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
    if (!configuredEmail) return res.status(503).json({ error: 'Admin bootstrap email is not configured.' });
    const auth = req.header('authorization');
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required.' });
    const supabase = getServerSupabase();
    const token = auth.slice('Bearer '.length).trim();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user?.email) return res.status(401).json({ error: 'Invalid or expired session.' });
    if (authData.user.email.toLowerCase() !== configuredEmail) return res.status(403).json({ error: 'This account is not the configured EduReach administrator.' });
    const { data, error } = await supabase.rpc('admin_bootstrap_first_admin', { p_user_id: authData.user.id, p_email: configuredEmail });
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'Admin bootstrap is already locked or the account does not match.' });
    res.json({ success: true, role: 'super_admin' });
  } catch (error) {
    console.error('Admin bootstrap error:', error);
    res.status(500).json({ error: 'Unable to bootstrap the first administrator.' });
  }
});

app.get('/api/admin/session', requireStaff, async (req, res) => {
  const adminUser = (req as AuthorizedRequest).adminUser!;
  // The console renders from this: the application role plus the resolved
  // capability list. It is a UX input only — every endpoint re-checks.
  res.json({
    user: {
      id: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      role: adminUser.appRole,
      capabilities: adminUser.capabilities,
    },
  });
});

app.get('/api/admin/jobs', requireCapability('analytics.read'), async (req, res) => {
  try {
    // OBS-1: last success, last failure and freshness per scheduled job. Read-only,
    // and it deliberately reports jobs that have *no* row at all — a schedule that
    // stopped firing is the failure mode that produces no error anywhere.
    const supabase = getServerSupabase();
    const { data, error } = await supabase.rpc('scheduled_job_status', {
      p_stale_after_hours: STALE_AFTER_HOURS,
    });
    if (error) throw error;
    const health = evaluateJobHealth(data as { sinceHours: number; jobs: Array<Record<string, unknown>> });
    res.json({ ...(data as Record<string, unknown>), health });
  } catch (error) {
    console.error('Admin job status error:', error);
    res.status(503).json({ error: 'Unable to load scheduled job status.' });
  }
});

app.get('/api/admin/analytics', requireCapability('analytics.read'), async (req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data: metrics, error: metricError } = await supabase.rpc('admin_dashboard_metrics');
    if (metricError) throw metricError;
    // The admin_audit_log RPC writes admin_audit_logs; older live projects may
    // hold earlier entries in edureach_audit_logs. Read both tolerantly so the
    // feed works on either schema and merges both histories.
    const auditFeed = async (table: 'admin_audit_logs' | 'edureach_audit_logs') => {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('id,action,entity_type,entity_id,metadata,created_at')
          .order('created_at', { ascending: false })
          .limit(20);
        return error ? [] : data || [];
      } catch {
        return [];
      }
    };
    // The audit trail is its own capability: analytics staff do not
    // automatically get to read who did what.
    const seesAudit = hasCapability((req as AuthorizedRequest).adminUser, 'audit.read');
    const [canonicalAudit, legacyAudit, recentRequests, recentUsers, activity] = await Promise.all([
      seesAudit ? auditFeed('admin_audit_logs') : Promise.resolve([]),
      seesAudit ? auditFeed('edureach_audit_logs') : Promise.resolve([]),
      supabase.from('service_requests').select('id,reference_code,status,created_at,updated_at,service_catalog(title)').order('created_at',{ascending:false}).limit(10),
      supabase.from('profiles').select('id,full_name,role,created_at').order('created_at',{ascending:false}).limit(10),
      (async () => {
        // Focus/activity breakdown computed in SQL from real telemetry. Tolerated
        // as null when the RPC is not applied yet, so analytics still renders.
        try {
          const { data, error } = await supabase.rpc('admin_activity_breakdown', { p_days: 14 });
          return error ? null : data;
        } catch { return null; }
      })(),
    ]);
    const audit = [...canonicalAudit, ...legacyAudit]
      .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
      .slice(0, 20);
    res.json({ metrics: metrics || {}, activity: activity || null, audit, recentRequests: recentRequests.data || [], recentUsers: recentUsers.data || [] });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(503).json({ error: 'Unable to load administrative analytics.' });
  }
});

app.post('/api/analytics/event', rateLimitFor(RATE_LIMIT_RULES.analyticsEvent), async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(204).end();
  try {
    // AN-1: the taxonomy in src/lib/analyticsTaxonomy.ts is the allowlist — the
    // event name, the metadata keys, their types, their caps and the payload
    // cap. Nothing a student typed is accepted, because no free-text field is
    // declared; an undeclared key is dropped rather than stored. See
    // docs/features/AN-1.md.
    const eventName = String(req.body?.event_name || '').trim();
    const sessionId = String(req.body?.session_id || '').trim().slice(0, 120);
    if (!sessionId) return res.status(400).json({ error: 'session_id is required.' });
    if (!isAnalyticsEvent(eventName)) return res.status(400).json({ error: 'Unsupported analytics event.' });

    const validation = validateAnalyticsMetadata(eventName, req.body?.metadata);
    if (!validation.ok) return res.status(400).json({ error: 'Invalid analytics payload.' });
    const pathName = sanitizeAnalyticsPath(req.body?.path);

    const supabase = getServerSupabase();
    const auth = req.header('authorization');
    let userId: string | null = null;
    if (auth?.startsWith('Bearer ')) {
      const { data } = await supabase.auth.getUser(auth.slice('Bearer '.length).trim());
      userId = data.user?.id || null;
    }
    const { error } = await supabase.from('site_analytics_events').insert({
      event_name:eventName,path:pathName,session_id:sessionId,user_id:userId,
      referrer:sanitizeReferrer(req.body?.referrer),
      user_agent:sanitizeUserAgent(req.headers['user-agent']),
      metadata:validation.value
    });
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Analytics event error:', error);
    res.status(204).end();
  }
});

app.get('/api/admin/users', requireCapability('user.read'), async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const supabase = getServerSupabase();
    let query = supabase.from('profiles').select('id,full_name,school,faculty,department,level,role,matric_number,created_at').order('created_at', { ascending: false }).limit(200);
    if (search) {
      const safe = search.replace(/[%,_]/g, '');
      if (safe) query = query.or(`full_name.ilike.%${safe}%,school.ilike.%${safe}%,department.ilike.%${safe}%,matric_number.ilike.%${safe}%`);
    }
    const [{ data, error }, authUsers] = await Promise.all([
      query,
      supabase.auth.admin.listUsers({ perPage: 1000 }).catch(() => ({ data: null, error: null })),
    ]);
    if (error) throw error;
    const suspendedIds = new Set(
      (authUsers.data?.users || [])
        .filter((user) => Boolean((user as { banned_until?: string | null }).banned_until))
        .map((user) => user.id),
    );
    res.json({ items: (data || []).map((row) => ({ ...row, suspended: suspendedIds.has(row.id) })) });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(503).json({ error: 'Unable to load student accounts.' });
  }
});

app.get('/api/admin/users/:userId/activity', requireCapability('user.read'), async (req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', req.params.userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return res.status(404).json({ error: 'Student profile not found.' });
    const [requests, attempts] = await Promise.all([
      supabase
        .from('service_requests')
        .select('id,reference_code,status,created_at,service_catalog(title)')
        .eq('user_id', req.params.userId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('cbt_attempts')
        .select('id,status,score,started_at,submitted_at,cbt_exams(title)')
        .eq('user_id', req.params.userId)
        .order('started_at', { ascending: false })
        .limit(20),
    ]);
    res.json({
      requests: requests.data || [],
      attempts: attempts.data || [],
      requestError: requests.error ? 'History unavailable.' : null,
      attemptError: attempts.error ? 'CBT history unavailable.' : null,
    });
  } catch (error) {
    console.error('Admin user activity error:', error);
    res.status(503).json({ error: 'Unable to load the student activity.' });
  }
});

app.get('/api/admin/service-requests', requireCapability('service_request.read'), async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const allowed = ['all','submitted','reviewing','processing','awaiting_information','completed','closed','rejected','cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status filter.' });
    const supabase = getServerSupabase();
    let query = supabase.from('service_requests').select('id,user_id,status,form_data,admin_note,created_at,updated_at,reference_code,service_catalog(title)').order('created_at', { ascending: false }).limit(200);
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin service queue error:', error);
    res.status(503).json({ error: 'Unable to load service queue.' });
  }
});

app.patch('/api/admin/service-requests/:requestId', requireCapability('service_request.process'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: request, error: requestError } = await supabase
      .from('service_requests')
      .select('id,status,admin_note,user_id,reference_code,service_catalog(title)')
      .eq('id', req.params.requestId)
      .single();
    if (requestError || !request) return res.status(404).json({ error: 'Service request not found.' });

    const wantsStatus = req.body?.status !== undefined;
    const wantsNote = req.body?.admin_note !== undefined;
    if (!wantsStatus && !wantsNote) return res.status(400).json({ error: 'Nothing to update.' });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (wantsNote) {
      const note = String(req.body?.admin_note || '').trim().slice(0, 2000);
      update.admin_note = note || null;
    }

    let nextStatus: string | null = null;
    if (wantsStatus) {
      nextStatus = String(req.body?.status || '');
      const allowed = ['submitted','reviewing','processing','awaiting_information','completed','closed','rejected','cancelled'];
      if (!allowed.includes(nextStatus)) return res.status(400).json({ error: 'Invalid service status.' });
      const transitions: Record<string, string[]> = {
        submitted: ['reviewing','processing','awaiting_information','rejected','cancelled'],
        reviewing: ['processing','awaiting_information','completed','rejected','cancelled'],
        processing: ['awaiting_information','completed','rejected','cancelled'],
        awaiting_information: ['reviewing','processing','completed','cancelled'],
        completed: ['closed'],
        closed: [],
        rejected: [],
        cancelled: [],
      };
      if (!transitions[request.status]?.includes(nextStatus)) return res.status(409).json({ error: `Cannot change status from ${request.status} to ${nextStatus}.` });
      update.status = nextStatus;
    }

    const { data, error } = await supabase.from('service_requests').update(update).eq('id', request.id).select('id,status,admin_note,updated_at').single();
    if (error) throw error;
    if (nextStatus) {
      await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'status_change', p_entity_type: 'service_request', p_entity_id: request.id, p_metadata: { from: request.status, to: nextStatus } });
      // The student is told about the same transition the audit trail recorded.
      // Best effort: a notification failure must not fail the status change.
      await notifyServiceRequestStatus(supabase, {
        request: request as { id: string; user_id: string; status: string; reference_code?: string | null },
        from: String(request.status || ''),
        to: nextStatus,
      });
    } else {
      await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'note', p_entity_type: 'service_request', p_entity_id: request.id, p_metadata: { note_updated: true } });
    }
    res.json({ item: data });
  } catch (error) {
    console.error('Admin service status error:', error);
    res.status(500).json({ error: 'Unable to update service request.' });
  }
});

app.get('/api/admin/cbt/exams', requireCapability('cbt.read'), async (req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('cbt_exams').select('id,title,exam_body,subject,description,duration_minutes,is_active,created_at').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin CBT exams error:', error);
    res.status(503).json({ error: 'Unable to load CBT exams.' });
  }
});

app.post('/api/admin/cbt/exams', requireCapability('cbt.manage'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const { title, exam_body, subject, description, duration_minutes, is_active } = req.body || {};
    const duration = Number(duration_minutes);
    if (!title?.trim() || !exam_body?.trim() || !subject?.trim() || !Number.isInteger(duration) || duration < 5 || duration > 180) {
      return res.status(400).json({ error: 'Valid title, exam body, subject and duration are required.' });
    }
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('cbt_exams').insert({
      title: title.trim(), exam_body: exam_body.trim().toUpperCase(), subject: subject.trim(),
      description: description?.trim() || null, duration_minutes: duration, is_active: is_active !== false,
      created_by: adminUser.id,
    }).select('id,title,exam_body,subject,description,duration_minutes,is_active,created_at').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'create', p_entity_type: 'cbt_exam', p_entity_id: data.id, p_metadata: { title: data.title } });
    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Admin CBT exam create error:', error);
    res.status(500).json({ error: 'Unable to create CBT exam.' });
  }
});

app.patch('/api/admin/cbt/exams/:examId', requireCapability('cbt.manage'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: existing, error: existingError } = await supabase.from('cbt_exams').select('id,title,is_active').eq('id', req.params.examId).single();
    if (existingError || !existing) return res.status(404).json({ error: 'CBT exam not found.' });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (req.body?.title !== undefined) {
      const title = String(req.body.title).trim().slice(0, 160);
      if (!title) return res.status(400).json({ error: 'The exam title cannot be empty.' });
      patch.title = title;
    }
    if (req.body?.exam_body !== undefined) {
      const examBody = String(req.body.exam_body).trim().toUpperCase().slice(0, 40);
      if (!examBody) return res.status(400).json({ error: 'The examination body cannot be empty.' });
      patch.exam_body = examBody;
    }
    if (req.body?.subject !== undefined) {
      const subject = String(req.body.subject).trim().slice(0, 120);
      if (!subject) return res.status(400).json({ error: 'The exam subject cannot be empty.' });
      patch.subject = subject;
    }
    if (req.body?.description !== undefined) patch.description = String(req.body.description).trim().slice(0, 600) || null;
    if (req.body?.duration_minutes !== undefined) {
      const duration = Number(req.body.duration_minutes);
      if (!Number.isInteger(duration) || duration < 5 || duration > 180) {
        return res.status(400).json({ error: 'The default duration must be a whole number of minutes between 5 and 180.' });
      }
      patch.duration_minutes = duration;
    }
    if (req.body?.is_active !== undefined) patch.is_active = req.body.is_active === true;
    if (Object.keys(patch).length === 1) return res.status(400).json({ error: 'Nothing to update.' });
    const { data, error } = await supabase.from('cbt_exams').update(patch).eq('id', existing.id).select('id,title,exam_body,subject,description,duration_minutes,is_active,created_at').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'update', p_entity_type: 'cbt_exam', p_entity_id: existing.id, p_metadata: { title: data.title, is_active: data.is_active } });
    res.json({ item: data });
  } catch (error) {
    console.error('Admin CBT exam update error:', error);
    res.status(500).json({ error: 'Unable to update the CBT exam.' });
  }
});

app.delete('/api/admin/cbt/exams/:examId', requireCapability('cbt.manage'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: existing, error: existingError } = await supabase.from('cbt_exams').select('id,title').eq('id', req.params.examId).single();
    if (existingError || !existing) return res.status(404).json({ error: 'CBT exam not found.' });
    // Never erase a bank students have attempted — history integrity wins.
    const { count: attemptCount, error: attemptError } = await supabase
      .from('cbt_attempts').select('id', { count: 'exact', head: true }).eq('exam_id', existing.id);
    if (attemptError) throw attemptError;
    if (attemptCount) return res.status(409).json({ error: 'This exam has recorded student attempts. Deactivate it instead of deleting it so result history stays intact.' });
    const { error: questionError } = await supabase.from('exam_questions').delete().eq('exam_id', existing.id);
    if (questionError) throw questionError;
    const { error } = await supabase.from('cbt_exams').delete().eq('id', existing.id);
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'delete', p_entity_type: 'cbt_exam', p_entity_id: existing.id, p_metadata: { title: existing.title } });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin CBT exam delete error:', error);
    res.status(500).json({ error: 'Unable to delete the CBT exam.' });
  }
});

app.get('/api/admin/cbt/exams/:examId/questions', requireCapability('cbt.read'), async (req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('exam_questions').select('id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,marks,position').eq('exam_id', req.params.examId).order('position', { ascending: true });
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin CBT questions error:', error);
    res.status(503).json({ error: 'Unable to load CBT questions.' });
  }
});

app.post('/api/admin/cbt/exams/:examId/questions', requireCapability('cbt.manage'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const { subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position } = req.body || {};
    const numericMarks = Number(marks || 1); const numericPosition = Number(position);
    if (!question_text?.trim() || !option_a?.trim() || !option_b?.trim() || !option_c?.trim() || !option_d?.trim() ||
      !['A','B','C','D'].includes(correct_option) || !Number.isInteger(numericMarks) || numericMarks < 1 ||
      !Number.isInteger(numericPosition) || numericPosition < 1) return res.status(400).json({ error: 'Invalid CBT question data.' });
    const supabase = getServerSupabase();
    const { data: exam } = await supabase.from('cbt_exams').select('id,subject').eq('id', req.params.examId).maybeSingle();
    if (!exam) return res.status(404).json({ error: 'CBT exam not found.' });
    const questionSubject = (typeof subject === 'string' && subject.trim()) ? subject.trim() : (exam.subject?.trim() || 'General');
    const { data, error } = await supabase.from('exam_questions').insert({
      exam_id: exam.id, subject: questionSubject, question_text: question_text.trim(), option_a: option_a.trim(), option_b: option_b.trim(),
      option_c: option_c.trim(), option_d: option_d.trim(), correct_option, explanation: explanation?.trim() || null,
      marks: numericMarks, position: numericPosition,
    }).select('id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,marks,position').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'create', p_entity_type: 'exam_question', p_entity_id: data.id, p_metadata: { exam_id: exam.id, position: numericPosition } });
    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Admin CBT question create error:', error);
    const message = error instanceof Error && error.message.includes('duplicate') ? 'That question position is already in use.' : 'Unable to create CBT question.';
    res.status(400).json({ error: publicErrorMessage(message, 'Invalid CBT question data. Please check the question and try again.') });
  }
});

app.patch('/api/admin/cbt/questions/:questionId', requireCapability('cbt.manage'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const { subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position } = req.body || {};
    const numericMarks = Number(marks || 1); const numericPosition = Number(position);
    if (!question_text?.trim() || !option_a?.trim() || !option_b?.trim() || !option_c?.trim() || !option_d?.trim() ||
      !['A','B','C','D'].includes(correct_option) || !Number.isInteger(numericMarks) || numericMarks < 1 ||
      !Number.isInteger(numericPosition) || numericPosition < 1) return res.status(400).json({ error: 'Invalid CBT question data.' });
    const supabase = getServerSupabase();
    const updatePayload: Record<string, unknown> = {
      question_text: question_text.trim(), option_a: option_a.trim(), option_b: option_b.trim(), option_c: option_c.trim(),
      option_d: option_d.trim(), correct_option, explanation: explanation?.trim() || null, marks: numericMarks, position: numericPosition,
      updated_at: new Date().toISOString(),
    };
    if (typeof subject === 'string' && subject.trim()) updatePayload.subject = subject.trim();
    const { data, error } = await supabase.from('exam_questions').update(updatePayload).eq('id', req.params.questionId).select('id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,marks,position').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'update', p_entity_type: 'exam_question', p_entity_id: data.id, p_metadata: { position: numericPosition } });
    res.json({ item: data });
  } catch (error) {
    console.error('Admin CBT question update error:', error);
    const message = error instanceof Error && error.message.includes('duplicate') ? 'That question position is already in use.' : 'Unable to update CBT question.';
    res.status(400).json({ error: message });
  }
});

app.delete('/api/admin/cbt/questions/:questionId', requireCapability('cbt.manage'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('exam_questions').delete().eq('id', req.params.questionId).select('id,exam_id').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'delete', p_entity_type: 'exam_question', p_entity_id: data.id, p_metadata: { exam_id: data.exam_id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin CBT question delete error:', error);
    res.status(500).json({ error: 'Unable to remove CBT question.' });
  }
});

function slugifyTitle(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'article';
}

function safeContentUrl(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function uniqueNewsSlug(supabase: any, base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  for (let attempt = 0; attempt < 25; attempt++) {
    let query = supabase.from('news_articles').select('id').eq('slug', candidate).limit(1);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    if (!data || data.length === 0) return candidate;
    candidate = `${base}-${attempt + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const newsRowSelect = 'id,slug,title,excerpt,body,category,image_url,source_name,source_url,published,published_at,featured,tags,updated_at';

// Comma-separated tag list → trimmed, de-duplicated, capped. Empty → null.
function normalizeTags(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const list = Array.isArray(value) ? value : String(value).split(',');
  const cleaned = Array.from(new Set(list.map((tag) => String(tag || '').trim().slice(0, 40)).filter(Boolean))).slice(0, 12);
  return cleaned.length ? cleaned.join(', ') : null;
}

app.get('/api/admin/news', requireCapability('news.read'), async (_req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('news_articles').select(newsRowSelect).order('updated_at', { ascending: false }).limit(200);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin news list error:', error);
    res.status(503).json({ error: 'Unable to load newsroom articles.' });
  }
});

app.post('/api/admin/news', requireCapability('news.create'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const title = String(req.body?.title || '').trim();
    const bodyText = String(req.body?.body || '').trim();
    if (!title || !bodyText) return res.status(400).json({ error: 'Article title and body are required.' });
    const supabase = getServerSupabase();
    const base = slugifyTitle(String(req.body?.slug || title));
    const slug = await uniqueNewsSlug(supabase, base);
    const imageUrl = safeContentUrl(req.body?.image_url);
    const sourceUrl = safeContentUrl(req.body?.source_url);
    if ((req.body?.image_url && !imageUrl) || (req.body?.source_url && !sourceUrl)) {
      return res.status(400).json({ error: 'Image and source links must use HTTPS or a site-relative path.' });
    }
    const published = req.body?.published === true;
    // `news.create` may save drafts; putting a story in front of students is a
    // separate capability, checked from the payload rather than the route.
    if (published && !hasCapability((req as AuthorizedRequest).adminUser, 'news.publish')) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    const now = new Date().toISOString();
    let publishedAt: string | null = null;
    if (published) {
      if (req.body?.published_at) {
        const parsedAt = new Date(String(req.body.published_at));
        if (!Number.isFinite(parsedAt.getTime())) return res.status(400).json({ error: 'The publication date is invalid.' });
        publishedAt = parsedAt.toISOString();
      } else {
        publishedAt = now;
      }
    }
    const row = {
      slug,
      title,
      excerpt: req.body?.excerpt ? String(req.body.excerpt).trim() : null,
      body: bodyText,
      category: String(req.body?.category || 'general').trim().toLowerCase() || 'general',
      image_url: imageUrl,
      source_name: req.body?.source_name ? String(req.body.source_name).trim() : null,
      source_url: sourceUrl,
      published,
      published_at: publishedAt,
      featured: req.body?.featured === true,
      tags: normalizeTags(req.body?.tags),
    };
    const { data, error } = await supabase.from('news_articles').insert(row).select(newsRowSelect).single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'news_create', p_entity_type: 'news_article', p_entity_id: data.id, p_metadata: { slug } });
    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Admin news create error:', error);
    res.status(500).json({ error: 'Unable to create this article.' });
  }
});

app.patch('/api/admin/news/:articleId', requireCapability('news.update'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: existing, error: existingError } = await supabase.from('news_articles').select('id,slug,published,published_at').eq('id', req.params.articleId).single();
    if (existingError || !existing) return res.status(404).json({ error: 'News article not found.' });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (req.body?.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) return res.status(400).json({ error: 'Article title cannot be empty.' });
      patch.title = title;
    }
    if (req.body?.slug !== undefined) {
      const base = slugifyTitle(String(req.body.slug || (patch.title as string) || existing.slug));
      patch.slug = await uniqueNewsSlug(supabase, base, existing.id);
    }
    if (req.body?.body !== undefined) {
      const bodyText = String(req.body.body).trim();
      if (!bodyText) return res.status(400).json({ error: 'Article body cannot be empty.' });
      patch.body = bodyText;
    }
    if (req.body?.excerpt !== undefined) patch.excerpt = req.body.excerpt ? String(req.body.excerpt).trim() : null;
    if (req.body?.category !== undefined) patch.category = String(req.body.category).trim().toLowerCase() || 'general';
    if (req.body?.image_url !== undefined) {
      const imageUrl = safeContentUrl(req.body.image_url);
      if (req.body.image_url && !imageUrl) return res.status(400).json({ error: 'Image links must use HTTPS or a site-relative path.' });
      patch.image_url = imageUrl;
    }
    if (req.body?.source_name !== undefined) patch.source_name = req.body.source_name ? String(req.body.source_name).trim() : null;
    if (req.body?.source_url !== undefined) {
      const sourceUrl = safeContentUrl(req.body.source_url);
      if (req.body.source_url && !sourceUrl) return res.status(400).json({ error: 'Source links must use HTTPS or a site-relative path.' });
      patch.source_url = sourceUrl;
    }
    if (req.body?.featured !== undefined) patch.featured = req.body.featured === true;
    if (req.body?.tags !== undefined) patch.tags = normalizeTags(req.body.tags);
    if (req.body?.published !== undefined) {
      const published = req.body.published === true;
      if (published && !existing.published && !hasCapability((req as AuthorizedRequest).adminUser, 'news.publish')) {
        return res.status(403).json({ error: 'You do not have permission to perform this action.' });
      }
      patch.published = published;
      if (published && !existing.published_at && req.body?.published_at === undefined) patch.published_at = new Date().toISOString();
      if (!published) patch.published_at = null;
    }
    if (req.body?.published_at !== undefined) {
      if (req.body.published_at) {
        const parsedAt = new Date(String(req.body.published_at));
        if (!Number.isFinite(parsedAt.getTime())) return res.status(400).json({ error: 'The publication date is invalid.' });
        patch.published_at = parsedAt.toISOString();
      } else {
        patch.published_at = null;
      }
    }
    const { data, error } = await supabase.from('news_articles').update(patch).eq('id', existing.id).select(newsRowSelect).single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'news_update', p_entity_type: 'news_article', p_entity_id: existing.id, p_metadata: { slug: data.slug } });
    res.json({ item: data });
  } catch (error) {
    console.error('Admin news update error:', error);
    res.status(500).json({ error: 'Unable to update this article.' });
  }
});

app.delete('/api/admin/news/:articleId', requireCapability('news.delete'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: existing, error: existingError } = await supabase.from('news_articles').select('id,slug').eq('id', req.params.articleId).single();
    if (existingError || !existing) return res.status(404).json({ error: 'News article not found.' });
    const { error } = await supabase.from('news_articles').delete().eq('id', existing.id);
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'news_delete', p_entity_type: 'news_article', p_entity_id: existing.id, p_metadata: { slug: existing.slug } });
    res.json({ deleted: true });
  } catch (error) {
    console.error('Admin news delete error:', error);
    res.status(500).json({ error: 'Unable to delete this article.' });
  }
});

// ---------------------------------------------------------------------------
// Admin control-centre endpoints (2026-09-26): calendar items, institutions,
// service catalogue visibility, account suspension and content image uploads.
// All writes use the service-role key after capability authorization and
// are recorded in the staff audit trail.
// ---------------------------------------------------------------------------

const CALENDAR_PRIORITIES = ['low', 'normal', 'high'];
const CALENDAR_STATUSES = ['pending', 'cancelled'];

app.get('/api/admin/calendar-items', requireCapability('calendar.read'), async (req, res) => {
  try {
    const type = String(req.query.type || 'deadline');
    if (!['deadline', 'exam'].includes(type)) return res.status(400).json({ error: 'Invalid calendar item type.' });
    const supabase = getServerSupabase();
    const table = type === 'exam' ? 'edureach_exams' : 'edureach_deadlines';
    const columns = type === 'exam'
      ? 'id,title,description,starts_at,ends_at,location,priority,status,created_at'
      : 'id,title,description,due_at,priority,status,created_at';
    const { data, error } = await supabase.from(table).select(columns).order(type === 'exam' ? 'starts_at' : 'due_at', { ascending: true }).limit(200);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin calendar list error:', error);
    res.status(503).json({ error: 'Unable to load calendar items.' });
  }
});

function validateCalendarPayload(body: any, type: string): { error?: string; values?: Record<string, unknown> } {
  const title = String(body?.title || '').trim().slice(0, 200);
  if (!title) return { error: 'A title is required.' };
  const values: Record<string, unknown> = {
    title,
    description: String(body?.description || '').trim().slice(0, 20000) || null,
    priority: CALENDAR_PRIORITIES.includes(String(body?.priority || 'normal')) ? String(body?.priority || 'normal') : 'normal',
    status: CALENDAR_STATUSES.includes(String(body?.status || 'pending')) ? String(body?.status || 'pending') : 'pending',
  };
  if (type === 'exam') {
    const startsAt = new Date(String(body?.starts_at || ''));
    if (!Number.isFinite(startsAt.getTime())) return { error: 'A valid start date/time is required.' };
    values.starts_at = startsAt.toISOString();
    if (body?.ends_at) {
      const endsAt = new Date(String(body.ends_at));
      if (!Number.isFinite(endsAt.getTime())) return { error: 'The end date/time is invalid.' };
      values.ends_at = endsAt.toISOString();
    } else {
      values.ends_at = null;
    }
    values.location = String(body?.location || '').trim().slice(0, 200) || null;
  } else {
    const dueAt = new Date(String(body?.due_at || ''));
    if (!Number.isFinite(dueAt.getTime())) return { error: 'A valid due date/time is required.' };
    values.due_at = dueAt.toISOString();
  }
  return { values };
}

app.post('/api/admin/calendar-items', requireCapability('calendar.create'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const type = String(req.query.type || 'deadline');
    if (!['deadline', 'exam'].includes(type)) return res.status(400).json({ error: 'Invalid calendar item type.' });
    const check = validateCalendarPayload(req.body, type);
    if (check.error || !check.values) return res.status(400).json({ error: check.error });
    const supabase = getServerSupabase();
    const table = type === 'exam' ? 'edureach_exams' : 'edureach_deadlines';
    const { data, error } = await supabase.from(table).insert(check.values).select('*').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'create', p_entity_type: type === 'exam' ? 'edureach_exam' : 'edureach_deadline', p_entity_id: data.id, p_metadata: { title: data.title } });
    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Admin calendar create error:', error);
    res.status(500).json({ error: 'Unable to create the calendar item.' });
  }
});

app.patch('/api/admin/calendar-items/:itemId', requireCapability('calendar.update'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const type = String(req.query.type || 'deadline');
    if (!['deadline', 'exam'].includes(type)) return res.status(400).json({ error: 'Invalid calendar item type.' });
    const check = validateCalendarPayload(req.body, type);
    if (check.error || !check.values) return res.status(400).json({ error: check.error });
    const supabase = getServerSupabase();
    const table = type === 'exam' ? 'edureach_exams' : 'edureach_deadlines';
    const { data, error } = await supabase.from(table).update(check.values).eq('id', req.params.itemId).select('*').single();
    if (error || !data) return res.status(404).json({ error: 'Calendar item not found.' });
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'update', p_entity_type: type === 'exam' ? 'edureach_exam' : 'edureach_deadline', p_entity_id: data.id, p_metadata: { title: data.title } });
    res.json({ item: data });
  } catch (error) {
    console.error('Admin calendar update error:', error);
    res.status(500).json({ error: 'Unable to update the calendar item.' });
  }
});

app.delete('/api/admin/calendar-items/:itemId', requireCapability('calendar.delete'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const type = String(req.query.type || 'deadline');
    if (!['deadline', 'exam'].includes(type)) return res.status(400).json({ error: 'Invalid calendar item type.' });
    const supabase = getServerSupabase();
    const table = type === 'exam' ? 'edureach_exams' : 'edureach_deadlines';
    const { data, error } = await supabase.from(table).delete().eq('id', req.params.itemId).select('id,title').single();
    if (error || !data) return res.status(404).json({ error: 'Calendar item not found.' });
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'delete', p_entity_type: type === 'exam' ? 'edureach_exam' : 'edureach_deadline', p_entity_id: data.id, p_metadata: { title: data.title } });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin calendar delete error:', error);
    res.status(500).json({ error: 'Unable to delete the calendar item.' });
  }
});

// --- Institutions (School Finder catalogue) --------------------------------

function validateInstitutionPayload(body: any): { error?: string; values?: Record<string, unknown> } {
  const schoolName = String(body?.school_name || '').trim().slice(0, 200);
  if (!schoolName) return { error: 'The institution name is required.' };

  function httpsUrl(value: unknown, label: string): string | null {
    if (!value) return null;
    const raw = String(value).trim();
    try {
      const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      if (parsed.protocol !== 'https:') throw new Error('protocol');
      return parsed.toString();
    } catch {
      throw new Error(`The ${label} must be a valid HTTPS URL.`);
    }
  }

  try {
    return {
      values: {
        school_name: schoolName,
        acronym: String(body?.acronym || '').trim().slice(0, 40) || null,
        slug: String(body?.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || null,
        state: String(body?.state || '').trim().slice(0, 60) || null,
        institution_type: String(body?.institution_type || '').trim().slice(0, 60) || null,
        website_url: httpsUrl(body?.website_url, 'website URL'),
        admission_portal_url: httpsUrl(body?.admission_portal_url, 'admission portal URL'),
        student_portal_url: httpsUrl(body?.student_portal_url, 'student portal URL'),
        is_verified: Boolean(body?.is_verified),
      },
    };
  } catch (error) {
    return { error: publicErrorMessage(error, 'Invalid institution data.') };
  }
}

app.get('/api/admin/institutions', requireCapability('institution.read'), async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const supabase = getServerSupabase();
    let query = supabase.from('institutions').select('id,school_name,acronym,slug,state,institution_type,website_url,admission_portal_url,student_portal_url,is_verified,created_at,updated_at').order('school_name', { ascending: true }).limit(500);
    if (search) {
      const safe = search.replace(/[%,_]/g, '');
      if (safe) query = query.or(`school_name.ilike.%${safe}%,acronym.ilike.%${safe}%,state.ilike.%${safe}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin institutions list error:', error);
    res.status(503).json({ error: 'Unable to load institutions.' });
  }
});

app.post('/api/admin/institutions', requireCapability('institution.create'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const check = validateInstitutionPayload(req.body);
    if (check.error || !check.values) return res.status(400).json({ error: check.error });
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('institutions').insert(check.values).select('id,school_name,acronym,state,institution_type,website_url,created_at').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'create', p_entity_type: 'institution', p_entity_id: data.id, p_metadata: { title: data.school_name } });
    await recordAudit(supabase, { actorId: adminUser.id, action: 'create', resourceType: 'institution', resourceId: data.id, metadata: { school_name: data.school_name } });
    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Admin institution create error:', error);
    res.status(500).json({ error: 'Unable to create the institution.' });
  }
});

app.patch('/api/admin/institutions/:institutionId', requireCapability('institution.update'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const check = validateInstitutionPayload(req.body);
    if (check.error || !check.values) return res.status(400).json({ error: check.error });
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('institutions').update(check.values).eq('id', req.params.institutionId).select('id,school_name,acronym,state,institution_type,website_url,created_at').single();
    if (error || !data) return res.status(404).json({ error: 'Institution not found.' });
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'update', p_entity_type: 'institution', p_entity_id: data.id, p_metadata: { title: data.school_name } });
    await recordAudit(supabase, { actorId: adminUser.id, action: 'update', resourceType: 'institution', resourceId: data.id, metadata: { school_name: data.school_name } });
    res.json({ item: data });
  } catch (error) {
    console.error('Admin institution update error:', error);
    res.status(500).json({ error: 'Unable to update the institution.' });
  }
});

app.delete('/api/admin/institutions/:institutionId', requireCapability('institution.delete'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('institutions').delete().eq('id', req.params.institutionId).select('id,school_name').single();
    if (error || !data) return res.status(404).json({ error: 'Institution not found.' });
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'delete', p_entity_type: 'institution', p_entity_id: data.id, p_metadata: { title: data.school_name } });
    await recordAudit(supabase, { actorId: adminUser.id, action: 'delete', resourceType: 'institution', resourceId: data.id, metadata: { school_name: data.school_name } });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin institution delete error:', error);
    res.status(500).json({ error: 'Unable to delete the institution.' });
  }
});

// --- Service catalogue visibility/content ----------------------------------

app.patch('/api/admin/services/:serviceId', requireCapability('service.update'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: service, error: serviceError } = await supabase.from('service_catalog').select('id,service_key,title,description,application_url,active').eq('id', req.params.serviceId).single();
    if (serviceError || !service) return res.status(404).json({ error: 'Service not found.' });
    // The catalogue is content-managed. All rows may be edited; the built-in
    // workflow rows only protect their code-owned destination fields.
    const update: Record<string, unknown> = {};
    if (req.body?.title !== undefined) {
      const title = String(req.body.title).trim().slice(0, 120);
      if (!title) return res.status(400).json({ error: 'The service title cannot be empty.' });
      update.title = title;
    }
    if (req.body?.description !== undefined) update.description = String(req.body.description).trim().slice(0, 600) || null;
    if (req.body?.application_url !== undefined) update.application_url = safeContentUrl(req.body.application_url);
    if (req.body?.route !== undefined) {
      const route = validateServiceRoute(req.body.route);
      if (route === 'invalid') return res.status(400).json({ error: 'The route must be a site-relative path like /schools.' });
      update.route = route;
    }
    if (req.body?.category !== undefined) update.category = String(req.body.category).trim().slice(0, 60) || null;
    if (req.body?.sort_order !== undefined) {
      const sort = Number(req.body.sort_order);
      if (!Number.isFinite(sort)) return res.status(400).json({ error: 'Sort order must be a number.' });
      update.sort_order = Math.round(sort);
    }
    if (req.body?.active !== undefined) update.active = Boolean(req.body.active);
    if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to update.' });
    const { data, error } = await supabase.from('service_catalog').update(update).eq('id', service.id).select(serviceCatalogSelect).single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'update', p_entity_type: 'service_catalog', p_entity_id: service.id, p_metadata: { key: service.service_key, active: data.active } });
    res.json({ item: data });
  } catch (error) {
    console.error('Admin service update error:', error);
    res.status(500).json({ error: 'Unable to update the service.' });
  }
});

const FORM_SERVICE_KEYS: ReadonlySet<string> = new Set(LIVE_SERVICE_KEYS);

function validateServiceRoute(value: unknown): string | null | 'invalid' {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes(' ')) return 'invalid';
  return raw.slice(0, 200);
}

app.get('/api/admin/services', requireCapability('service.read'), async (_req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('service_catalog')
      .select(serviceCatalogSelect)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true })
      .limit(300);
    if (error) throw error;
    res.json({ items: (data || []).map((row) => ({ ...row, is_form_service: FORM_SERVICE_KEYS.has(row.service_key) })) });
  } catch (error) {
    console.error('Admin services list error:', error);
    res.status(503).json({ error: 'Unable to load the service catalogue.' });
  }
});

app.post('/api/admin/services', requireCapability('service.create'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const title = String(req.body?.title || '').trim().slice(0, 120);
    if (!title) return res.status(400).json({ error: 'A service title is required.' });
    const serviceKey = slugifyTitle(String(req.body?.service_key || title)).slice(0, 60);
    if (FORM_SERVICE_KEYS.has(serviceKey)) return res.status(400).json({ error: 'This key belongs to a built-in application form service.' });
    const route = validateServiceRoute(req.body?.route);
    if (route === 'invalid') return res.status(400).json({ error: 'The route must be a site-relative path like /schools.' });
    const applicationUrl = safeContentUrl(req.body?.application_url);
    if (req.body?.application_url && !applicationUrl) return res.status(400).json({ error: 'External links must use HTTPS.' });
    const supabase = getServerSupabase();
    const { data: existing } = await supabase.from('service_catalog').select('id').eq('service_key', serviceKey).maybeSingle();
    if (existing) return res.status(409).json({ error: 'A service with this key already exists.' });
    const { data, error } = await supabase.from('service_catalog').insert({
      service_key: serviceKey,
      title,
      description: String(req.body?.description || '').trim().slice(0, 600) || null,
      application_url: applicationUrl,
      route,
      category: String(req.body?.category || '').trim().slice(0, 60) || 'Services',
      sort_order: Number.isFinite(Number(req.body?.sort_order)) ? Number(req.body.sort_order) : 100,
      active: req.body?.active !== false,
      amount_kobo: 0,
    }).select(serviceCatalogSelect).single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'create', p_entity_type: 'service_catalog', p_entity_id: data.id, p_metadata: { key: data.service_key } });
    res.status(201).json({ item: { ...data, is_form_service: false } });
  } catch (error) {
    console.error('Admin service create error:', error);
    res.status(500).json({ error: 'Unable to create the service.' });
  }
});

app.delete('/api/admin/services/:serviceId', requireCapability('service.delete'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: service, error: serviceError } = await supabase.from('service_catalog').select('id,service_key,title').eq('id', req.params.serviceId).single();
    if (serviceError || !service) return res.status(404).json({ error: 'Service not found.' });
    if (FORM_SERVICE_KEYS.has(service.service_key)) {
      return res.status(400).json({ error: 'Built-in application form services cannot be deleted — deactivate them instead.' });
    }
    const { error } = await supabase.from('service_catalog').delete().eq('id', service.id);
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'delete', p_entity_type: 'service_catalog', p_entity_id: service.id, p_metadata: { key: service.service_key } });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin service delete error:', error);
    res.status(500).json({ error: 'Unable to delete the service.' });
  }
});

// --- Opportunities (scholarships / grants / jobs) ---------------------------

const OPPORTUNITY_CATEGORIES = ['scholarship', 'grant', 'job', 'fellowship', 'competition'];

function normalizeOpportunityArray(value: unknown, maxItems = 12, maxLength = 80): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .map((item) => String(item || '').trim().slice(0, maxLength))
    .filter(Boolean)
  )).slice(0, maxItems);
}

function validateOpportunityPayload(body: any): { error?: string; values?: Record<string, unknown> } {
  const title = String(body?.title || '').trim().slice(0, 200);
  if (!title) return { error: 'A title is required.' };
  const category = String(body?.category || 'scholarship');
  if (!OPPORTUNITY_CATEGORIES.includes(category)) return { error: 'Invalid opportunity category.' };
  let linkUrl: string | null = null;
  if (body?.link_url) {
    linkUrl = safeContentUrl(body.link_url);
    if (!linkUrl) return { error: 'The link must use HTTPS.' };
  }
  let deadline: string | null = null;
  if (body?.deadline) {
    const parsed = new Date(String(body.deadline));
    if (!Number.isFinite(parsed.getTime())) return { error: 'The deadline date is invalid.' };
    deadline = parsed.toISOString().slice(0, 10);
  }
  const workMode = body?.work_mode ? String(body.work_mode).trim().slice(0, 40) : null;
  if (workMode && !['remote', 'hybrid', 'onsite', 'not-specified'].includes(workMode)) {
    return { error: 'Invalid work mode.' };
  }
  return {
    values: {
      title,
      organisation: String(body?.organisation || '').trim().slice(0, 160) || null,
      category,
      subcategory: String(body?.subcategory || '').trim().slice(0, 100) || null,
      description: String(body?.description || '').trim() || null,
      link_url: linkUrl,
      deadline,
      locations: String(body?.locations || '').trim().slice(0, 160) || null,
      eligibility: String(body?.eligibility || '').trim().slice(0, 1000) || null,
      education_levels: normalizeOpportunityArray(body?.education_levels),
      disciplines: normalizeOpportunityArray(body?.disciplines),
      work_mode: workMode,
      is_featured: Boolean(body?.is_featured),
      is_active: body?.is_active === undefined ? true : Boolean(body.is_active),
    },
  };
}

app.get('/api/opportunities', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('opportunities')
      .select('id,title,organisation,category,subcategory,description,link_url,deadline,locations,last_verified_at,source_name,eligibility,education_levels,disciplines,work_mode,is_featured')
      .eq('is_active', true)
      .is('closed_at', null)
      .order('is_featured', { ascending: false })
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(300);
    if (error) throw error;

    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || 'all').trim().toLowerCase();
    const education = String(req.query.education || '').trim().toLowerCase();
    const discipline = String(req.query.discipline || '').trim().toLowerCase();
    const workMode = String(req.query.work_mode || '').trim().toLowerCase();
    const featuredOnly = String(req.query.featured || '') === 'true';

    const items = (data || []).filter((item: any) => {
      const haystack = [item.title, item.organisation, item.description, item.locations, item.eligibility, item.subcategory, ...(item.education_levels || []), ...(item.disciplines || [])].join(' ').toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (category !== 'all' && category !== item.category) return false;
      if (education && !(item.education_levels || []).some((value: string) => value.toLowerCase() === education)) return false;
      if (discipline && !(item.disciplines || []).some((value: string) => value.toLowerCase() === discipline)) return false;
      if (workMode && workMode !== item.work_mode) return false;
      if (featuredOnly && !item.is_featured) return false;
      return true;
    });

    res.json({ items });
  } catch (error) {
    console.error('Opportunities API error:', error);
    res.status(503).json({ error: 'Opportunities are temporarily unavailable.' });
  }
});

app.get('/api/admin/opportunities', requireCapability('opportunity.read'), async (_req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('opportunities')
      .select('id,title,organisation,category,subcategory,description,link_url,deadline,locations,eligibility,education_levels,disciplines,work_mode,is_featured,is_active,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(300);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin opportunities list error:', error);
    res.status(503).json({ error: 'Unable to load opportunities.' });
  }
});

app.post('/api/admin/opportunities', requireCapability('opportunity.create'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const check = validateOpportunityPayload(req.body);
    if (check.error || !check.values) return res.status(400).json({ error: check.error });
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('opportunities').insert(check.values).select('id,title,organisation,category,description,link_url,deadline,locations,is_active,created_at,updated_at').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'create', p_entity_type: 'opportunity', p_entity_id: data.id, p_metadata: { title: data.title } });
    await recordAudit(supabase, { actorId: adminUser.id, action: 'create', resourceType: 'opportunity', resourceId: data.id, metadata: { title: data.title } });
    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Admin opportunity create error:', error);
    res.status(500).json({ error: 'Unable to create the opportunity.' });
  }
});

app.patch('/api/admin/opportunities/:opportunityId', requireCapability('opportunity.update'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const check = validateOpportunityPayload(req.body);
    if (check.error || !check.values) return res.status(400).json({ error: check.error });
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('opportunities').update({ ...check.values, updated_at: new Date().toISOString() }).eq('id', req.params.opportunityId).select('id,title,organisation,category,description,link_url,deadline,locations,is_active,created_at,updated_at').single();
    if (error || !data) return res.status(404).json({ error: 'Opportunity not found.' });
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'update', p_entity_type: 'opportunity', p_entity_id: data.id, p_metadata: { title: data.title } });
    await recordAudit(supabase, { actorId: adminUser.id, action: 'update', resourceType: 'opportunity', resourceId: data.id, metadata: { title: data.title } });
    res.json({ item: data });
  } catch (error) {
    console.error('Admin opportunity update error:', error);
    res.status(500).json({ error: 'Unable to update the opportunity.' });
  }
});

app.delete('/api/admin/opportunities/:opportunityId', requireCapability('opportunity.delete'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('opportunities').delete().eq('id', req.params.opportunityId).select('id,title').single();
    if (error || !data) return res.status(404).json({ error: 'Opportunity not found.' });
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'delete', p_entity_type: 'opportunity', p_entity_id: data.id, p_metadata: { title: data.title } });
    await recordAudit(supabase, { actorId: adminUser.id, action: 'delete', resourceType: 'opportunity', resourceId: data.id, metadata: { title: data.title } });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin opportunity delete error:', error);
    res.status(500).json({ error: 'Unable to delete the opportunity.' });
  }
});

// --- Account suspension (Supabase Auth admin ban via service role) ---------

app.post('/api/admin/users/:userId/ban', requireCapability('user.suspend'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    if (adminUser.id === req.params.userId) return res.status(400).json({ error: 'You cannot suspend your own account.' });
    const supabase = getServerSupabase();
    const { data, error } = await supabase.auth.admin.updateUserById(req.params.userId, { ban_duration: '876000h' });
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'user_ban', p_entity_type: 'auth_user', p_entity_id: req.params.userId, p_metadata: { email: data.user?.email || null } });
    res.json({ success: true, suspended: true });
  } catch (error) {
    console.error('Admin user ban error:', error);
    res.status(500).json({ error: 'Unable to suspend the account.' });
  }
});

app.post('/api/admin/users/:userId/unban', requireCapability('user.suspend'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { error } = await supabase.auth.admin.updateUserById(req.params.userId, { ban_duration: 'none' });
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'user_unban', p_entity_type: 'auth_user', p_entity_id: req.params.userId, p_metadata: {} });
    res.json({ success: true, suspended: false });
  } catch (error) {
    console.error('Admin user unban error:', error);
    res.status(500).json({ error: 'Unable to unsuspend the account.' });
  }
});


// --- Role assignment -------------------------------------------------------
// The capability vocabulary lives in code (src/lib/capabilities.ts); this
// endpoint is how a stored role changes. It is `user.manage_roles`, it refuses
// unknown values and self-modification, and every change is audited.
const ASSIGNABLE_ROLES = ['student', 'content_editor', 'service_admin', 'super_admin'] as const;

app.post('/api/admin/users/:userId/role', requireCapability('user.manage_roles'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const role = String(req.body?.role || '').trim().toLowerCase();
    if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) {
      return res.status(400).json({ error: 'Unknown role.' });
    }
    // An owner locking themselves out of the console is never intentional.
    if (adminUser.id === req.params.userId) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }
    const supabase = getServerSupabase();
    const { data: target, error: readError } = await supabase
      .from('profiles')
      .select('id,role,full_name')
      .eq('id', req.params.userId)
      .maybeSingle();
    if (readError) throw readError;
    if (!target) return res.status(404).json({ error: 'Account not found.' });

    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', req.params.userId)
      .select('id,role')
      .single();
    if (error) throw error;

    await recordAudit(supabase, {
      actorId: adminUser.id,
      action: 'user_role_change',
      resourceType: 'profile',
      resourceId: req.params.userId,
      // The previous role is recorded; the account email is not.
      metadata: { from: String(target.role || ''), to: role },
    });
    res.json({ user: { id: data.id, role: data.role } });
  } catch (error) {
    console.error('Admin role change error:', error);
    res.status(500).json({ error: 'Unable to change this account role.' });
  }
});

// --- Content image uploads (Supabase Storage, admin-content bucket) --------

const UPLOAD_MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

app.post('/api/admin/uploads', rateLimitFor(RATE_LIMIT_RULES.adminUpload), requireCapability('news.create', 'opportunity.create', 'institution.update', 'calendar.update'), express.json({ limit: '5mb' }), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const dataUrl = String(req.body?.dataUrl || '');
    const match = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
    if (!match) return res.status(400).json({ error: 'Only PNG, JPEG, WebP or GIF images are supported.' });
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'The uploaded image is empty.' });
    if (buffer.length > 2 * 1024 * 1024) return res.status(413).json({ error: 'Images must be 2 MB or smaller.' });
    const supabase = getServerSupabase();
    const objectPath = `${new Date().toISOString().slice(0, 10)}/${adminUser.id.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('admin-content').upload(objectPath, buffer, {
      contentType: UPLOAD_MIME_BY_EXT[ext],
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('admin-content').getPublicUrl(objectPath);
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'upload', p_entity_type: 'storage_object', p_entity_id: null, p_metadata: { path: objectPath, bytes: buffer.length } });
    res.status(201).json({ url: data.publicUrl, path: objectPath, bytes: buffer.length });
  } catch (error) {
    console.error('Admin upload error:', error);
    res.status(500).json({ error: 'Unable to upload the image.' });
  }
});

app.post('/api/admin/session/verify', requireStaff, (_req, res) => {
  res.json({ authenticated: true });
});

const serviceCatalogSelect = 'id,service_key,title,description,application_url,route,category,sort_order,active';

app.get('/api/services', async (_req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    // The full active catalogue: form services, in-app routes and external
    // links, in admin-controlled order. Cards route themselves by key/url.
    const { data, error } = await supabase
      .from('service_catalog')
      .select(serviceCatalogSelect)
      .eq('active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true });
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Services API error:', error);
    res.status(503).json({ error: 'Services are temporarily unavailable.' });
  }
});

app.get('/api/services/:slug', async (req, res) => {
  const slug = req.params.slug.trim().toLowerCase();
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'Service catalog is not configured.' });
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('service_catalog')
      .select(serviceCatalogSelect)
      .eq('service_key', slug)
      .eq('active', true)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Service not found.' });
    res.json({ item: data });
  } catch (error) {
    console.error('Service API error:', error);
    res.status(503).json({ error: 'Service is temporarily unavailable.' });
  }
});

app.get('/api/upcoming', async (_req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    const [deadlinesResult, examsResult] = await Promise.all([
      supabase
        .from('edureach_deadlines')
        .select('id,title,description,due_at,priority')
        .is('institution_id', null)
        .is('user_id', null)
        .eq('status', 'pending')
        .gte('due_at', new Date().toISOString())
        .order('due_at', { ascending: true })
        .limit(8),
      supabase
        .from('edureach_exams')
        .select('id,title,description,starts_at,ends_at,location,priority')
        .is('institution_id', null)
        .is('user_id', null)
        .eq('status', 'pending')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(8),
    ]);

    if (deadlinesResult.error) throw deadlinesResult.error;
    if (examsResult.error) throw examsResult.error;

    const items = [
      ...(deadlinesResult.data || []).map((item) => ({ ...item, kind: 'deadline' as const, starts_at: null, location: null })),
      ...(examsResult.data || []).map((item) => ({ ...item, kind: 'exam' as const, due_at: null })),
    ].sort((a, b) => {
      const aDate = new Date(a.due_at || a.starts_at || 0).getTime();
      const bDate = new Date(b.due_at || b.starts_at || 0).getTime();
      return aDate - bDate;
    }).slice(0, 10);

    res.json({ items });
  } catch (error) {
    console.error('Upcoming API error:', error);
    res.status(503).json({ error: 'Upcoming items are temporarily unavailable.' });
  }
});

/**
 * News reads. The provenance/freshness columns arrive with the newsroom
 * migration, so the query degrades to the legacy column set when a database
 * has not been migrated yet — the site keeps serving either way.
 */
const NEWS_ROW_BASE = 'id,slug,title,excerpt,body,category,image_url,source_name,source_url,published_at,updated_at,published,featured,tags';
const NEWS_ROW_GOVERNED = `${NEWS_ROW_BASE},verification_status,expires_at,last_verified_at,source_key,source_tier`;
// NEWS-1: the database-derived canonical slug. Requested with the governed set so
// a migrated database answers a category filter with an index lookup; a
// pre-migration database falls back to the legacy columns and the client applies
// the same rule locally.
const NEWS_ROW_CATEGORISED = `${NEWS_ROW_GOVERNED},category_slug`;

function newsArticleView(item: Record<string, unknown>) {
  const expiresAt = item.expires_at ? new Date(String(item.expires_at)) : null;
  const expiredByDate = expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now();
  return {
    ...item,
    author: item.source_name || 'EduReach Editorial Desk',
    summary: item.excerpt,
    last_verified_at: item.last_verified_at || item.updated_at,
    verification_status: expiredByDate ? 'expired' : (item.verification_status || 'verified'),
    priority: 'normal',
    category_slug: item.category_slug || String(item.category || 'general').trim().toLowerCase(),
  };
}

function isFreshArticle(item: Record<string, unknown>): boolean {
  if (item.verification_status === 'expired' || item.verification_status === 'archived') return false;
  if (!item.expires_at) return true;
  const expiresAt = new Date(String(item.expires_at));
  return !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() > Date.now();
}

app.get('/api/news', async (_req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    let data: any = null;
    let error: any = null;
    ({ data, error } = await supabase.from('news_articles')
      .select(NEWS_ROW_CATEGORISED)
      .eq('published', true).order('published_at', { ascending: false, nullsFirst: false }).limit(40));
    if (error) {
      // Pre-NEWS-1 database: retry without the derived column.
      ({ data, error } = await supabase.from('news_articles')
        .select(NEWS_ROW_GOVERNED)
        .eq('published', true).order('published_at', { ascending: false, nullsFirst: false }).limit(40));
    }
    if (error) {
      // Pre-newsroom database: fall back to the legacy column set.
      const fallback = await supabase.from('news_articles')
        .select(NEWS_ROW_BASE)
        .eq('published', true).order('published_at', { ascending: false, nullsFirst: false }).limit(30);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    res.json({ items: (data || []).filter(isFreshArticle).slice(0, 30).map(newsArticleView) });
  } catch (error) {
    console.error('News API error:', error);
    res.status(503).json({ error: 'News service is temporarily unavailable.' });
  }
});

app.get('/api/news/:slug', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'News content is not configured.' });
  try {
    const supabase = getServerSupabase();
    let data: any = null;
    let error: any = null;
    ({ data, error } = await supabase.from('news_articles')
      .select(NEWS_ROW_GOVERNED)
      .eq('slug', req.params.slug).eq('published', true).maybeSingle());
    if (error) {
      const fallback = await supabase.from('news_articles')
        .select(NEWS_ROW_BASE)
        .eq('slug', req.params.slug).eq('published', true).maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }
    if (error || !data) return res.status(404).json({ error: 'News article not found.' });
    // An expired article stays readable by direct link, but is presented as
    // expired so the student is not misled by stale deadlines.
    res.json({ item: newsArticleView(data) });
  } catch (error) {
    console.error('News article API error:', error);
    res.status(503).json({ error: 'News service is temporarily unavailable.' });
  }
});

function normalizeSubjectKey(value: unknown): string {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'use of english' || s === 'english language' || s === 'english') return 'english';
  return s;
}

function selectCbtPaperQuestions(rows: any[], subjects: string[]) {
  const requested = Array.from(new Set((subjects || []).map((value) => String(value).trim()).filter(Boolean)));
  if (!requested.length) return rows.map((row, index) => ({ ...row, position: index + 1 }));
  const paper: any[] = [];
  const usedKeys = new Set<string>();
  for (const subject of requested) {
    const norm = normalizeSubjectKey(subject);
    if (usedKeys.has(norm)) continue;
    usedKeys.add(norm);
    const limit = norm === 'english' ? 60 : 40;
    const matches = rows.filter((row) => normalizeSubjectKey(row.subject) === norm).slice(0, limit);
    paper.push(...matches);
  }
  if (!paper.length && rows.length) {
    return rows.slice(0, 60).map((row, index) => ({ ...row, position: index + 1 }));
  }
  return paper.map((row, index) => ({ ...row, position: index + 1 }));
}

app.get('/api/cbt/exams', async (_req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('cbt_exams')
      .select('id,title,exam_body,subject,description,duration_minutes')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Availability is stated up front, so a student never has to complete a setup
    // wizard to discover that a bank has no questions for a subject they want.
    const exams = data || [];
    const counts = new Map<string, { questions: number; subjects: Set<string> }>();
    if (exams.length) {
      const { data: questionRows } = await supabase
        .from('exam_questions')
        .select('exam_id,subject')
        .in('exam_id', exams.map((exam) => exam.id));
      for (const row of questionRows || []) {
        const key = String((row as { exam_id: string }).exam_id);
        const entry = counts.get(key) || { questions: 0, subjects: new Set<string>() };
        entry.questions += 1;
        const subject = String((row as { subject?: string }).subject || '').trim();
        if (subject) entry.subjects.add(subject.toLowerCase());
        counts.set(key, entry);
      }
    }

    res.json({
      items: exams.map((exam) => {
        const entry = counts.get(exam.id);
        return {
          ...exam,
          question_count: entry?.questions ?? 0,
          subject_count: entry?.subjects.size ?? 0,
        };
      }),
    });
  } catch (error) {
    console.error('CBT exams list API error:', error);
    res.status(503).json({ error: 'CBT exams are temporarily unavailable.' });
  }
});

/**
 * Mark an attempt expired after the database refused it for being out of time.
 *
 * The RPCs raise on expiry (a raise rolls back every write in the same call, so
 * they cannot persist the status themselves). By the time this runs the RPC has
 * already proved the attempt belongs to the caller, and the update is filtered by
 * `user_id` as well, so it can never touch another student's row.
 */
async function expireCbtAttempt(attemptId: string, userId: string): Promise<void> {
  if (!attemptId || !userId) return;
  try {
    const supabase = getServerSupabase();
    await supabase
      .from('cbt_attempts')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', attemptId)
      .eq('user_id', userId)
      .eq('status', 'in_progress');
  } catch (error) {
    console.warn('CBT expiry marking failed:', error);
  }
}

/**
 * Subject availability for one bank, from the real question data.
 *
 * The setup wizard used to offer a static subject catalogue, so a student could
 * configure a session the bank could not serve and only find out when the paper
 * failed to start ("This CBT is not ready yet"). This endpoint is the list the
 * wizard renders and the limit the server will enforce, in one response.
 */
app.get('/api/cbt/exams/:examId/subjects', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'CBT question bank is not configured.' });
  try {
    const supabase = getServerSupabase();
    const { data: exam, error: examError } = await supabase
      .from('cbt_exams')
      .select('id,title,exam_body,subject,description,duration_minutes,is_active')
      .eq('id', req.params.examId)
      .eq('is_active', true)
      .maybeSingle();
    if (examError || !exam) return res.status(404).json({ error: 'CBT exam not found.' });

    const { data: subjects, error: subjectError } = await supabase.rpc('cbt_subject_availability', {
      p_exam_id: exam.id,
    });
    if (subjectError) throw subjectError;

    const { data: limits, error: limitsError } = await supabase.rpc('cbt_limits');
    if (limitsError) throw limitsError;

    const available = (subjects || []) as Array<{ subject: string; question_count: number }>;
    res.json({
      exam: {
        id: exam.id,
        title: exam.title,
        examBody: exam.exam_body,
        subject: exam.subject,
        description: exam.description,
        defaultDurationMinutes: exam.duration_minutes,
      },
      subjects: available.map((row) => ({ subject: row.subject, questionCount: Number(row.question_count) })),
      totalQuestions: available.reduce((sum, row) => sum + Number(row.question_count), 0),
      limits: limits || null,
    });
  } catch (error) {
    console.error('CBT subject availability error:', error);
    res.status(503).json({ error: 'CBT subjects are temporarily unavailable.' });
  }
});

/**
 * Start (or resume) a configured attempt.
 *
 * The body is a *request*, not a decision: the database validates the subjects
 * against the real bank, derives the mock duration from the exam configuration,
 * plans the paper, freezes it and returns what was actually created — including
 * `resumed: true` when an identical unfinished session already existed.
 */
app.post('/api/cbt/exams/:examId/attempts', rateLimitFor(RATE_LIMIT_RULES.cbtStart), async (req, res) => {
  try {
    const { rpcSupabase } = await requireUser(req, 'cbt.attempt');
    const mode = String(req.body?.mode || 'practice').trim().toLowerCase();
    const subjects = Array.isArray(req.body?.subjects)
      ? req.body.subjects.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];
    const questionCount = req.body?.questionCount === undefined || req.body?.questionCount === null
      ? null
      : Number(req.body.questionCount);
    const durationMinutes = req.body?.durationMinutes === undefined || req.body?.durationMinutes === null
      ? null
      : Number(req.body.durationMinutes);
    const programme = req.body?.programme ? String(req.body.programme).trim().slice(0, 160) : null;

    if (questionCount !== null && (!Number.isInteger(questionCount) || questionCount < 1)) {
      return res.status(400).json({ error: 'Choose how many questions you want.' });
    }
    if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1)) {
      return res.status(400).json({ error: 'Choose how long you want to practise for.' });
    }

    const { data, error } = await rpcSupabase.rpc('start_cbt_attempt_configured', {
      p_exam_id: req.params.examId,
      p_subjects: subjects,
      p_question_count: questionCount,
      p_duration_minutes: durationMinutes,
      p_mode: mode,
      p_programme: programme,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, any> | null;
    if (!row) return res.status(409).json({ error: 'The practice session could not be created. Please try again.' });

    res.status(row.resumed ? 200 : 201).json({
      attempt: {
        id: row.attempt_id,
        startedAt: row.started_at,
        expiresAt: row.expires_at,
        totalQuestions: row.total_questions,
        mode: row.mode,
        durationMinutes: row.duration_minutes,
        subjects: row.selected_subjects || [],
        plan: row.subject_plan || [],
        resumed: Boolean(row.resumed),
      },
    });
  } catch (error) {
    console.error('CBT start API error:', error);
    const message = error instanceof Error ? error.message : 'Unable to start this CBT exam.';
    const status = /Authentication|required|session/i.test(message) ? 401
      : /permission/i.test(message) ? 403
        : /not found/i.test(message) ? 404
          : /No questions are available|Choose at least one subject|Choose a duration|Use of English plus|A session can include|Unknown CBT mode/i.test(message) ? 422
            : 409;
    res.status(status).json({ error: publicErrorMessage(message, 'Unable to start this practice session. Please try again.') });
  }
});

/**
 * PQR-1 — the past-question resource library, read-only and public.
 *
 * The library is empty until staff publish a paper that they have verified, and
 * this endpoint says exactly that instead of implying documents exist. When a
 * row is hosted by EduReach, the private `resource-files` copy is opened with a
 * short-lived signed URL, and only then: a row the server cannot sign is
 * reported as unavailable rather than shown as a working download.
 */
app.get('/api/past-questions/resources', async (req, res) => {
  if (!isServerSupabaseConfigured()) {
    return res.json({ items: [], coverage: [], configured: false, state: 'not-configured' });
  }
  try {
    const supabase = getServerSupabase();
    const exam = String(req.query.exam || '').trim().toUpperCase();
    const subject = String(req.query.subject || '').trim();
    const institution = String(req.query.institution || '').trim();

    let query = supabase
      .from('past_question_resources')
      .select('id,exam_body,institution_id,subject,course,paper_year,title,description,source_name,source_url,storage_path,access,verified_at')
      .eq('published', true)
      .not('verified_at', 'is', null)
      .order('paper_year', { ascending: false, nullsFirst: false })
      .limit(200);
    if (exam) query = query.ilike('exam_body', exam);
    if (subject) query = query.ilike('subject', subject);
    if (institution) query = query.eq('institution_id', institution);

    const { data, error } = await query;
    if (error) throw error;

    const items = await Promise.all((data || []).map(async (row: Record<string, any>) => {
      let signedUrl: string | null = null;
      if (row.storage_path) {
        const { data: signed } = await supabase.storage.from('resource-files').createSignedUrl(row.storage_path, 300);
        signedUrl = signed?.signedUrl ?? null;
      }
      const href = signedUrl || row.source_url || null;
      return {
        id: row.id,
        examBody: row.exam_body,
        institutionId: row.institution_id,
        subject: row.subject,
        course: row.course,
        year: row.paper_year,
        title: row.title,
        description: row.description,
        sourceName: row.source_name,
        sourceUrl: row.source_url,
        // available  — a paper a student can open right now
        // external   — hosted elsewhere; the link leaves EduReach
        // unavailable— published, but neither copy can be opened
        state: href ? (signedUrl ? 'available' : 'external') : 'unavailable',
        access: row.access,
        href,
        verifiedAt: row.verified_at,
      };
    }));

    const { data: coverage } = await supabase.rpc('past_question_coverage', { p_exam_body: exam || null });
    res.json({
      items,
      coverage: coverage || [],
      configured: true,
      // The page needs to distinguish "nothing published yet" (an honest empty
      // state) from "the service could not answer" (an error state).
      state: items.length ? 'available' : 'not-published',
    });
  } catch (error) {
    console.error('Past-question resources API error:', error);
    res.status(503).json({ error: 'The resource library is temporarily unavailable.' });
  }
});

/** The frozen paper for one attempt, plus the student's saved draft. Owner only. */
app.get('/api/cbt/attempts/:attemptId/paper', async (req, res) => {
  try {
    const { supabase, rpcSupabase, user } = await requireUser(req, 'cbt.attempt');
    const { data: attemptRow, error: attemptError } = await supabase
      .from('cbt_attempts')
      .select('id,exam_id,status,started_at,expires_at,current_question,answers_draft,selected_subjects,mode,duration_minutes,programme,subject_plan,question_ids,cbt_exams(title,exam_body,subject)')
      .eq('id', req.params.attemptId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (attemptError || !attemptRow) return res.status(404).json({ error: 'CBT attempt not found.' });

    const { data: paper, error: paperError } = await rpcSupabase.rpc('get_cbt_attempt_paper', {
      p_attempt_id: req.params.attemptId,
    });
    if (paperError) throw paperError;

    const examMeta = (attemptRow as Record<string, any>).cbt_exams || {};
    res.json({
      // The server clock, so a device with the wrong time still shows the true
      // remaining time instead of extending or shortening the examination.
      serverTime: new Date().toISOString(),
      attempt: {
        id: attemptRow.id,
        examId: attemptRow.exam_id,
        status: attemptRow.status,
        startedAt: attemptRow.started_at,
        expiresAt: attemptRow.expires_at,
        mode: attemptRow.mode,
        durationMinutes: attemptRow.duration_minutes,
        programme: attemptRow.programme,
        subjects: attemptRow.selected_subjects || [],
        plan: attemptRow.subject_plan || [],
        totalQuestions: Array.isArray(attemptRow.question_ids) ? attemptRow.question_ids.length : 0,
        questionIndex: Number.isInteger(attemptRow.current_question) ? attemptRow.current_question : 0,
        savedAnswers: attemptRow.answers_draft || {},
        exam: {
          id: attemptRow.exam_id,
          title: examMeta.title || 'CBT practice',
          examBody: examMeta.exam_body || '',
          subject: examMeta.subject || '',
        },
      },
      questions: (paper || []).map((row: Record<string, any>) => ({
        position: row.position,
        subject: row.subject,
        id: row.question_id,
        text: row.question_text,
        options: [row.option_a, row.option_b, row.option_c, row.option_d],
      })),
    });
  } catch (error) {
    console.error('CBT paper API error:', error);
    const message = error instanceof Error ? error.message : 'Unable to load this CBT attempt.';
    const status = /Authentication|required|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 404;
    res.status(status).json({ error: publicErrorMessage(message, 'Unable to load this CBT attempt.') });
  }
});

/** Submit against the frozen paper. A retried submit returns the stored result. */
app.post('/api/cbt/attempts/:attemptId/submit', async (req, res) => {
  let callerId = '';
  try {
    const { rpcSupabase, user } = await requireUser(req, 'cbt.attempt');
    callerId = user.id;
    const answers = req.body?.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'Submit your answers with the attempt.' });
    }

    const { data, error } = await rpcSupabase.rpc('submit_cbt_attempt_configured', {
      p_attempt_id: req.params.attemptId,
      p_answers: answers,
    });
    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as Record<string, any> | null;
    if (!row) return res.status(409).json({ error: 'CBT submission did not produce a result.' });
    res.json({
      attemptId: row.attempt_id,
      score: Number(row.score),
      correctAnswers: Number(row.correct_answers),
      totalQuestions: Number(row.total_questions),
      breakdown: row.breakdown || [],
    });
  } catch (error) {
    console.error('CBT submit API error:', error);
    const message = error instanceof Error ? error.message : 'CBT submission failed.';
    if (/expired/i.test(message)) await expireCbtAttempt(req.params.attemptId, callerId);
    const status = /Authentication|required|session/i.test(message) ? 401
      : /permission/i.test(message) ? 403
        : /not found/i.test(message) ? 404
          : /expired|already/i.test(message) ? 409
            : 400;
    res.status(status).json({ error: publicErrorMessage(message, 'CBT submission failed. Please try again.') });
  }
});

/** Save in-progress answers and the current question so nothing is lost. */
app.patch('/api/cbt/attempts/:attemptId/draft', async (req, res) => {
  let callerId = '';
  try {
    const { rpcSupabase, user } = await requireUser(req, 'cbt.attempt');
    callerId = user.id;
    const answers = req.body?.answers;
    if (answers !== undefined && (answers === null || typeof answers !== 'object' || Array.isArray(answers))) {
      return res.status(400).json({ error: 'Answers must be an object.' });
    }
    const questionIndex = Number.isInteger(Number(req.body?.questionIndex)) ? Number(req.body.questionIndex) : null;

    const { data, error } = await rpcSupabase.rpc('save_cbt_attempt_draft', {
      p_attempt_id: req.params.attemptId,
      p_answers: answers || {},
      p_question_index: questionIndex,
    });
    if (error) throw error;
    res.json({ saved: true, ...(data as Record<string, unknown>) });
  } catch (error) {
    console.error('CBT draft API error:', error);
    const message = error instanceof Error ? error.message : 'Unable to save your progress.';
    if (/expired/i.test(message)) await expireCbtAttempt(req.params.attemptId, callerId);
    const status = /Authentication|required|session/i.test(message) ? 401
      : /permission/i.test(message) ? 403
        : /not found/i.test(message) ? 404
          : /expired|already/i.test(message) ? 409
            : 400;
    res.status(status).json({ error: publicErrorMessage(message, 'Unable to save your progress.') });
  }
});

/** Leave an active examination. Practice attempts can also be deleted outright. */
app.post('/api/cbt/attempts/:attemptId/abandon', async (req, res) => {
  try {
    const { rpcSupabase } = await requireUser(req, 'cbt.attempt');
    const { error } = await rpcSupabase.rpc('abandon_cbt_attempt', { p_attempt_id: req.params.attemptId });
    if (error) throw error;
    res.json({ abandoned: true });
  } catch (error) {
    console.error('CBT abandon API error:', error);
    const message = error instanceof Error ? error.message : 'Unable to end this attempt.';
    const status = /Authentication|required|session/i.test(message) ? 401
      : /permission/i.test(message) ? 403
        : /not found/i.test(message) ? 404
          : 409;
    res.status(status).json({ error: publicErrorMessage(message, 'Unable to end this attempt.') });
  }
});

/** Delete a practice attempt. Mock results are examination records and are refused. */
app.delete('/api/cbt/attempts/:attemptId', async (req, res) => {
  try {
    const { rpcSupabase } = await requireUser(req, 'cbt.attempt');
    const { data, error } = await rpcSupabase.rpc('delete_cbt_practice_attempt', { p_attempt_id: req.params.attemptId });
    if (error) throw error;
    res.json({ deleted: Boolean(data) });
  } catch (error) {
    console.error('CBT delete API error:', error);
    const message = error instanceof Error ? error.message : 'Unable to delete this practice attempt.';
    const status = /Authentication|required|session/i.test(message) ? 401
      : /permission/i.test(message) ? 403
        : /not found/i.test(message) ? 404
          : 409;
    res.status(status).json({ error: publicErrorMessage(message, 'Unable to delete this practice attempt.') });
  }
});

/** The student's own study history, newest first. */
app.get('/api/cbt/attempts', async (req, res) => {
  try {
    const { rpcSupabase } = await requireUser(req, 'cbt.attempt');
    const limit = Number.isInteger(Number(req.query.limit)) ? Math.min(Math.max(Number(req.query.limit), 1), 100) : 25;
    const { data, error } = await rpcSupabase.rpc('get_cbt_attempt_history', { p_limit: limit });
    if (error) throw error;
    res.json({
      items: (data || []).map((row: Record<string, any>) => ({
        id: row.attempt_id,
        examId: row.exam_id,
        examTitle: row.exam_title,
        examBody: row.exam_body,
        mode: row.mode,
        programme: row.programme,
        status: row.status,
        score: row.score === null ? null : Number(row.score),
        correctAnswers: Number(row.correct_answers),
        totalQuestions: Number(row.total_questions),
        durationMinutes: row.duration_minutes,
        subjects: row.selected_subjects || [],
        startedAt: row.started_at,
        expiresAt: row.expires_at,
        submittedAt: row.submitted_at,
        answered: Number(row.answered),
        resumable: row.status === 'in_progress' && row.expires_at && new Date(row.expires_at).getTime() > Date.now(),
      })),
    });
  } catch (error) {
    console.error('CBT history API error:', error);
    res.status(401).json({ error: 'Please sign in to see your practice history.' });
  }
});

app.post('/api/cbt/exams/:examId/start', async (req, res) => {
  try {
    const { rpcSupabase } = await requireUser(req, 'cbt.attempt');
    const subjects = Array.isArray(req.body?.subjects)
      ? req.body.subjects.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];
    // The RPC resolves the student from the token, so the attempt is always
    // created for the caller and never for a client-supplied user id.
    const { data, error } = await rpcSupabase.rpc('start_cbt_attempt_for_subjects', {
      p_exam_id: req.params.examId,
      p_subjects: subjects,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return res.status(404).json({ error: 'Unable to start this CBT exam.' });
    res.status(201).json({
      attemptId: row.attempt_id,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      totalQuestions: row.total_questions,
    });
  } catch (error) {
    console.error('CBT start API error:', error);
    const message = error instanceof Error ? error.message : 'Unable to start CBT exam.';
    const status = /Authentication|required|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : /not found/i.test(message) ? 404 : /no questions|requires Use of English/i.test(message) ? 422 : 409;
    res.status(status).json({ error: publicErrorMessage(message, 'Unable to start this CBT exam. Please try again.') });
  }
});

app.get('/api/cbt/exams/:examId/guest-questions', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'CBT question bank is not configured.' });
  try {
    const supabase = getServerSupabase();
    const { data: exam, error: examError } = await supabase
      .from('cbt_exams')
      .select('id,title,exam_body,duration_minutes,subject,is_active')
      .eq('id', req.params.examId)
      .eq('is_active', true)
      .maybeSingle();
    if (examError || !exam) return res.status(404).json({ error: 'CBT exam not found.' });

    const subjects = typeof req.query.subjects === 'string'
      ? req.query.subjects.split('|').map((value) => value.trim()).filter(Boolean)
      : [];
    const { data: questions, error: questionsError } = await supabase
      .from('exam_questions')
      .select('position,subject,question_text,option_a,option_b,option_c,option_d')
      .eq('exam_id', exam.id)
      .order('position', { ascending: true });
    if (questionsError) throw questionsError;

    const paper = selectCbtPaperQuestions(questions || [], subjects);
    if (!paper.length) return res.status(422).json({ error: 'This CBT exam has no questions for the selected subjects.' });

    res.json({
      exam: { id: exam.id, title: exam.title, examBody: exam.exam_body, durationMinutes: exam.duration_minutes, subject: exam.subject },
      questions: paper.map((q) => ({ id: q.position, text: q.question_text, options: [q.option_a, q.option_b, q.option_c, q.option_d] })),
    });
  } catch (error) {
    console.error('Guest CBT question API error:', error);
    res.status(503).json({ error: 'CBT service is temporarily unavailable.' });
  }
});

app.post('/api/cbt/guest-submit', rateLimitFor(RATE_LIMIT_RULES.guestCbtSubmit), async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'CBT question bank is not configured.' });
  try {
    const examId = String(req.body?.examId || '').trim();
    const answers = req.body?.answers as Record<string, unknown> | undefined;
    const subjects = Array.isArray(req.body?.subjects)
      ? req.body.subjects.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];
    if (!examId || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'examId and answers are required.' });
    }

    const supabase = getServerSupabase();
    const { data: exam, error: examError } = await supabase
      .from('cbt_exams')
      .select('id,title,exam_body,duration_minutes,subject,is_active')
      .eq('id', examId)
      .eq('is_active', true)
      .maybeSingle();
    if (examError || !exam) return res.status(404).json({ error: 'CBT exam not found.' });

    const { data: questions, error: questionsError } = await supabase
      .from('exam_questions')
      .select('id,position,subject,question_text,option_a,option_b,option_c,option_d,correct_option,explanation')
      .eq('exam_id', exam.id)
      .order('position', { ascending: true });
    if (questionsError) throw questionsError;

    const paper = selectCbtPaperQuestions(questions || [], subjects);
    if (!paper.length) return res.status(422).json({ error: 'This CBT exam has no questions for the selected subjects.' });

    const breakdown = paper.map((question) => {
      const raw = answers[String(question.position)];
      const valid = raw === null || raw === undefined || (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3);
      if (!valid) throw new Error(`Invalid answer for question ${question.position}.`);
      const selected = raw === undefined || raw === null ? null : Number(raw);
      const selectedOption = selected === null ? null : String.fromCharCode(65 + selected);
      const correctIndex = question.correct_option.charCodeAt(0) - 65;
      return {
        question: question.position,
        selected,
        correct: correctIndex,
        isCorrect: selectedOption === question.correct_option,
        explanation: question.explanation || null,
        questionId: question.id,
        subject: question.subject,
      };
    });

    const correctAnswers = breakdown.filter((item) => item.isCorrect).length;
    const score = Number(((correctAnswers / paper.length) * 100).toFixed(2));
    const attemptId = `guest-cbt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    res.json({
      attemptId,
      score,
      exam: { id: exam.id, title: exam.title, exam_body: exam.exam_body, subject: exam.subject, duration_minutes: exam.duration_minutes },
      attempt: { id: attemptId, exam_id: exam.id, score, correct_answers: correctAnswers, total_questions: paper.length, submitted_at: new Date().toISOString() },
      answers: breakdown.map((item) => ({
        question_id: item.questionId,
        selected_option: item.selected === null ? null : String.fromCharCode(65 + item.selected),
        is_correct: item.isCorrect,
      })),
      questions: paper.map((question) => ({
        id: question.id,
        position: question.position,
        question_text: question.question_text,
        option_a: question.option_a,
        option_b: question.option_b,
        option_c: question.option_c,
        option_d: question.option_d,
        correct_option: question.correct_option,
        explanation: question.explanation,
      })),
      breakdown,
    });
  } catch (error) {
    console.error('Guest CBT submit API error:', error);
    const message = error instanceof Error ? error.message : 'CBT submission failed.';
    res.status(400).json({ error: publicErrorMessage(message, 'CBT submission failed. Please try again.') });
  }
});

app.post('/api/cbt/submit', async (req, res) => {
  try {
    const { rpcSupabase } = await requireUser(req, 'cbt.attempt');
    const { attemptId, examId, answers } = req.body as { attemptId?: string; examId?: string; answers?: Record<string, unknown> };
    if (!attemptId || !examId || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'attemptId, examId and answers are required.' });
    }
    // Ownership (the attempt belongs to the caller) is enforced inside the RPC
    // through auth.uid(); the server never passes a user id from the request.
    const { data, error } = await rpcSupabase.rpc('submit_cbt_attempt_for_subjects', {
      p_attempt_id: attemptId,
      p_exam_id: examId,
      p_answers: answers,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return res.status(409).json({ error: 'CBT submission did not produce a result.' });
    res.json({
      attemptId: row.attempt_id,
      score: Number(row.score),
      breakdown: row.breakdown || [],
    });
  } catch (error) {
    console.error('CBT submit API error:', error);
    const message = error instanceof Error ? error.message : 'CBT submission failed.';
    const status = /Authentication|required|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : /not found/i.test(message) ? 404 : /already been submitted/i.test(message) ? 409 : /expired/i.test(message) ? 409 : 400;
    res.status(status).json({ error: publicErrorMessage(message, 'CBT submission failed. Please try again.') });
  }
});

/**
 * Legacy progress endpoints, kept for compatibility.
 *
 * They used to store only the question index and drop the answers they were
 * sent, so a student who reconnected resumed at the right question with an empty
 * paper. Both verbs now go through the same validated draft path the configured
 * API uses, which is why an older client stops losing work too.
 */
app.get('/api/cbt/attempts/:attemptId/progress', async (req, res) => {
  try {
    const { supabase, user } = await requireUser(req, 'cbt.attempt');
    // Ownership: the row must belong to the caller. A mismatch is a 404, so the
    // response never reveals that someone else's attempt exists.
    const { data: attempt, error } = await supabase
      .from('cbt_attempts')
      .select('id,current_question,answers_draft,expires_at,status')
      .eq('id', req.params.attemptId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || !attempt) return res.status(404).json({ error: 'CBT attempt not found.' });
    res.json({
      answers: attempt.answers_draft || {},
      questionIndex: Number.isInteger(attempt.current_question) ? attempt.current_question : 0,
      expiresAt: attempt.expires_at,
      status: attempt.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load CBT progress.';
    const status = /Authentication|required|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : 400;
    res.status(status).json({ error: publicErrorMessage(message, 'Unable to load CBT progress.') });
  }
});

app.patch('/api/cbt/attempts/:attemptId/progress', async (req, res) => {
  let callerId = '';
  try {
    const { rpcSupabase, user } = await requireUser(req, 'cbt.attempt');
    callerId = user.id;
    const answers = req.body?.answers && typeof req.body.answers === 'object' && !Array.isArray(req.body.answers)
      ? req.body.answers
      : {};
    const questionIndex = Number.isInteger(Number(req.body?.questionIndex)) ? Number(req.body.questionIndex) : null;

    const { data, error } = await rpcSupabase.rpc('save_cbt_attempt_draft', {
      p_attempt_id: req.params.attemptId,
      p_answers: answers,
      p_question_index: questionIndex,
    });
    if (error) throw error;
    res.json({ ok: true, saved: data || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save CBT progress.';
    if (/expired/i.test(message)) await expireCbtAttempt(req.params.attemptId, callerId);
    const status = /Authentication|required|session/i.test(message) ? 401
      : /permission/i.test(message) ? 403
        : /not found/i.test(message) ? 404
          : /expired|already/i.test(message) ? 409
            : 400;
    res.status(status).json({ error: publicErrorMessage(message, 'Unable to save CBT progress.') });
  }
});


// --- Unified admin content manager -----------------------------------------
// One bulk CMS surface for editable Supabase-backed content. The allowlist is
// deliberate: admin cannot turn this endpoint into arbitrary SQL/table access.
type ContentField = { name: string; label: string; type: string; required?: boolean; readonly?: boolean };
type ContentResource = { key: string; label: string; table: string; fields: ContentField[] };

const CONTENT_RESOURCES: ContentResource[] = [
  { key: 'institutions', label: 'Institutions', table: 'institutions', fields: [
    {name:'id',label:'ID',type:'uuid',readonly:true},{name:'school_name',label:'School Name',type:'text',required:true},
    {name:'acronym',label:'Acronym',type:'text'},{name:'slug',label:'Slug',type:'text'},{name:'state',label:'State',type:'text'},
    {name:'institution_type',label:'Institution Type',type:'text'},{name:'website_url',label:'Website URL',type:'url'},
    {name:'admission_portal_url',label:'Admission Portal URL',type:'url'},{name:'student_portal_url',label:'Student Portal URL',type:'url'},
    {name:'is_verified',label:'Verified',type:'boolean'},{name:'created_at',label:'Created At',type:'timestamptz',readonly:true},
    {name:'updated_at',label:'Updated At',type:'timestamptz',readonly:true},
  ]},
  { key: 'faculties', label: 'Faculties', table: 'faculties', fields: [
    {name:'id',label:'ID',type:'uuid',readonly:true},{name:'school',label:'School',type:'text',required:true},
    {name:'name',label:'Faculty Name',type:'text',required:true},{name:'slug',label:'Slug',type:'text',required:true},
    {name:'institution_id',label:'Institution ID',type:'uuid'},{name:'ccmas_discipline',label:'CCMAS Discipline',type:'text'},
    {name:'ccmas_source_url',label:'CCMAS Source URL',type:'url'},{name:'ccmas_verified_at',label:'CCMAS Verified At',type:'timestamptz'},
    {name:'created_at',label:'Created At',type:'timestamptz',readonly:true},
  ]},
  { key: 'departments', label: 'Departments', table: 'departments', fields: [
    {name:'id',label:'ID',type:'uuid',readonly:true},{name:'faculty_id',label:'Faculty ID',type:'uuid',required:true},
    {name:'name',label:'Department Name',type:'text',required:true},{name:'slug',label:'Slug',type:'text',required:true},
    {name:'created_at',label:'Created At',type:'timestamptz',readonly:true},
  ]},
  { key: 'programmes', label: 'Programmes', table: 'programmes', fields: [
    {name:'id',label:'ID',type:'uuid',readonly:true},{name:'institution_id',label:'Institution ID',type:'uuid',required:true},
    {name:'faculty_id',label:'Faculty ID',type:'uuid',required:true},{name:'department_id',label:'Department ID',type:'uuid',required:true},
    {name:'ccmas_programme_id',label:'CCMAS Programme ID',type:'uuid'},{name:'programme_code',label:'Programme Code',type:'text',required:true},
    {name:'programme_name',label:'Programme Name',type:'text',required:true},{name:'degree_title',label:'Degree Title',type:'text'},
    {name:'is_active',label:'Active',type:'boolean'},{name:'created_at',label:'Created At',type:'timestamptz',readonly:true},
    {name:'updated_at',label:'Updated At',type:'timestamptz',readonly:true},
  ]},
  { key: 'courses', label: 'Courses', table: 'courses', fields: [
    {name:'id',label:'ID',type:'uuid',readonly:true},{name:'department_id',label:'Department ID',type:'uuid',required:true},
    {name:'code',label:'Course Code',type:'text',required:true},{name:'title',label:'Course Title',type:'text',required:true},
    {name:'units',label:'Units',type:'number',required:true},{name:'level',label:'Level',type:'number',required:true},
    {name:'semester',label:'Semester',type:'number'},{name:'programme_id',label:'Programme ID',type:'uuid'},
    {name:'ccmas_course_id',label:'CCMAS Course ID',type:'uuid'},{name:'source_type',label:'Source Type',type:'text'},
    {name:'requirement_type',label:'Requirement Type',type:'text'},{name:'is_active',label:'Active',type:'boolean'},
    {name:'source_url',label:'Source URL',type:'url'},{name:'verification_status',label:'Verification Status',type:'text'},
    {name:'source_note',label:'Source Note',type:'text'},{name:'submitted_by',label:'Submitted By',type:'uuid'},
    {name:'created_at',label:'Created At',type:'timestamptz',readonly:true},
  ]},
  { key: 'cbt_exams', label: 'CBT Exams', table: 'cbt_exams', fields: [
    {name:'id',label:'ID',type:'uuid',readonly:true},{name:'title',label:'Title',type:'text',required:true},
    {name:'exam_body',label:'Exam Body',type:'text',required:true},{name:'subject',label:'Subject',type:'text',required:true},
    {name:'description',label:'Description',type:'text'},{name:'duration_minutes',label:'Duration Minutes',type:'number',required:true},
    {name:'is_active',label:'Active',type:'boolean'},{name:'created_by',label:'Created By',type:'uuid',readonly:true},
    {name:'created_at',label:'Created At',type:'timestamptz',readonly:true},{name:'updated_at',label:'Updated At',type:'timestamptz',readonly:true},
  ]},
  { key: 'exam_questions', label: 'CBT Questions', table: 'exam_questions', fields: [
    {name:'id',label:'ID',type:'uuid',readonly:true},{name:'exam_id',label:'Exam ID',type:'uuid',required:true},{name:'subject',label:'Subject',type:'text',required:true},
    {name:'question_text',label:'Question Text',type:'text',required:true},{name:'option_a',label:'Option A',type:'text',required:true},
    {name:'option_b',label:'Option B',type:'text',required:true},{name:'option_c',label:'Option C',type:'text',required:true},
    {name:'option_d',label:'Option D',type:'text',required:true},{name:'correct_option',label:'Correct Option',type:'text',required:true},
    {name:'explanation',label:'Explanation',type:'text'},{name:'marks',label:'Marks',type:'number',required:true},
    {name:'position',label:'Position',type:'number',required:true},{name:'created_at',label:'Created At',type:'timestamptz',readonly:true},
    {name:'updated_at',label:'Updated At',type:'timestamptz',readonly:true},
  ]},
  { key: 'news_articles', label: 'News', table: 'news_articles', fields: [
    {name:'id',label:'ID',type:'uuid',readonly:true},{name:'slug',label:'Slug',type:'text',required:true},{name:'title',label:'Title',type:'text',required:true},
    {name:'excerpt',label:'Excerpt',type:'text'},{name:'body',label:'Body',type:'text',required:true},{name:'category',label:'Category',type:'text',required:true},
    {name:'image_url',label:'Image URL',type:'url'},{name:'source_name',label:'Source Name',type:'text'},{name:'source_url',label:'Source URL',type:'url'},
    {name:'author_id',label:'Author ID',type:'uuid',readonly:true},{name:'published',label:'Published',type:'boolean'},
    {name:'published_at',label:'Published At',type:'timestamptz'},{name:'featured',label:'Featured',type:'boolean'},{name:'tags',label:'Tags',type:'text'},
    {name:'created_at',label:'Created At',type:'timestamptz',readonly:true},{name:'updated_at',label:'Updated At',type:'timestamptz',readonly:true},
  ]},
  { key: 'opportunities', label: 'Opportunities', table: 'opportunities', fields: [
    {name:'id',label:'ID',type:'uuid',readonly:true},{name:'title',label:'Title',type:'text',required:true},{name:'organisation',label:'Organisation',type:'text'},
    {name:'category',label:'Category',type:'text',required:true},{name:'description',label:'Description',type:'text'},
    {name:'link_url',label:'Link URL',type:'url'},{name:'deadline',label:'Deadline',type:'date'},{name:'locations',label:'Locations',type:'text'},
    {name:'is_active',label:'Active',type:'boolean'},{name:'created_at',label:'Created At',type:'timestamptz',readonly:true},
    {name:'updated_at',label:'Updated At',type:'timestamptz',readonly:true},
  ]},
  { key: 'service_catalog', label: 'Services', table: 'service_catalog', fields: [
    {name:'id',label:'ID',type:'uuid',readonly:true},{name:'service_key',label:'Service Key',type:'text',readonly:true},
    {name:'title',label:'Title',type:'text',required:true},{name:'description',label:'Description',type:'text',required:true},
    {name:'application_url',label:'Application URL',type:'url'},{name:'active',label:'Active',type:'boolean'},
    {name:'category',label:'Category',type:'text'},{name:'route',label:'Route',type:'text'},{name:'sort_order',label:'Sort Order',type:'number'},
    {name:'created_at',label:'Created At',type:'timestamptz',readonly:true},{name:'updated_at',label:'Updated At',type:'timestamptz',readonly:true},
  ]},
 
];

function getContentResource(key: string) { return CONTENT_RESOURCES.find(item => item.key === key); }
function coerceContentValue(field: ContentField, value: unknown) {
  if (value === '' || value === undefined) return null;
  if (field.type === 'boolean') {
    if (typeof value === 'boolean') return value;
    const s = String(value).trim().toLowerCase();
    if (['true','1','yes','y'].includes(s)) return true;
    if (['false','0','no','n'].includes(s)) return false;
    throw new Error(`Invalid boolean for ${field.name}.`);
  }
  if (field.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`Invalid number for ${field.name}.`);
    return n;
  }
  if (field.type === 'timestamptz') {
    const d = new Date(String(value));
    if (!Number.isFinite(d.getTime())) throw new Error(`Invalid date/time for ${field.name}.`);
    return d.toISOString();
  }
  return String(value).trim();
}
function validateContentRow(resource: ContentResource, input: Record<string, unknown>) {
  const allowed = new Set(resource.fields.filter(f => !f.readonly).map(f => f.name));
  for (const key of Object.keys(input)) if (!allowed.has(key) && key !== 'id') throw new Error(`Field "${key}" is not editable for this resource.`);
  const values: Record<string, unknown> = {};
  if (input.id !== undefined && input.id !== null && String(input.id).trim()) values.id = String(input.id).trim();
  for (const field of resource.fields) {
    if (field.readonly) continue;
    const value = input[field.name];
    if ((value === undefined || value === null || value === '') && field.required) throw new Error(`${field.label} is required.`);
    if (value !== undefined) values[field.name] = coerceContentValue(field, value);
  }
  return values;
}
function contentSelect(resource: ContentResource) { return resource.fields.map(f => f.name).join(','); }

app.get('/api/admin/content-manager/resources', requireCapability('data.read'), (_req, res) => {
  res.json({ resources: CONTENT_RESOURCES });
});

app.get('/api/admin/content-manager/data/:resource', requireCapability('data.read'), async (req, res) => {
  try {
    const resource = getContentResource(req.params.resource);
    if (!resource) return res.status(404).json({ error: 'Content resource not found.' });
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from(resource.table).select(contentSelect(resource)).order(resource.fields.find(f => f.name === 'updated_at') ? 'updated_at' : 'created_at', { ascending: false }).limit(500);
    if (error) throw error;
    res.json({ rows: data || [] });
  } catch (error) {
    console.error('Content manager list error:', error);
    res.status(503).json({ error: 'Unable to load this content section.' });
  }
});

app.post('/api/admin/content-manager/data/:resource', requireCapability('data.write'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const resource = getContentResource(req.params.resource);
    if (!resource) return res.status(404).json({ error: 'Content resource not found.' });
    const values = validateContentRow(resource, req.body || {});
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from(resource.table).insert(values).select(contentSelect(resource)).single();
    if (error) throw error;
    await recordAudit(supabase, { actorId: adminUser.id, action: 'create', resourceType: resource.table, resourceId: (data as { id?: string } | null)?.id ?? null });
    res.status(201).json({ row: data });
  } catch (error) {
    console.error('Content manager create error:', error);
    res.status(400).json({ error: publicErrorMessage(error, 'Unable to create record.') });
  }
});

app.patch('/api/admin/content-manager/data/:resource/:id', requireCapability('data.write'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const resource = getContentResource(req.params.resource);
    if (!resource) return res.status(404).json({ error: 'Content resource not found.' });
    const values = validateContentRow(resource, req.body || {});
    if (!Object.keys(values).length) return res.status(400).json({ error: 'No editable fields were supplied.' });
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from(resource.table).update(values).eq('id', req.params.id).select(contentSelect(resource)).single();
    if (error) throw error;
    await recordAudit(supabase, { actorId: adminUser.id, action: 'update', resourceType: resource.table, resourceId: req.params.id });
    res.json({ row: data });
  } catch (error) {
    console.error('Content manager update error:', error);
    res.status(400).json({ error: publicErrorMessage(error, 'Unable to update record.') });
  }
});

app.delete('/api/admin/content-manager/data/:resource/:id', requireCapability('data.write'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const resource = getContentResource(req.params.resource);
    if (!resource) return res.status(404).json({ error: 'Content resource not found.' });
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from(resource.table).delete().eq('id', req.params.id).select('id').single();
    if (error) {
      const message = String(error.message || '');
      if (/foreign key|violates|constraint/i.test(message)) return res.status(409).json({ error: 'This record is still referenced by other data. Archive/deactivate it instead of deleting it.' });
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Record not found.' });
    await recordAudit(supabase, { actorId: adminUser.id, action: 'delete', resourceType: resource.table, resourceId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error('Content manager delete error:', error);
    res.status(400).json({ error: publicErrorMessage(error, 'Unable to delete record.') });
  }
});

app.post('/api/admin/content-manager/import/:resource', rateLimitFor(RATE_LIMIT_RULES.adminImport), requireCapability('data.import'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const resource = getContentResource(req.params.resource);
    if (!resource) return res.status(404).json({ error: 'Content resource not found.' });
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'No import rows were supplied.' });
    if (rows.length > 2000) return res.status(400).json({ error: 'Import limit is 2,000 rows per batch.' });
    const supabase = getServerSupabase();
    const valid: Array<{ index: number; values: Record<string, unknown> }> = [];
    const errors: Array<{ row: number; error: string }> = [];
    rows.forEach((row: unknown, index: number) => {
      try {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Row is not an object.');
        valid.push({ index, values: validateContentRow(resource, row as Record<string, unknown>) });
      } catch (error) { errors.push({ row: index + 2, error: publicErrorMessage(error, 'Invalid row.') }); }
    });
    let inserted = 0, updated = 0;
    // Use bulk inserts/updates in chunks rather than issuing one request per row.
    for (let start = 0; start < valid.length; start += 200) {
      const chunk = valid.slice(start, start + 200);
      const withIds = chunk.filter(item => item.values.id);
      const withoutIds = chunk.filter(item => !item.values.id);
      if (withoutIds.length) {
        const { error } = await supabase.from(resource.table).insert(withoutIds.map(item => item.values));
        if (!error) {
          inserted += withoutIds.length;
        } else {
          // Bulk-first; only fall back to individual rows when a mixed batch is rejected.
          for (const item of withoutIds) {
            const single = await supabase.from(resource.table).insert(item.values);
            if (single.error) errors.push({ row: item.index + 2, error: publicErrorMessage(single.error, 'Invalid row.') });
            else inserted += 1;
          }
        }
      }
      if (withIds.length) {
        const { error } = await supabase.from(resource.table).upsert(withIds.map(item => item.values), { onConflict: 'id', ignoreDuplicates: false });
        if (!error) {
          updated += withIds.length;
        } else {
          // Bulk-first; only fall back to individual rows when a mixed batch is rejected.
          for (const item of withIds) {
            const single = await supabase.from(resource.table).upsert(item.values, { onConflict: 'id', ignoreDuplicates: false });
            if (single.error) errors.push({ row: item.index + 2, error: publicErrorMessage(single.error, 'Invalid row.') });
            else updated += 1;
          }
        }
      }
    }
        await recordAudit(supabase, { actorId: adminUser.id, action: 'import', resourceType: resource.table, metadata: { inserted, updated, errors: errors.length } });
    res.json({ inserted, updated, errors });
  } catch (error) {
    console.error('Content manager import error:', error);
    res.status(400).json({ error: publicErrorMessage(error, 'Unable to import data.') });
  }
});

// ---------------------------------------------------------------------------
// Newsroom: ingestion runs, review queue and content integrity.
// ---------------------------------------------------------------------------

app.post('/api/admin/newsroom/ingest', rateLimitFor(RATE_LIMIT_RULES.adminNewsroomRun), requireCapability('news.create'), async (req, res) => {
  try {
    // Defaults to a real run; pass dry_run: true to preview what would happen.
    const dryRun = req.body?.dry_run === true || req.body?.dry_run === 'true';
    const report = await runNewsroomRefresh({
      triggeredBy: 'admin',
      dryRun,
      repairImages: req.body?.repair_images !== false,
    });
    res.json({ report });
  } catch (error) {
    console.error('Newsroom ingest error:', error);
    res.status(503).json({ error: publicErrorMessage(error, 'Unable to run the newsroom refresh.') });
  }
});

app.get('/api/admin/newsroom/runs', requireCapability('news.read'), async (_req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('news_ingest_runs')
      .select('id,started_at,finished_at,status,triggered_by,dry_run,sources_checked,sources_failed,candidates_found,duplicates,rejected,needs_review,published,images_repaired,expired,report,error')
      .order('started_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Newsroom runs error:', error);
    res.status(503).json({ error: 'Unable to load newsroom runs. Has the newsroom migration been applied?' });
  }
});

app.get('/api/admin/newsroom/candidates', requireCapability('news.read'), async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' && req.query.status.trim() ? req.query.status.trim() : 'needs_review';
    const allowed = ['new', 'needs_review', 'approved', 'rejected', 'duplicate', 'published', 'failed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Unsupported candidate status.' });
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('news_ingest_candidates')
      .select('id,run_id,source_key,source_name,source_tier,source_url,canonical_url,title,excerpt,body,image_url,category,source_published_at,relevance_score,quality_score,quality_flags,review_notes,status,rejection_reason,article_id,created_at')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const { count } = await supabase
      .from('news_ingest_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'needs_review');

    res.json({ items: data || [], pending_review: count ?? null });
  } catch (error) {
    console.error('Newsroom candidates error:', error);
    res.status(503).json({ error: 'Unable to load the review queue. Has the newsroom migration been applied?' });
  }
});

app.post('/api/admin/newsroom/candidates/:candidateId/approve', requireCapability('news.publish'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: candidate, error: candidateError } = await supabase
      .from('news_ingest_candidates')
      .select('*')
      .eq('id', req.params.candidateId)
      .maybeSingle();
    if (candidateError) throw candidateError;
    if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
    if (candidate.article_id) return res.status(409).json({ error: 'This candidate has already been published.' });

    const title = String(req.body?.title || candidate.title || '').trim();
    const excerpt = req.body?.excerpt !== undefined ? String(req.body.excerpt || '').trim() || null : candidate.excerpt;
    const body = String(req.body?.body || candidate.body || '').trim();
    const category = String(req.body?.category || candidate.category || 'general').trim().toLowerCase();
    const imageUrl = req.body?.image_url !== undefined ? safeContentUrl(req.body.image_url) : candidate.image_url;
    if (!title || !body) return res.status(400).json({ error: 'A title and editorial summary are required before publishing.' });
    const sourceUrl = safeContentUrl(candidate.source_url);
    if (!sourceUrl) return res.status(400).json({ error: 'The candidate has no valid HTTPS source URL.' });

    const now = new Date();
    const publishedAt = candidate.source_published_at ? new Date(candidate.source_published_at) : now;
    const publishedIso = Number.isFinite(publishedAt.getTime()) ? publishedAt.toISOString() : now.toISOString();

    const articleRow: Record<string, unknown> = {
      slug: await uniqueNewsSlug(supabase, slugifyTitle(title)),
      title,
      excerpt,
      body,
      category,
      image_url: imageUrl,
      source_name: candidate.source_name,
      source_url: sourceUrl,
      published: true,
      published_at: publishedIso,
      featured: false,
      tags: normalizeTags(req.body?.tags) || candidate.category || null,
      source_key: candidate.source_key,
      source_tier: candidate.source_tier,
      source_published_at: candidate.source_published_at,
      last_verified_at: now.toISOString(),
      verification_status: 'verified',
      expires_at: expiresAtFor(category, new Date(publishedIso)),
      content_hash: candidate.content_hash,
      dedupe_key: candidate.dedupe_key,
      ingest_candidate_id: candidate.id,
      review_status: 'editor_approved',
    };

    const { data, error } = await supabase.from('news_articles').insert(articleRow).select(newsRowSelect).single();
    if (error) {
      if (String(error.code) === '23505') return res.status(409).json({ error: 'This story is already published.' });
      throw error;
    }

    await supabase.from('news_ingest_candidates')
      .update({ status: 'published', article_id: data.id, reviewed_by: adminUser.id, reviewed_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', candidate.id);
    await supabase.rpc('admin_audit_log', {
      p_admin_user_id: adminUser.id,
      p_action: 'news_candidate_approve',
      p_entity_type: 'news_ingest_candidate',
      p_entity_id: candidate.id,
      p_metadata: { slug: articleRow.slug, source_key: candidate.source_key },
    });

    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Newsroom approve error:', error);
    res.status(500).json({ error: publicErrorMessage(error, 'Unable to publish this candidate.') });
  }
});

app.post('/api/admin/newsroom/candidates/:candidateId/reject', requireCapability('news.update'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const reason = String(req.body?.reason || '').trim().slice(0, 500) || 'Rejected by editor.';
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('news_ingest_candidates')
      .update({ status: 'rejected', rejection_reason: reason, reviewed_by: adminUser.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.params.candidateId)
      .select('id,status,rejection_reason')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Candidate not found.' });
    await supabase.rpc('admin_audit_log', {
      p_admin_user_id: adminUser.id,
      p_action: 'news_candidate_reject',
      p_entity_type: 'news_ingest_candidate',
      p_entity_id: req.params.candidateId,
      p_metadata: { reason },
    });
    res.json({ item: data });
  } catch (error) {
    console.error('Newsroom reject error:', error);
    res.status(500).json({ error: publicErrorMessage(error, 'Unable to reject this candidate.') });
  }
});

app.get('/api/admin/integrity', requireCapability('data.read'), async (_req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.rpc('content_integrity_report');
    if (error) throw error;
    res.json({ report: data });
  } catch (error) {
    console.error('Content integrity error:', error);
    res.status(503).json({ error: 'Unable to build the integrity report. Has the newsroom migration been applied?' });
  }
});

// ---------------------------------------------------------------------------
// Crawler surfaces. Registered for both the bare path (self-hosted Express and
// Docker) and the /api path, because Netlify rewrites /robots.txt and
// /sitemap.xml through the API function (see netlify.toml).
// ---------------------------------------------------------------------------

async function serveRobotsTxt(req: express.Request, res: express.Response) {
  const origin = resolveSiteOrigin(req);
  res.type('text/plain').setHeader('Cache-Control', 'public, max-age=86400');
  res.send(buildRobotsTxt(origin));
}

async function serveSitemapXml(req: express.Request, res: express.Response) {
  const origin = resolveSiteOrigin(req);
  const client = isServerSupabaseConfigured() ? getServerSupabase() : null;
  const entries = await collectSitemapEntries(client, origin, (source, error) => {
    console.error(`Sitemap: ${source} entries unavailable:`, error instanceof Error ? error.message : error);
  });
  res.type('application/xml').setHeader('Cache-Control', 'public, max-age=3600');
  res.send(buildSitemapXml(entries));
}

// Registered as separate string paths (not an array) so route introspection
// such as the unauthenticated-access matrix in tests/api.test.ts keeps working.
app.get('/robots.txt', serveRobotsTxt);
app.get('/api/robots.txt', serveRobotsTxt);
app.get('/sitemap.xml', serveSitemapXml);
app.get('/api/sitemap.xml', serveSitemapXml);

// Never let an unknown API method/path fall through to the SPA HTML shell.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// API failures must remain JSON and must not disclose parser stacks or bodies.
const apiErrorHandler: express.ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error?.type === 'entity.too.large' ? 413 : error?.status === 400 ? 400 : 500;
  res.status(status).json({ error: status === 413 ? 'Request body is too large.' : status === 400 ? 'Invalid request body or URL.' : 'Internal server error.' });
};
app.use('/api', apiErrorHandler);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
        ws: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Middleware does not decode wildcard params, so malformed percent-encoded
    // URLs can reach the frontend's safe not-found page rather than Express's error page.
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`EduReach server running on port ${PORT}`));
}

if (!process.env.NETLIFY) {
  startServer().catch((error) => {
    console.error('Unable to start EduReach:', error);
    process.exitCode = 1;
  });
}
