/**
 * Site content API: the footer, brand line, contact details and policy pages.
 *
 * The public half (`GET /api/site-content`) is what the footer and the policy
 * pages read. The admin half is capability-gated (`site.read` / `site.update`)
 * and is the only way those tables change: `site_settings`, `site_pages` and
 * `site_page_revisions` carry no client write grants (see migration
 * 20261024120000).
 *
 * Validation lives here rather than in the browser because this is the boundary
 * that matters. The client re-validates for display, but a request that reaches
 * this file with `javascript:` in a social URL, a 2 MB body or a slug outside
 * the six real routes is refused.
 */

import type { Express, Request, Response } from 'express';
import { isSafeHttpsUrl, POLICY_SLUGS, type PolicySlug } from '../lib/siteContentModel';
import type { Capability } from '../lib/capabilities';

export interface SiteContentDeps {
  requireCapability: (...capabilities: Capability[]) => (req: Request, res: Response, next: () => void) => any;
  getSupabase: () => {
    from: (table: string) => any;
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data?: unknown; error?: { message?: string } | null }>;
  };
  recordAudit: (
    supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error?: unknown }> },
    entry: { actorId: string; action: string; resourceType: string; resourceId?: string | null; metadata?: Record<string, unknown> },
  ) => Promise<void>;
}

export const SETTINGS_KEYS = ['brand', 'footer', 'contact', 'social'] as const;
export type SettingsKey = (typeof SETTINGS_KEYS)[number];

export interface Validated<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

const MAX_BODY = 40_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\r\n/g, '\n').trim();
  if (text.length < min || text.length > max) return null;
  return text;
}

/**
 * Reject markup the render-side sanitizer would strip anyway, and reject it at
 * save time so an editor sees the problem instead of publishing a page where
 * their embed silently disappeared.
 */
export function containsUnsafeMarkup(html: string): boolean {
  return /<\s*(script|iframe|object|embed|style|form|input|textarea|select|button)\b/i.test(html)
    || /\son[a-z]+\s*=/i.test(html)
    || /javascript\s*:/i.test(html)
    || /data\s*:\s*text\/html/i.test(html);
}

export function validateSettings(key: string, raw: unknown): Validated<Record<string, unknown>> {
  if (!(SETTINGS_KEYS as readonly string[]).includes(key)) return { ok: false, error: 'Unknown settings group.' };
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!value) return { ok: false, error: 'Settings must be an object.' };

  if (key === 'brand') {
    const name = cleanText(value.name, 2, 60);
    const tagline = cleanText(value.tagline, 0, 160) ?? '';
    if (!name) return { ok: false, error: 'The site name must be between 2 and 60 characters.' };
    if (tagline === '' && value.tagline !== '' && value.tagline !== undefined) {
      return { ok: false, error: 'The tagline must be 160 characters or fewer.' };
    }
    return { ok: true, value: { name, tagline } };
  }

  if (key === 'footer') {
    const about = cleanText(value.about, 0, 400) ?? '';
    return { ok: true, value: { about } };
  }

  if (key === 'contact') {
    const whatsapp = String(value.whatsapp ?? '').replace(/[^0-9]/g, '');
    if (whatsapp.length < 8 || whatsapp.length > 15) {
      return { ok: false, error: 'Enter a WhatsApp number in international format, digits only (for example 2348012345678).' };
    }
    const email = typeof value.email === 'string' ? value.email.trim() : '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return { ok: false, error: 'Enter a valid email address or leave the field empty.' };
    }
    const note = cleanText(value.note, 0, 300) ?? '';
    return { ok: true, value: { whatsapp, email, note } };
  }

  // social
  const links = Array.isArray(value.links) ? value.links : null;
  if (!links) return { ok: false, error: 'Social links must be a list.' };
  if (links.length > 8) return { ok: false, error: 'Add at most eight social links.' };
  const cleaned: Array<{ label: string; url: string }> = [];
  const seen = new Set<string>();
  for (const entry of links) {
    if (!isRecord(entry)) return { ok: false, error: 'Each social link needs a label and an https URL.' };
    const label = cleanText(entry.label, 2, 40);
    if (!label) return { ok: false, error: 'Each social link needs a label of 2 to 40 characters.' };
    if (!isSafeHttpsUrl(entry.url)) return { ok: false, error: `The ${label} link must be a full https:// address.` };
    const url = String(entry.url).trim();
    if (seen.has(url)) return { ok: false, error: `The ${label} link is entered twice.` };
    seen.add(url);
    cleaned.push({ label, url });
  }
  return { ok: true, value: { links: cleaned } };
}

export interface PageInput {
  title: string;
  summary: string;
  body: string;
  status: 'draft' | 'published';
  reviewState: 'pending' | 'approved';
}

export function validatePageInput(raw: unknown): Validated<PageInput> {
  if (!isRecord(raw)) return { ok: false, error: 'Send the page as an object.' };
  const title = cleanText(raw.title, 3, 120);
  if (!title) return { ok: false, error: 'The title must be between 3 and 120 characters.' };
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  if (summary.length > 300) return { ok: false, error: 'The summary must be 300 characters or fewer.' };
  const body = typeof raw.body === 'string' ? raw.body.replace(/\r\n/g, '\n').trim() : '';
  if (body.length < 20) return { ok: false, error: 'The page body is too short to publish.' };
  if (body.length > MAX_BODY) return { ok: false, error: 'The page body is too long. Keep it under 40,000 characters.' };
  if (containsUnsafeMarkup(body)) {
    return { ok: false, error: 'Remove scripts, embeds, forms and event handlers from the page body. Use the text editor, not pasted page code.' };
  }
  const status = raw.status === 'published' ? 'published' : raw.status === 'draft' ? 'draft' : null;
  if (!status) return { ok: false, error: 'Choose draft or published.' };
  const reviewState = raw.reviewState === 'approved' ? 'approved' : raw.reviewState === 'pending' ? 'pending' : null;
  if (!reviewState) return { ok: false, error: 'Choose whether legal review is pending or approved.' };
  return { ok: true, value: { title, summary, body, status, reviewState } };
}

export function isServedPageSlug(value: string): value is PolicySlug {
  return (POLICY_SLUGS as readonly string[]).includes(value);
}

function pageRowToApi(row: Record<string, unknown>) {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    status: row.status,
    reviewState: row.review_state,
    revision: row.revision,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

const PAGE_COLUMNS = 'slug,title,summary,body,status,review_state,revision,updated_at,published_at';

export function registerSiteContentRoutes(app: Express, deps: SiteContentDeps): void {
  // -------------------------------------------------------------------------
  // Public: what the footer and the policy pages read.
  // -------------------------------------------------------------------------
  app.get('/api/site-content', async (_req, res) => {
    try {
      const supabase = deps.getSupabase();
      const [settingsResult, pagesResult] = await Promise.all([
        supabase.from('site_settings').select('key,value'),
        supabase.from('site_pages').select(PAGE_COLUMNS).eq('status', 'published'),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (pagesResult.error) throw pagesResult.error;

      const settings: Record<string, unknown> = {};
      for (const row of (settingsResult.data || []) as Array<{ key: string; value: unknown }>) {
        settings[row.key] = row.value;
      }
      const pages = ((pagesResult.data || []) as Array<Record<string, unknown>>)
        .filter((row) => isServedPageSlug(String(row.slug)))
        .map(pageRowToApi);

      // Short cache: the footer is on every page, and a policy edit does not
      // need to be visible in the same second.
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json({ settings, pages });
    } catch (error) {
      console.error('Site content read error:', error);
      // Not a 500 the footer cannot use: the client falls back to the copy the
      // site shipped with, and the response says so.
      res.status(503).json({ error: 'Site content is temporarily unavailable.' });
    }
  });

  // -------------------------------------------------------------------------
  // Admin: read everything, including drafts, plus revision history.
  // -------------------------------------------------------------------------
  app.get('/api/admin/site-content', deps.requireCapability('site.read'), async (_req, res) => {
    try {
      const supabase = deps.getSupabase();
      const [settingsResult, pagesResult] = await Promise.all([
        supabase.from('site_settings').select('key,value,updated_at'),
        supabase.from('site_pages').select(PAGE_COLUMNS).order('slug', { ascending: true }),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (pagesResult.error) throw pagesResult.error;
      const settings: Record<string, unknown> = {};
      for (const row of (settingsResult.data || []) as Array<{ key: string; value: unknown }>) settings[row.key] = row.value;
      res.json({ settings, pages: ((pagesResult.data || []) as Array<Record<string, unknown>>).map(pageRowToApi) });
    } catch (error) {
      console.error('Admin site content read error:', error);
      res.status(503).json({ error: 'Unable to load site content.' });
    }
  });

  app.get('/api/admin/site-content/pages/:slug/revisions', deps.requireCapability('site.read'), async (req, res) => {
    const slug = String(req.params.slug || '');
    if (!isServedPageSlug(slug)) return res.status(404).json({ error: 'That page does not exist.' });
    try {
      const supabase = deps.getSupabase();
      const { data, error } = await supabase
        .from('site_page_revisions')
        .select('id,slug,revision,title,summary,body,status,review_state,edited_at')
        .eq('slug', slug)
        .order('revision', { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json({
        items: ((data || []) as Array<Record<string, unknown>>).map((row) => ({
          id: row.id,
          revision: row.revision,
          title: row.title,
          summary: row.summary,
          body: row.body,
          status: row.status,
          reviewState: row.review_state,
          editedAt: row.edited_at,
        })),
      });
    } catch (error) {
      console.error('Site page revisions error:', error);
      res.status(503).json({ error: 'Unable to load the revision history.' });
    }
  });

  // -------------------------------------------------------------------------
  // Admin: write settings.
  // -------------------------------------------------------------------------
  app.put('/api/admin/site-content/settings/:key', deps.requireCapability('site.update'), async (req, res) => {
    const key = String(req.params.key || '');
    const check = validateSettings(key, req.body);
    if (!check.ok || !check.value) return res.status(400).json({ error: check.error || 'Invalid settings.' });
    try {
      const adminUser = (req as Request & { adminUser?: { id: string } }).adminUser;
      const supabase = deps.getSupabase();
      const { data, error } = await supabase
        .from('site_settings')
        .upsert({ key, value: check.value, updated_by: adminUser?.id ?? null }, { onConflict: 'key' })
        .select('key,value,updated_at')
        .single();
      if (error) throw error;
      if (adminUser) {
        await deps.recordAudit(supabase, {
          actorId: adminUser.id,
          action: 'update',
          resourceType: 'site_settings',
          resourceId: key,
          metadata: { group: key },
        });
      }
      res.json({ key: data.key, value: data.value, updatedAt: data.updated_at });
    } catch (error) {
      console.error('Site settings write error:', error);
      res.status(503).json({ error: 'Unable to save that setting.' });
    }
  });

  // -------------------------------------------------------------------------
  // Admin: write a page (and snapshot the new version).
  // -------------------------------------------------------------------------
  app.put('/api/admin/site-content/pages/:slug', deps.requireCapability('site.update'), async (req, res) => {
    const slug = String(req.params.slug || '');
    if (!isServedPageSlug(slug)) return res.status(404).json({ error: 'That page does not exist.' });
    const check = validatePageInput(req.body);
    if (!check.ok || !check.value) return res.status(400).json({ error: check.error || 'Invalid page.' });
    const input = check.value;

    try {
      const adminUser = (req as Request & { adminUser?: { id: string } }).adminUser;
      const supabase = deps.getSupabase();

      const { data: existing, error: readError } = await supabase
        .from('site_pages')
        .select('slug,revision,status')
        .eq('slug', slug)
        .maybeSingle();
      if (readError) throw readError;
      if (!existing) return res.status(404).json({ error: 'That page does not exist.' });

      const revision = Number(existing.revision || 1) + 1;
      const publishedAt = input.status === 'published' ? new Date().toISOString() : null;

      const { data, error } = await supabase
        .from('site_pages')
        .update({
          title: input.title,
          summary: input.summary,
          body: input.body,
          status: input.status,
          review_state: input.reviewState,
          revision,
          updated_by: adminUser?.id ?? null,
          published_at: publishedAt,
        })
        .eq('slug', slug)
        .select(PAGE_COLUMNS)
        .single();
      if (error) throw error;

      const { error: revisionError } = await supabase.from('site_page_revisions').insert({
        slug,
        revision,
        title: input.title,
        summary: input.summary,
        body: input.body,
        status: input.status,
        review_state: input.reviewState,
        edited_by: adminUser?.id ?? null,
      });
      // The page is saved even if the snapshot fails; say so in the log rather
      // than telling the editor the save failed when it did not.
      if (revisionError) console.error('Site page revision snapshot failed:', revisionError);

      if (adminUser) {
        await deps.recordAudit(supabase, {
          actorId: adminUser.id,
          action: 'update',
          resourceType: 'site_page',
          resourceId: slug,
          metadata: { revision, status: input.status, review_state: input.reviewState },
        });
      }
      res.json({ page: pageRowToApi(data as Record<string, unknown>) });
    } catch (error) {
      console.error('Site page write error:', error);
      res.status(503).json({ error: 'Unable to save that page.' });
    }
  });

  // -------------------------------------------------------------------------
  // Admin: restore a revision (as a new revision - history is never rewritten).
  // -------------------------------------------------------------------------
  app.post('/api/admin/site-content/pages/:slug/restore/:revision', deps.requireCapability('site.update'), async (req, res) => {
    const slug = String(req.params.slug || '');
    const target = Number(req.params.revision);
    if (!isServedPageSlug(slug)) return res.status(404).json({ error: 'That page does not exist.' });
    if (!Number.isInteger(target) || target < 1) return res.status(400).json({ error: 'Choose a revision to restore.' });

    try {
      const adminUser = (req as Request & { adminUser?: { id: string } }).adminUser;
      const supabase = deps.getSupabase();
      const { data: snapshot, error: snapshotError } = await supabase
        .from('site_page_revisions')
        .select('revision,title,summary,body,status,review_state')
        .eq('slug', slug)
        .eq('revision', target)
        .maybeSingle();
      if (snapshotError) throw snapshotError;
      if (!snapshot) return res.status(404).json({ error: 'That revision does not exist.' });

      const { data: current, error: currentError } = await supabase
        .from('site_pages')
        .select('revision')
        .eq('slug', slug)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return res.status(404).json({ error: 'That page does not exist.' });

      const revision = Number(current.revision || 1) + 1;
      const { data, error } = await supabase
        .from('site_pages')
        .update({
          title: snapshot.title,
          summary: snapshot.summary,
          body: snapshot.body,
          status: snapshot.status,
          review_state: snapshot.review_state,
          revision,
          updated_by: adminUser?.id ?? null,
          published_at: snapshot.status === 'published' ? new Date().toISOString() : null,
        })
        .eq('slug', slug)
        .select(PAGE_COLUMNS)
        .single();
      if (error) throw error;

      await supabase.from('site_page_revisions').insert({
        slug,
        revision,
        title: snapshot.title,
        summary: snapshot.summary,
        body: snapshot.body,
        status: snapshot.status,
        review_state: snapshot.review_state,
        edited_by: adminUser?.id ?? null,
      });

      if (adminUser) {
        await deps.recordAudit(supabase, {
          actorId: adminUser.id,
          action: 'restore',
          resourceType: 'site_page',
          resourceId: slug,
          metadata: { from_revision: target, revision },
        });
      }
      res.json({ page: pageRowToApi(data as Record<string, unknown>) });
    } catch (error) {
      console.error('Site page restore error:', error);
      res.status(503).json({ error: 'Unable to restore that revision.' });
    }
  });
}
