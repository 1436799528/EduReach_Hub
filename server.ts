import 'dotenv/config';
import compression from 'compression';
import express from 'express';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  hasCapability,
  recordAudit,
  requireCapability,
  requireStaff,
  type AuthorizedRequest,
} from './lib/authorization';
import { getServerSupabaseKey } from './lib/supabase-config';
import { matchesDeclaredImageType } from './lib/image-signature';
import { isPdfBuffer } from './lib/pdf-signature';
import { verifyJWT, type UserPayload } from './lib/auth';
import { notifyServiceRequestStatus } from './src/server/notifications';
import { registerRestrictedBankAdminRoutes } from './src/server/restrictedBanks/routes';
import { isProvenanceGuardRefusal, questionProvenanceRefusal } from './src/server/questionProvenance';
import { SERVICE_REQUEST_TRANSITIONS } from './src/lib/serviceRequestTransitions';
import { type Capability } from './src/lib/capabilities';
import { mockCombinationError, previewPlan } from './src/lib/cbt-config';
import { httpStatusForErrorMessage, userFacingError as normalizeUserFacingError } from './lib/errors';
import { getServerSupabaseClient, supabaseFetch } from './lib/supabase-server';
import { createRateLimiter, RATE_LIMIT_RULES } from './lib/rate-limit';
import { runNewsroomRefresh } from './src/server/newsroom/run';
import { expiresAtFor } from './src/server/newsroom/qualityGate';
import { buildRobotsTxt, buildSitemapXml, collectSitemapEntries, crawlerCacheHeaders, isNonIndexablePath, resolveSiteOrigin } from './src/server/seo';
import { isAnalyticsEvent, sanitizeAnalyticsPath, sanitizeReferrer, sanitizeUserAgent, validateAnalyticsMetadata } from './src/lib/analyticsTaxonomy';
import { OPTIONAL_ANALYTICS_ENABLED } from './src/lib/analyticsAvailability';
import { STALE_AFTER_HOURS, evaluateJobHealth } from './src/server/jobRuns';
import { isArticleCurrent } from './src/lib/newsFreshness';
import { registerQuestionImportRoutes } from './src/server/question-import/routes';
import { isQuestionId, literalLike, parseQuestionBankFilters } from './src/server/questionBankList';
import { registerSiteContentRoutes } from './src/server/siteContent';
import { publicProfileResponse, PUBLIC_PROFILE_SELECT, type PublicProfileRecord } from './src/server/publicProfile';
import { PUBLIC_PROFILE_SLUG_PATTERN } from './src/lib/publicProfile';

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

// Legacy path normalisation: bookmarked or hard-coded `/.netlify/functions/api`
// URLs from the Netlify deployment keep working by collapsing to `/api`.
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
    // HSTS: the site is HTTPS-only in production. Without
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
 * Compress text responses on the wire.
 *
 * Netlify compresses `dist/` itself, so the hosted site always shipped gzip.
 * The self-hosted path (Dockerfile → `npm start` → Express) did not: it served
 * the entry chunk, the stylesheet and the Supabase chunk at their raw sizes
 * (863 KB on the landing route), which is exactly what a throttled phone pays
 * for before it can paint. Measured on the mobile profile in
 * `tests/e2e/perf.spec.ts`, the same three files are 215 KB compressed.
 *
 * `threshold` leaves small JSON bodies alone (the framing overhead would exceed
 * the saving) and `compression` sets `Vary: Accept-Encoding`, so caches never
 * mix the two encodings.
 */
app.use(compression({ threshold: 1024 }));

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
  const client = getServerSupabaseClient();
  if (!client) {
    throw new Error('Supabase server admin key is missing or invalid. Configure SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_SECRET_KEY with the server secret key, not a publishable/anon key.');
  }
  return client;
}

/**
 * A user-scoped Supabase client (publishable key + the caller's access token).
 * Ownership-critical RPCs resolve the caller with `auth.uid()`, which is null
 * for the service-role client - using it here would make those RPCs run as
 * nobody. Returns null when no publishable key is configured, and the caller
 * falls back to the service client (the RPC then refuses, as it did before).
 */
function getUserScopedSupabase(accessToken: string) {
  const url = process.env.VITE_SUPABASE_URL;
  const publishableKey = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !publishableKey) return null;
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => supabaseFetch(input, init),
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

/**
 * Resolve the caller from their session, then authorize them. Authorization
 * failures throw, and every handler maps them to 401 (not signed in) or 403
 * (signed in, not allowed) - the operation never runs.
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
    // The paper route needs the stored protocol even for legacy attempts.
    // A zero-row schema-cache probe detects the missing column without reading
    // candidate data. It does not prove migrations, triggers or grants.
    try {
      const { error } = await getServerSupabase().from('cbt_attempts').select('protocol').limit(0);
      checks.cbt_protocol_schema = { ok: !error, detail: error ? 'CBT protocol schema is unavailable.' : undefined };
    } catch {
      checks.cbt_protocol_schema = { ok: false, detail: 'CBT protocol schema is unavailable.' };
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
  if (req.method === 'POST' && (req.path === '/api/admin/uploads' || req.path === '/api/admin/pdf-bank/upload' || req.path === '/api/admin/question-imports')) return next();
  return jsonBody(req, res, next);
});

registerQuestionImportRoutes(app, {
  requireCapability,
  rateLimitFor,
  adminUploadRateLimit: RATE_LIMIT_RULES.adminUpload,
  adminImportRateLimit: RATE_LIMIT_RULES.adminImport,
  getSupabase: getServerSupabase,
});

// Bank security administration. Writes execute with the caller's own token so
// the database re-checks administrative authority; the service role never
// classifies a bank, assigns a candidate or changes a release time.
registerRestrictedBankAdminRoutes(app, {
  requireCapability,
  getUserScoped: getUserScopedSupabase,
  getSupabase: getServerSupabase,
  recordAudit,
});

// Site-wide content: footer, brand, contact and the policy pages. Public read is
// cached for a minute; writes are capability-gated and audited.
registerSiteContentRoutes(app, { requireCapability, getSupabase: getServerSupabase, recordAudit });

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
  // capability list. It is a UX input only - every endpoint re-checks.
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

app.get('/api/admin/jobs', requireCapability('analytics.read'), async (_req, res) => {
  try {
    // OBS-1: last success, last failure and freshness per scheduled job. Read-only,
    // and it reports jobs that have *no* row at all. A schedule that
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
    // The legacy aggregate includes every bank. Never forward it: differing
    // restricted scores can reveal answers even without per-question results.
    // Missing candidate RPC fails closed for this metric, not the whole page.
    const publicAverage = await supabase.rpc('cbt_public_score_average');
    const safeMetrics = { ...(metrics || {}), average_cbt_score: publicAverage.error ? null : publicAverage.data };
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
    res.json({ metrics: safeMetrics, activity: activity || null, audit, recentRequests: recentRequests.data || [], recentUsers: recentUsers.data || [] });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(503).json({ error: 'Unable to load administrative analytics.' });
  }
});

app.post('/api/analytics/event', rateLimitFor(RATE_LIMIT_RULES.analyticsEvent), async (req, res) => {
  // Also reject old clients: their local consent state cannot authorize collection
  // while durable withdrawal is unresolved. This does not erase historical data.
  if (!OPTIONAL_ANALYTICS_ENABLED) return res.status(503).json({ error: 'Optional analytics are temporarily unavailable.' });
  if (!isServerSupabaseConfigured()) return res.status(204).end();
  try {
    // AN-1: the taxonomy in src/lib/analyticsTaxonomy.ts is the allowlist - the
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
      // PostgREST's filter grammar uses , . ( ) as structure, and % / _ as ILIKE
      // wildcards. Strip all of them, not just the wildcards: a stray parenthesis
      // or dot changes the shape of the filter expression.
      const safe = search.replace(/[%,_.()\\]/g, '');
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
        .select('id,exam_id,status,score,started_at,submitted_at,cbt_exams(title)')
        .eq('user_id', req.params.userId)
        .order('started_at', { ascending: false })
        .limit(20),
    ]);
    // The service-role read above bypasses attempt RLS. Never disclose
    // restricted/unclassified scores through the user activity view.
    const attemptRows = attempts.data || [];
    const examIds = [...new Set(attemptRows.map(row => row.exam_id).filter(Boolean))];
    const policies = examIds.length ? await supabase.from('cbt_bank_security').select('exam_id')
      .eq('visibility', 'public').in('exam_id', examIds) : { data: [], error: null };
    if (policies.error) throw policies.error;
    const publicIds = new Set((policies.data || []).map(row => row.exam_id));
    res.json({
      requests: requests.data || [],
      attempts: attemptRows.map(row => ({ ...row, score: publicIds.has(row.exam_id) ? row.score : null })),
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
  let updateAttempted = false;
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: request, error: requestError } = await supabase
      .from('service_requests')
      .select('id,status,admin_note,user_id,reference_code,service_catalog(title),updated_at')
      .eq('id', req.params.requestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!request) return res.status(404).json({ error: 'Service request not found.' });

    const wantsStatus = req.body?.status !== undefined;
    const wantsNote = req.body?.admin_note !== undefined;
    if (!wantsStatus && !wantsNote) return res.status(400).json({ error: 'Nothing to update.' });

    // A version from the UI detects edits made since the row was displayed.
    // Older clients must refresh rather than submit an unverifiable stale decision.
    const expectedVersion = req.body?.expected_updated_at;
    if (expectedVersion === undefined) return res.status(409).json({ error: 'Refresh the queue before updating this request.' });
    if (typeof expectedVersion !== 'string' || expectedVersion.length > 64 || !Number.isFinite(Date.parse(expectedVersion))) return res.status(400).json({ error: 'Invalid request version.' });
    if (expectedVersion !== request.updated_at) return res.status(409).json({ error: 'This request changed. Refresh the queue before trying again.' });
    const previousTime = Date.parse(String(request.updated_at || ''));
    if (!Number.isFinite(previousTime)) return res.status(503).json({ error: 'Unable to verify this request version.' });
    // Ensure that consecutive writes from this API do not share a millisecond.
    const update: Record<string, unknown> = { updated_at: new Date(Math.max(Date.now(), previousTime + 1)).toISOString() };

    if (wantsNote) {
      const note = String(req.body?.admin_note || '').trim().slice(0, 2000);
      update.admin_note = note || null;
    }

    let nextStatus: string | null = null;
    if (wantsStatus) {
      nextStatus = String(req.body?.status || '');
      if (!Object.hasOwn(SERVICE_REQUEST_TRANSITIONS, nextStatus)) return res.status(400).json({ error: 'Invalid service status.' });
      if (!SERVICE_REQUEST_TRANSITIONS[request.status]?.includes(nextStatus)) return res.status(409).json({ error: `Cannot change status from ${request.status} to ${nextStatus}.` });
      update.status = nextStatus;
    }

    updateAttempted = true;
    const { data, error } = await supabase.from('service_requests').update(update)
      .eq('id', request.id).eq('status', request.status).eq('updated_at', request.updated_at)
      .select('id,status,admin_note,updated_at').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'This request changed. Refresh the queue before trying again.' });
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
    res.status(503).json({ error: updateAttempted
      ? 'Unable to confirm the update. Refresh the queue before retrying.'
      : 'Unable to load the service request. No update was attempted.' });
  }
});

app.get('/api/admin/cbt/exams', requireCapability('cbt.read'), async (_req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('cbt_exams').select('id,title,exam_body,subject,description,duration_minutes,is_active,format_status,official_guidance_url,format_notes,guidance_year,institution_id,created_at').order('created_at', { ascending: false });
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
    const { title, exam_body, subject, description, duration_minutes, is_active, format_status, official_guidance_url, format_notes, guidance_year, institution_id } = req.body || {};
    const duration = Number(duration_minutes);
    if (format_status === 'verified' && !(typeof official_guidance_url === 'string' && /^https:\/\//i.test(official_guidance_url.trim()))) return res.status(400).json({ error: 'A verified exam format requires an official HTTPS guidance link.' });
    if (!title?.trim() || !exam_body?.trim() || !subject?.trim() || !Number.isInteger(duration) || duration < 5 || duration > 180) {
      return res.status(400).json({ error: 'Valid title, exam body, subject and duration are required.' });
    }
    const supabase = getServerSupabase();
    const normalizedBody = String(exam_body).trim().toUpperCase();
    const institutionId = String(institution_id || '').trim() || null;
    if (normalizedBody === 'POST-UTME') {
      if (!institutionId) return res.status(400).json({ error: 'Select a verified institution for a Post-UTME CBT bank.' });
      const { data: school, error: schoolError } = await supabase.from('institutions')
        .select('id,post_utme_available,post_utme_method,post_utme_verified')
        .eq('id', institutionId).maybeSingle();
      if (schoolError || !school || school.post_utme_available !== true || school.post_utme_verified !== true || school.post_utme_method !== 'cbt') {
        return res.status(400).json({ error: 'A Post-UTME CBT bank can only be linked to a verified school that uses CBT.' });
      }
    }
    const { data, error } = await supabase.from('cbt_exams').insert({
      title: title.trim(), exam_body: exam_body.trim().toUpperCase(), subject: subject.trim(),
      description: description?.trim() || null, duration_minutes: duration, is_active: is_active !== false,
      format_status: ['verified', 'partially_verified', 'unverified'].includes(format_status) ? format_status : 'unverified',
      official_guidance_url: typeof official_guidance_url === 'string' && /^https:\/\//i.test(official_guidance_url.trim()) ? official_guidance_url.trim().slice(0, 1000) : null,
      format_notes: typeof format_notes === 'string' ? format_notes.trim().slice(0, 1200) || null : null,
      guidance_year: Number.isInteger(Number(guidance_year)) && Number(guidance_year) >= 2000 && Number(guidance_year) <= 2100 ? Number(guidance_year) : null,
      institution_id: normalizedBody === 'POST-UTME' ? institutionId : null,
      created_by: adminUser.id,
    }).select('id,title,exam_body,subject,description,duration_minutes,is_active,format_status,official_guidance_url,format_notes,guidance_year,institution_id,created_at').single();
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
    const { data: existing, error: existingError } = await supabase.from('cbt_exams').select('id,title,is_active,official_guidance_url,exam_body,institution_id').eq('id', req.params.examId).single();
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
    if (req.body?.institution_id !== undefined || req.body?.exam_body !== undefined) {
      const body = String(req.body?.exam_body ?? existing.exam_body).trim().toUpperCase();
      const institutionId = String(req.body?.institution_id ?? existing.institution_id ?? '').trim() || null;
      if (body === 'POST-UTME') {
        if (!institutionId) return res.status(400).json({ error: 'Select a verified institution for a Post-UTME CBT bank.' });
        const { data: school, error: schoolError } = await supabase.from('institutions')
          .select('id,post_utme_available,post_utme_method,post_utme_verified')
          .eq('id', institutionId).maybeSingle();
        if (schoolError || !school || school.post_utme_available !== true || school.post_utme_verified !== true || school.post_utme_method !== 'cbt') {
          return res.status(400).json({ error: 'A Post-UTME CBT bank can only be linked to a verified school that uses CBT.' });
        }
      }
      patch.institution_id = body === 'POST-UTME' ? institutionId : null;
    }
    if (req.body?.format_status !== undefined) {
      const value = String(req.body.format_status);
      if (!['verified', 'partially_verified', 'unverified'].includes(value)) return res.status(400).json({ error: 'Invalid exam format verification status.' });
      if (value === 'verified' && !(typeof req.body?.official_guidance_url === 'string' && /^https:\/\//i.test(req.body.official_guidance_url.trim())) && !(typeof existing.official_guidance_url === 'string' && /^https:\/\//i.test(existing.official_guidance_url.trim()))) return res.status(400).json({ error: 'A verified exam format requires an official HTTPS guidance link.' });
      patch.format_status = value;
    }
    if (req.body?.official_guidance_url !== undefined) {
      const value = String(req.body.official_guidance_url || '').trim();
      if (value && !/^https:\/\//i.test(value)) return res.status(400).json({ error: 'Official guidance links must use HTTPS.' });
      patch.official_guidance_url = value.slice(0, 1000) || null;
    }
    if (req.body?.format_notes !== undefined) patch.format_notes = String(req.body.format_notes || '').trim().slice(0, 1200) || null;
    if (req.body?.guidance_year !== undefined) {
      const year = Number(req.body.guidance_year);
      if (req.body.guidance_year !== null && req.body.guidance_year !== '' && (!Number.isInteger(year) || year < 2000 || year > 2100)) return res.status(400).json({ error: 'Guidance year must be between 2000 and 2100.' });
      patch.guidance_year = req.body.guidance_year === null || req.body.guidance_year === '' ? null : year;
    }
    if (req.body?.duration_minutes !== undefined) {
      const duration = Number(req.body.duration_minutes);
      if (!Number.isInteger(duration) || duration < 5 || duration > 180) {
        return res.status(400).json({ error: 'The default duration must be a whole number of minutes between 5 and 180.' });
      }
      patch.duration_minutes = duration;
    }
    if (req.body?.is_active !== undefined) patch.is_active = req.body.is_active === true;
    if (Object.keys(patch).length === 1) return res.status(400).json({ error: 'Nothing to update.' });
    const { data, error } = await supabase.from('cbt_exams').update(patch).eq('id', existing.id).select('id,title,exam_body,subject,description,duration_minutes,is_active,format_status,official_guidance_url,format_notes,guidance_year,institution_id,created_at').single();
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
    // Never erase a bank students have attempted - history integrity wins.
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
    let filters;
    try { filters = parseQuestionBankFilters(req.query); }
    catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid question filter.' }); }
    const supabase = getServerSupabase();
    let query = supabase.from('exam_questions').select('id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,marks,position,source_type,source_name,source_url,source_year,syllabus_topic,difficulty,review_status,format_verified,response_type,import_id').eq('exam_id', req.params.examId);
    if (filters.search) query = isQuestionId(filters.search) ? query.eq('id', filters.search) : query.ilike('question_text', literalLike(filters.search));
    if (filters.subject) query = query.ilike('subject', literalLike(filters.subject));
    if (filters.topic) query = query.ilike('syllabus_topic', literalLike(filters.topic));
    if (filters.year !== null) query = query.eq('source_year', filters.year);
    if (filters.review) query = query.eq('review_status', filters.review);
    const offset = (filters.page - 1) * filters.pageSize;
    const [{ data, error }, last] = await Promise.all([
      query.order('position', { ascending: true }).order('id', { ascending: true }).range(offset, offset + filters.pageSize),
      supabase.from('exam_questions').select('position').eq('exam_id', req.params.examId).order('position', { ascending: false }).limit(1),
    ]);
    if (error || last.error) throw error || last.error;
    const items = data || [];
    res.json({ items: items.slice(0, filters.pageSize), page: filters.page, hasMore: items.length > filters.pageSize, nextPosition: Number(last.data?.[0]?.position || 0) + 1 });
  } catch (error) {
    console.error('Admin CBT questions error:', error);
    res.status(503).json({ error: 'Unable to load CBT questions.' });
  }
});

// The provenance guard in the database refuses question text that already
// exists in a restricted bank. The classifier in src/server/questionProvenance.ts
// matches only that guard's SQLSTATE plus its machine-readable DETAIL marker, so
// permission denials, unique violations, a missing candidate schema and the
// other policy gates keep the handling they had before.
//
// A refusal is a deliberate copy attempt and is recorded before the 403 is
// returned. The audit row and the operator log carry ids only: never the
// question text, its fingerprint, the restricted bank's title or the raw
// database error.
async function refuseQuestionProvenance(
  req: express.Request,
  res: express.Response,
  error: unknown,
  phase: 'create' | 'update',
  entityType: 'cbt_bank' | 'exam_question',
  entityId: string | null,
): Promise<boolean> {
  if (!isProvenanceGuardRefusal(error)) return false;
  const adminUser = (req as AuthorizedRequest).adminUser;
  console.warn('Question provenance guard refused a write.', { phase, entity_type: entityType, entity_id: entityId });
  if (adminUser?.id) {
    try {
      await getServerSupabase().rpc('admin_audit_log', {
        p_admin_user_id: adminUser.id,
        p_action: 'question_provenance_refused',
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_metadata: { result: 'failure', phase },
      });
    } catch (auditError) {
      // The refusal stands even when the audit write fails; log the failure
      // without the refused content.
      console.error('Provenance refusal audit write failed:', auditError instanceof Error ? auditError.message : 'unknown');
    }
  }
  res.status(403).json(questionProvenanceRefusal());
  return true;
}

app.post('/api/admin/cbt/exams/:examId/questions', requireCapability('cbt.manage'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const { subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_url, source_year, syllabus_topic, difficulty, review_status, format_verified } = req.body || {};
    const numericMarks = Number(marks || 1); const numericPosition = Number(position);
    if (!question_text?.trim() || !option_a?.trim() || !option_b?.trim() || !option_c?.trim() || !option_d?.trim() ||
      !['A','B','C','D'].includes(correct_option) || !Number.isInteger(numericMarks) || numericMarks < 1 ||
      !Number.isInteger(numericPosition) || numericPosition < 1) return res.status(400).json({ error: 'Invalid CBT question data.' });
    if (source_type === 'official_past_question' && (!(typeof source_url === 'string' && /^https:\/\//i.test(source_url.trim())) || !(typeof source_name === 'string' && source_name.trim()))) return res.status(400).json({ error: 'Official past questions require a verified HTTPS source URL and source name.' });
    const supabase = getServerSupabase();
    const { data: exam } = await supabase.from('cbt_exams').select('id,subject').eq('id', req.params.examId).maybeSingle();
    if (!exam) return res.status(404).json({ error: 'CBT exam not found.' });
    const questionSubject = (typeof subject === 'string' && subject.trim()) ? subject.trim() : (exam.subject?.trim() || 'General');
    const { data, error } = await supabase.from('exam_questions').insert({
      exam_id: exam.id, subject: questionSubject, question_text: question_text.trim(), option_a: option_a.trim(), option_b: option_b.trim(),
      option_c: option_c.trim(), option_d: option_d.trim(), correct_option, explanation: explanation?.trim() || null,
      marks: numericMarks, position: numericPosition,
      source_type: ['official_past_question','adapted_practice','original_practice','unverified'].includes(source_type) ? source_type : 'unverified',
      source_name: typeof source_name === 'string' ? source_name.trim().slice(0, 200) || null : null,
      source_url: typeof source_url === 'string' && /^https:\/\//i.test(source_url.trim()) ? source_url.trim().slice(0, 1000) : null,
      source_year: Number.isInteger(Number(source_year)) && Number(source_year) >= 1990 && Number(source_year) <= 2100 ? Number(source_year) : null,
      syllabus_topic: typeof syllabus_topic === 'string' ? syllabus_topic.trim().slice(0, 200) || null : null,
      difficulty: ['easy','moderate','difficult'].includes(difficulty) ? difficulty : null,
      review_status: ['needs_review','approved','rejected'].includes(review_status) ? review_status : 'needs_review',
      format_verified: format_verified === true,
    }).select('id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,marks,position,source_type,source_name,source_url,source_year,syllabus_topic,difficulty,review_status,format_verified,response_type').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'create', p_entity_type: 'exam_question', p_entity_id: data.id, p_metadata: { exam_id: exam.id, position: numericPosition } });
    res.status(201).json({ item: data });
  } catch (error) {
    if (isProvenanceGuardRefusal(error)) {
      if (await refuseQuestionProvenance(req, res, error, 'create', 'cbt_bank', req.params.examId)) return;
    }
    console.error('Admin CBT question create error:', error);
    const message = error instanceof Error && error.message.includes('duplicate') ? 'That question position is already in use.' : 'Unable to create CBT question.';
    res.status(400).json({ error: publicErrorMessage(message, 'Invalid CBT question data. Please check the question and try again.') });
  }
});

app.patch('/api/admin/cbt/questions/:questionId', requireCapability('cbt.manage'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const { subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_url, source_year, syllabus_topic, difficulty, review_status, format_verified } = req.body || {};
    const numericMarks = Number(marks || 1); const numericPosition = Number(position);
    if (!question_text?.trim() || !option_a?.trim() || !option_b?.trim() || !option_c?.trim() || !option_d?.trim() ||
      !['A','B','C','D'].includes(correct_option) || !Number.isInteger(numericMarks) || numericMarks < 1 ||
      !Number.isInteger(numericPosition) || numericPosition < 1) return res.status(400).json({ error: 'Invalid CBT question data.' });
    if (source_type === 'official_past_question' && (!(typeof source_url === 'string' && /^https:\/\//i.test(source_url.trim())) || !(typeof source_name === 'string' && source_name.trim()))) return res.status(400).json({ error: 'Official past questions require a verified HTTPS source URL and source name.' });
    const supabase = getServerSupabase();
    const updatePayload: Record<string, unknown> = {
      question_text: question_text.trim(), option_a: option_a.trim(), option_b: option_b.trim(), option_c: option_c.trim(),
      option_d: option_d.trim(), correct_option, explanation: explanation?.trim() || null, marks: numericMarks, position: numericPosition,
      updated_at: new Date().toISOString(),
    };
    if (typeof subject === 'string' && subject.trim()) updatePayload.subject = subject.trim();
    if (source_type !== undefined) {
      if (!['official_past_question','adapted_practice','original_practice','unverified'].includes(source_type)) return res.status(400).json({ error: 'Invalid question source type.' });
      updatePayload.source_type = source_type;
    }
    if (source_name !== undefined) updatePayload.source_name = String(source_name || '').trim().slice(0, 200) || null;
    if (source_url !== undefined) {
      const value = String(source_url || '').trim();
      if (value && !/^https:\/\//i.test(value)) return res.status(400).json({ error: 'Question source links must use HTTPS.' });
      updatePayload.source_url = value.slice(0, 1000) || null;
    }
    if (source_year !== undefined) {
      const year = Number(source_year);
      if (source_year !== null && source_year !== '' && (!Number.isInteger(year) || year < 1990 || year > 2100)) return res.status(400).json({ error: 'Source year must be between 1990 and 2100.' });
      updatePayload.source_year = source_year === null || source_year === '' ? null : year;
    }
    if (syllabus_topic !== undefined) updatePayload.syllabus_topic = String(syllabus_topic || '').trim().slice(0, 200) || null;
    if (difficulty !== undefined) {
      if (difficulty !== null && difficulty !== '' && !['easy','moderate','difficult'].includes(difficulty)) return res.status(400).json({ error: 'Invalid difficulty level.' });
      updatePayload.difficulty = difficulty || null;
    }
    if (review_status !== undefined) {
      if (!['needs_review','approved','rejected'].includes(review_status)) return res.status(400).json({ error: 'Invalid review status.' });
      updatePayload.review_status = review_status;
    }
    if (format_verified !== undefined) updatePayload.format_verified = format_verified === true;
    if (req.body?.exam_id !== undefined) {
      // Moving a question between banks carries restricted material with it. The
      // database refuses it outright; record the attempt before refusing here so
      // the audit trail shows a deliberate move, not a mistake.
      await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'question_bank_move_refused', p_entity_type: 'exam_question', p_entity_id: req.params.questionId, p_metadata: { result: 'failure', requested_exam_id: String(req.body.exam_id) } });
      return res.status(403).json({ error: 'A question cannot be moved between question banks. Create it in the destination bank instead.' });
    }
    const { data, error } = await supabase.from('exam_questions').update(updatePayload).eq('id', req.params.questionId).select('id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,marks,position,source_type,source_name,source_url,source_year,syllabus_topic,difficulty,review_status,format_verified,response_type').single();
    if (error) {
      if (/security review/i.test(error.message || '')) {
        await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'question_bank_move_refused', p_entity_type: 'exam_question', p_entity_id: req.params.questionId, p_metadata: { result: 'failure' } });
        return res.status(403).json({ error: 'A question cannot be moved between question banks.' });
      }
      if (await refuseQuestionProvenance(req, res, error, 'update', 'exam_question', req.params.questionId)) return;
      throw error;
    }
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'update', p_entity_type: 'exam_question', p_entity_id: data.id, p_metadata: { position: numericPosition } });
    res.json({ item: data });
  } catch (error) {
    if (!res.headersSent && isProvenanceGuardRefusal(error)) {
      if (await refuseQuestionProvenance(req, res, error, 'update', 'exam_question', req.params.questionId)) return;
    }
    if (res.headersSent) return;
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

async function uniqueNewsSlug(supabase: SupabaseClient, base: string, excludeId?: string): Promise<string> {
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

const newsRowSelect = 'id,slug,title,excerpt,body,category,image_url,source_name,source_url,published,published_at,featured,tags,is_placeholder,placeholder_note,updated_at';

// Comma-separated tag list → trimmed, de-duplicated, capped. Empty → null.
function normalizeTags(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const list = Array.isArray(value) ? value : String(value).split(',');
  const cleaned = Array.from(new Set(list.map((tag) => String(tag || '').trim().slice(0, 40)).filter(Boolean))).slice(0, 12);
  return cleaned.length ? cleaned.join(', ') : null;
}

app.get('/api/admin/news', requireCapability('news.read'), async (req, res) => {
  try {
    for (const key of ['state', 'page', 'pageSize', 'search']) {
      if (req.query[key] !== undefined && typeof req.query[key] !== 'string') return res.status(400).json({ error: 'Invalid news list parameter.' });
    }
    const state = typeof req.query.state === 'string' ? req.query.state : 'all';
    if (!['all', 'draft', 'published', 'placeholder'].includes(state)) return res.status(400).json({ error: 'Invalid article state.' });
    const pageText = typeof req.query.page === 'string' ? req.query.page : '1';
    const sizeText = typeof req.query.pageSize === 'string' ? req.query.pageSize : '200';
    if (!/^\d+$/.test(pageText) || !/^\d+$/.test(sizeText)) return res.status(400).json({ error: 'Invalid pagination.' });
    const page = Number(pageText);
    const pageSize = Number(sizeText);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200 || !Number.isSafeInteger(page * pageSize)) return res.status(400).json({ error: 'Invalid pagination.' });
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length > 120) return res.status(400).json({ error: 'Search is too long.' });
    const supabase = getServerSupabase();
    let query = supabase.from('news_articles').select(newsRowSelect);
    if (state === 'draft') query = query.eq('published', false);
    if (state === 'published') query = query.eq('published', true);
    if (state === 'placeholder') query = query.eq('is_placeholder', true);
    // Treat LIKE metacharacters as literal user input rather than broadening a search.
    if (search) query = query.ilike('title', `%${search.replace(/[\\%_*]/g, '\\$&')}%`);
    const offset = (page - 1) * pageSize;
    const { data, error } = await query.order('updated_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + pageSize);
    if (error) throw error;
    const rows = data || [];
    res.json({ items: rows.slice(0, pageSize), page, pageSize, hasMore: rows.length > pageSize });
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
    if (req.body?.is_placeholder !== undefined && typeof req.body.is_placeholder !== 'boolean') return res.status(400).json({ error: 'Placeholder status must be true or false.' });
    const isPlaceholder = req.body?.is_placeholder === true;
    const placeholderNote = typeof req.body?.placeholder_note === 'string' ? req.body.placeholder_note.trim().slice(0, 1000) : '';
    const published = req.body?.published === true;
    if (isPlaceholder && !placeholderNote) return res.status(400).json({ error: 'Describe what information is needed for this placeholder.' });
    if (isPlaceholder && published) return res.status(400).json({ error: 'Placeholder articles must remain unpublished.' });
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
      is_placeholder: isPlaceholder,
      placeholder_note: isPlaceholder ? placeholderNote : null,
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

// Undo used to re-create a deleted article through POST /api/admin/news. That
// worked, but it changed the row's id and sometimes its slug, so an old link or
// an audit reference pointed at an article that no longer existed. Restore is a
// separate write: it keeps the original id and slug when they are still free,
// and reports a conflict instead of silently inventing a new identity.
app.post('/api/admin/news/restore', requireCapability('news.create'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const item = req.body?.item;
    if (!item || typeof item !== 'object') return res.status(400).json({ error: 'The deleted article snapshot is required.' });
    const id = String(item.id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'The deleted article id is not valid.' });
    }
    const title = String(item.title || '').trim();
    const bodyText = String(item.body || '').trim();
    const slug = String(item.slug || '').trim();
    if (!title || !bodyText) return res.status(400).json({ error: 'Article title and body are required.' });
    if (!slug) return res.status(400).json({ error: 'Article slug is required.' });
    const published = item.published === true;
    if (published && !hasCapability((req as AuthorizedRequest).adminUser, 'news.publish')) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    const isPlaceholder = item.is_placeholder === true;
    const placeholderNote = typeof item.placeholder_note === 'string' ? item.placeholder_note.trim().slice(0, 1000) : '';
    if (isPlaceholder && !placeholderNote) return res.status(400).json({ error: 'Describe what information is needed for this placeholder.' });
    if (isPlaceholder && published) return res.status(400).json({ error: 'Placeholder articles must remain unpublished.' });
    let publishedAt: string | null = null;
    if (published && item.published_at) {
      const parsedAt = new Date(String(item.published_at));
      if (!Number.isFinite(parsedAt.getTime())) return res.status(400).json({ error: 'The publication date is invalid.' });
      publishedAt = parsedAt.toISOString();
    }
    const imageUrl = safeContentUrl(item.image_url);
    const sourceUrl = safeContentUrl(item.source_url);
    if ((item.image_url && !imageUrl) || (item.source_url && !sourceUrl)) {
      return res.status(400).json({ error: 'Image and source links must use HTTPS or a site-relative path.' });
    }
    const row = {
      id,
      slug,
      title,
      excerpt: item.excerpt ? String(item.excerpt).trim() : null,
      body: bodyText,
      category: String(item.category || 'general').trim().toLowerCase() || 'general',
      image_url: imageUrl,
      source_name: item.source_name ? String(item.source_name).trim() : null,
      source_url: sourceUrl,
      published,
      published_at: publishedAt,
      featured: item.featured === true,
      tags: normalizeTags(item.tags),
      is_placeholder: isPlaceholder,
      placeholder_note: isPlaceholder ? placeholderNote : null,
    };
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('news_articles').insert(row).select(newsRowSelect).single();
    if (error?.code === '23505') return res.status(409).json({ error: 'An article with this identity already exists. Reload the list before trying again.' });
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'news_restore', p_entity_type: 'news_article', p_entity_id: data.id, p_metadata: { slug } });
    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Admin news restore error:', error);
    res.status(500).json({ error: 'Unable to restore this article.' });
  }
});

app.patch('/api/admin/news/:articleId', requireCapability('news.update'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: existing, error: existingError } = await supabase.from('news_articles').select('id,slug,published,published_at,is_placeholder,placeholder_note').eq('id', req.params.articleId).single();
    if (existingError || !existing) return res.status(404).json({ error: 'News article not found.' });
    if (req.body?.is_placeholder !== undefined && typeof req.body.is_placeholder !== 'boolean') return res.status(400).json({ error: 'Placeholder status must be true or false.' });
    const nextPlaceholder = req.body?.is_placeholder === undefined ? existing.is_placeholder === true : req.body.is_placeholder;
    const nextNote = req.body?.placeholder_note === undefined
      ? String(existing.placeholder_note || '').trim()
      : typeof req.body.placeholder_note === 'string' ? req.body.placeholder_note.trim().slice(0, 1000) : '';
    const nextPublished = req.body?.published === undefined ? existing.published === true : req.body.published === true;
    if (nextPlaceholder && !nextNote) return res.status(400).json({ error: 'Describe what information is needed for this placeholder.' });
    if (nextPlaceholder && nextPublished) return res.status(400).json({ error: 'Placeholder articles must remain unpublished.' });
    if (existing.is_placeholder === true && !nextPlaceholder && req.body?.confirm_placeholder_replacement !== true) return res.status(400).json({ error: 'Confirm that this placeholder has been replaced with genuine content.' });
    if (existing.is_placeholder === true && !nextPlaceholder && nextPublished) return res.status(400).json({ error: 'Save the replacement as a draft before publishing it.' });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (req.body?.is_placeholder !== undefined) patch.is_placeholder = nextPlaceholder;
    if (req.body?.placeholder_note !== undefined || (req.body?.is_placeholder !== undefined && !nextPlaceholder)) patch.placeholder_note = nextPlaceholder ? nextNote : null;
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
    const { data, error } = await supabase.from('news_articles').update(patch).eq('id', existing.id).eq('is_placeholder', existing.is_placeholder === true).select(newsRowSelect).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'This article changed while you were editing it. Reload it and try again.' });
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'news_update', p_entity_type: 'news_article', p_entity_id: existing.id, p_metadata: { slug: data.slug, placeholder_replaced: existing.is_placeholder === true && !nextPlaceholder } });
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
    if (error?.code === '23503') return res.status(409).json({ error: 'This article is linked to other records. Review those links before deleting it.' });
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

function validateCalendarPayload(body: unknown, type: string): { error?: string; values?: Record<string, unknown> } {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const title = String(input.title || '').trim().slice(0, 200);
  if (!title) return { error: 'A title is required.' };
  const values: Record<string, unknown> = {
    title,
    description: String(input.description || '').trim().slice(0, 20000) || null,
    priority: CALENDAR_PRIORITIES.includes(String(input.priority || 'normal')) ? String(input.priority || 'normal') : 'normal',
    status: CALENDAR_STATUSES.includes(String(input.status || 'pending')) ? String(input.status || 'pending') : 'pending',
  };
  if (type === 'exam') {
    const startsAt = new Date(String(input.starts_at || ''));
    if (!Number.isFinite(startsAt.getTime())) return { error: 'A valid start date/time is required.' };
    values.starts_at = startsAt.toISOString();
    if (input.ends_at) {
      const endsAt = new Date(String(input.ends_at));
      if (!Number.isFinite(endsAt.getTime())) return { error: 'The end date/time is invalid.' };
      values.ends_at = endsAt.toISOString();
    } else {
      values.ends_at = null;
    }
    values.location = String(input.location || '').trim().slice(0, 200) || null;
  } else {
    const dueAt = new Date(String(input.due_at || ''));
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

function validateInstitutionPayload(body: unknown): { error?: string; values?: Record<string, unknown> } {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const schoolName = String(input.school_name || '').trim().slice(0, 200);
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
    const postUtmeAvailable = Boolean(input.post_utme_available);
    const postUtmeMethod = String(input.post_utme_method || '');
    const postUtmeVerified = Boolean(input.post_utme_verified);
    if (postUtmeAvailable && !['cbt', 'handwritten'].includes(postUtmeMethod)) return { error: 'Choose whether this institution uses CBT or handwritten Post-UTME.' };
    if (postUtmeAvailable && !input.post_utme_source_url) return { error: 'Add the official Post-UTME source URL before listing this school.' };
    if (postUtmeVerified && (!postUtmeAvailable || !['cbt', 'handwritten'].includes(postUtmeMethod) || !input.post_utme_source_url)) return { error: 'Verify Post-UTME participation only after setting its method and official source URL.' };
    return {
      values: {
        school_name: schoolName,
        acronym: String(input.acronym || '').trim().slice(0, 40) || null,
        slug: String(input.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || null,
        state: String(input.state || '').trim().slice(0, 60) || null,
        institution_type: String(input.institution_type || '').trim().slice(0, 60) || null,
        website_url: httpsUrl(input.website_url, 'website URL'),
        admission_portal_url: httpsUrl(input.admission_portal_url, 'admission portal URL'),
        student_portal_url: httpsUrl(input.student_portal_url, 'student portal URL'),
        is_verified: Boolean(input.is_verified),
        post_utme_available: Boolean(input.post_utme_available),
        post_utme_method: ['cbt', 'handwritten'].includes(String(input.post_utme_method || '')) ? String(input.post_utme_method) : null,
        post_utme_source_url: httpsUrl(input.post_utme_source_url, 'Post-UTME official source URL'),
        post_utme_verified: Boolean(input.post_utme_verified),
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
    let query = supabase.from('institutions').select('id,school_name,acronym,slug,state,institution_type,website_url,admission_portal_url,student_portal_url,is_verified,created_at,updated_at,post_utme_available,post_utme_method,post_utme_source_url,post_utme_verified').order('school_name', { ascending: true }).limit(500);
    if (search) {
      // PostgREST's filter grammar uses , . ( ) as structure, and % / _ as ILIKE
      // wildcards. Strip all of them, not just the wildcards: a stray parenthesis
      // or dot changes the shape of the filter expression.
      const safe = search.replace(/[%,_.()\\]/g, '');
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
    const { data, error } = await supabase.from('institutions').insert(check.values).select('id,school_name,acronym,slug,state,institution_type,website_url,admission_portal_url,student_portal_url,is_verified,post_utme_available,post_utme_method,post_utme_source_url,post_utme_verified,created_at,updated_at').single();
    if (error) throw error;
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
    const { data, error } = await supabase.from('institutions').update(check.values).eq('id', req.params.institutionId).select('id,school_name,acronym,slug,state,institution_type,website_url,admission_portal_url,student_portal_url,is_verified,post_utme_available,post_utme_method,post_utme_source_url,post_utme_verified,created_at,updated_at').single();
    if (error || !data) return res.status(404).json({ error: 'Institution not found.' });
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
      return res.status(400).json({ error: 'Built-in application form services cannot be deleted. Deactivate them instead.' });
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

// --- Service guides (admin-managed step-by-step instructions) --------------
// A guide row overrides the built-in guide in src/data/serviceGuides.ts for
// one service. Public reads only ever see published rows; drafts, edits and
// resets require the service.read / service.update capabilities checked here
// on the server.

const GUIDE_IMAGE_KINDS = new Set(['screenshot', 'official-document', 'illustration', 'photo', 'placeholder']);

type GuideStepPayload = { title: string; body: string; image: string; imageAlt: string; imageKind: string; imageSource: string; section?: string };

/** Returns the normalized guide or an error message. Steps are edited and published as one unit. */
function normalizeGuidePayload(body: any): { guide: { eyebrow: string; summary: string; safetyNote: string; status: string; steps: GuideStepPayload[] } } | { error: string } {
  const rawSteps = body?.steps;
  if (!Array.isArray(rawSteps) || rawSteps.length < 1 || rawSteps.length > 24) return { error: 'A guide needs between 1 and 24 steps.' };
  const steps: GuideStepPayload[] = [];
  for (const [index, raw] of rawSteps.entries()) {
    const title = String(raw?.title || '').trim().slice(0, 120);
    const stepBody = String(raw?.body || '').trim().slice(0, 1000);
    const image = safeContentUrl(raw?.image);
    const imageKind = String(raw?.imageKind || '');
    if (!title || !stepBody) return { error: `Step ${index + 1} needs a title and instructions.` };
    if (!image) return { error: `Step ${index + 1} needs an image uploaded here, a site path or an HTTPS image link.` };
    if (!GUIDE_IMAGE_KINDS.has(imageKind)) return { error: `Step ${index + 1} has an unrecognised image type.` };
    const step: GuideStepPayload = {
      title,
      body: stepBody,
      image,
      imageAlt: String(raw?.imageAlt || '').trim().slice(0, 300) || title,
      imageKind,
      imageSource: String(raw?.imageSource || '').trim().slice(0, 300) || 'Admin-provided image',
    };
    const section = String(raw?.section || '').trim().slice(0, 80);
    if (section) step.section = section;
    steps.push(step);
  }
  const status = body?.status === 'published' ? 'published' : 'draft';
  return {
    guide: {
      eyebrow: String(body?.eyebrow || '').trim().slice(0, 80),
      summary: String(body?.summary || '').trim().slice(0, 600),
      safetyNote: String(body?.safetyNote || '').trim().slice(0, 600),
      status,
      steps,
    },
  };
}

function guideRowToApi(row: any) {
  return {
    slug: row.service_key,
    eyebrow: row.eyebrow || '',
    summary: row.summary || '',
    safetyNote: row.safety_note || '',
    status: row.status,
    steps: Array.isArray(row.steps) ? row.steps : [],
    updatedAt: row.updated_at,
  };
}

app.get('/api/services/:slug/guide', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ guide: null });
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('service_guides')
      .select('service_key,eyebrow,summary,safety_note,steps,status,updated_at')
      .eq('service_key', req.params.slug.trim().toLowerCase())
      .eq('status', 'published')
      .maybeSingle();
    if (error) throw error;
    res.json({ guide: data ? guideRowToApi(data) : null });
  } catch (error) {
    console.error('Service guide error:', error);
    res.json({ guide: null });
  }
});

app.get('/api/admin/services/:serviceId/guide', requireCapability('service.read'), async (req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data: service, error: serviceError } = await supabase.from('service_catalog').select('id,service_key').eq('id', req.params.serviceId).single();
    if (serviceError || !service) return res.status(404).json({ error: 'Service not found.' });
    const { data, error } = await supabase.from('service_guides').select('service_key,eyebrow,summary,safety_note,steps,status,updated_at').eq('service_key', service.service_key).maybeSingle();
    if (error) throw error;
    res.json({ guide: data ? guideRowToApi(data) : null, serviceKey: service.service_key });
  } catch (error) {
    console.error('Admin service guide load error:', error);
    res.status(500).json({ error: 'Unable to load the service guide.' });
  }
});

app.put('/api/admin/services/:serviceId/guide', requireCapability('service.update'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const parsed = normalizeGuidePayload(req.body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    const supabase = getServerSupabase();
    const { data: service, error: serviceError } = await supabase.from('service_catalog').select('id,service_key').eq('id', req.params.serviceId).single();
    if (serviceError || !service) return res.status(404).json({ error: 'Service not found.' });
    const { data, error } = await supabase.from('service_guides').upsert({
      service_key: service.service_key,
      eyebrow: parsed.guide.eyebrow,
      summary: parsed.guide.summary,
      safety_note: parsed.guide.safetyNote,
      steps: parsed.guide.steps,
      status: parsed.guide.status,
      updated_by: adminUser.id,
    }, { onConflict: 'service_key' }).select('service_key,eyebrow,summary,safety_note,steps,status,updated_at').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'update', p_entity_type: 'service_guide', p_entity_id: null, p_metadata: { key: service.service_key, status: parsed.guide.status, steps: parsed.guide.steps.length } });
    res.json({ guide: guideRowToApi(data) });
  } catch (error) {
    console.error('Admin service guide save error:', error);
    res.status(500).json({ error: 'Unable to save the service guide.' });
  }
});

app.delete('/api/admin/services/:serviceId/guide', requireCapability('service.update'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: service, error: serviceError } = await supabase.from('service_catalog').select('id,service_key').eq('id', req.params.serviceId).single();
    if (serviceError || !service) return res.status(404).json({ error: 'Service not found.' });
    const { error } = await supabase.from('service_guides').delete().eq('service_key', service.service_key);
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'delete', p_entity_type: 'service_guide', p_entity_id: null, p_metadata: { key: service.service_key } });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin service guide reset error:', error);
    res.status(500).json({ error: 'Unable to reset the service guide.' });
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

function validateOpportunityPayload(body: unknown): { error?: string; values?: Record<string, unknown> } {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const title = String(input.title || '').trim().slice(0, 200);
  if (!title) return { error: 'A title is required.' };
  const category = String(input.category || 'scholarship');
  if (!OPPORTUNITY_CATEGORIES.includes(category)) return { error: 'Invalid opportunity category.' };
  let linkUrl: string | null = null;
  if (input.link_url) {
    linkUrl = safeContentUrl(input.link_url);
    if (!linkUrl) return { error: 'The link must use HTTPS.' };
  }
  let deadline: string | null = null;
  if (input.deadline) {
    const parsed = new Date(String(input.deadline));
    if (!Number.isFinite(parsed.getTime())) return { error: 'The deadline date is invalid.' };
    deadline = parsed.toISOString().slice(0, 10);
  }
  const workMode = input.work_mode ? String(input.work_mode).trim().slice(0, 40) : null;
  if (workMode && !['remote', 'hybrid', 'onsite', 'not-specified'].includes(workMode)) {
    return { error: 'Invalid work mode.' };
  }
  return {
    values: {
      title,
      organisation: String(input.organisation || '').trim().slice(0, 160) || null,
      category,
      subcategory: String(input.subcategory || '').trim().slice(0, 100) || null,
      description: String(input.description || '').trim() || null,
      link_url: linkUrl,
      deadline,
      locations: String(input.locations || '').trim().slice(0, 160) || null,
      eligibility: String(input.eligibility || '').trim().slice(0, 1000) || null,
      education_levels: normalizeOpportunityArray(input.education_levels),
      disciplines: normalizeOpportunityArray(input.disciplines),
      work_mode: workMode,
      is_featured: Boolean(input.is_featured),
      is_active: input.is_active === undefined ? true : Boolean(input.is_active),
    },
  };
}

/**
 * Opportunities column tiers.
 *
 * The catalogue grew in three separate migrations - provenance and `closed_at`
 * (20260930120000), `eligibility` (20261002150000) and the discovery fields
 * (20261003190000) - so a database that is one release behind is a normal
 * state, not a fault. Each tier retries with fewer columns instead of failing
 * the whole surface, the same way NEWS_ROW_* does below. Hard-coding the newest
 * select meant a single absent column answered 503 for every jobs page, and the
 * degraded column set reported "no source" for data the database actually held.
 */
/**
 * A catalogue row, as far as these pages read it. The newer columns are
 * optional because an older database returns the smaller select.
 */
type OpportunityRow = {
  id: string;
  title: string;
  organisation: string | null;
  category: string;
  description: string | null;
  link_url: string | null;
  deadline: string | null;
  locations: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  last_verified_at?: string | null;
  source_name?: string | null;
  eligibility?: string | null;
  subcategory?: string | null;
  education_levels?: string[] | null;
  disciplines?: string[] | null;
  work_mode?: string | null;
  is_featured?: boolean | null;
};

const OPPORTUNITY_ROW_BASE = 'id,title,organisation,category,description,link_url,deadline,locations,is_active,created_at,updated_at';
const OPPORTUNITY_ROW_GOVERNED = `${OPPORTUNITY_ROW_BASE},closed_at,last_verified_at,source_name,eligibility`;
const OPPORTUNITY_ROW_DISCOVERY = `${OPPORTUNITY_ROW_GOVERNED},subcategory,education_levels,disciplines,work_mode,is_featured`;

app.get('/api/opportunities', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    let data: OpportunityRow[] | null = null;
    let error: { message?: string } | null = null;
    ({ data, error } = await supabase
      .from('opportunities')
      .select(OPPORTUNITY_ROW_DISCOVERY)
      .eq('is_active', true)
      .is('closed_at', null)
      .order('is_featured', { ascending: false })
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(300));
    if (error) {
      // Pre-discovery database: no subcategory / education_levels / work_mode.
      ({ data, error } = await supabase
        .from('opportunities')
        .select(OPPORTUNITY_ROW_GOVERNED)
        .eq('is_active', true)
        .is('closed_at', null)
        .order('deadline', { ascending: true, nullsFirst: false })
        .limit(300));
    }
    if (error) {
      // Pre-newsroom database: no provenance columns and no closed_at either.
      const fallback = await supabase
        .from('opportunities')
        .select(OPPORTUNITY_ROW_BASE)
        .eq('is_active', true)
        .order('deadline', { ascending: true, nullsFirst: false })
        .limit(300);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;

    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || 'all').trim().toLowerCase();
    const education = String(req.query.education || '').trim().toLowerCase();
    const discipline = String(req.query.discipline || '').trim().toLowerCase();
    const workMode = String(req.query.work_mode || '').trim().toLowerCase();
    const featuredOnly = String(req.query.featured || '') === 'true';

    const items = (data || []).filter((item: OpportunityRow) => {
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

app.get('/api/opportunities/:opportunityId', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'Opportunity not found.' });
  try {
    const supabase = getServerSupabase();
    let data: OpportunityRow | null = null;
    let error: { message?: string } | null = null;
    // Same three tiers as the list endpoint: a detail page must not 503 because
    // one column from the newest migration is absent.
    ({ data, error } = await supabase
      .from('opportunities')
      .select(OPPORTUNITY_ROW_DISCOVERY)
      .eq('id', req.params.opportunityId)
      .eq('is_active', true)
      .is('closed_at', null)
      .maybeSingle());
    if (error) {
      ({ data, error } = await supabase
        .from('opportunities')
        .select(OPPORTUNITY_ROW_GOVERNED)
        .eq('id', req.params.opportunityId)
        .eq('is_active', true)
        .is('closed_at', null)
        .maybeSingle());
    }
    if (error) {
      const fallback = await supabase
        .from('opportunities')
        .select(OPPORTUNITY_ROW_BASE)
        .eq('id', req.params.opportunityId)
        .eq('is_active', true)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Opportunity not found.' });
    res.json({ item: data });
  } catch (error) {
    console.error('Opportunity detail API error:', error);
    res.status(503).json({ error: 'Opportunity details are temporarily unavailable.' });
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
    // An owner locking themselves out of the console is never desirable.
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


const PDF_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const PDF_BANK_SELECT = 'id,title,original_filename,file_bytes,storage_path,destination,exam_body,institution_id,subject,course,paper_year,description,source_name,source_url,source_verified,news_article_id,opportunity_id,status,routed_resource_id,created_at';

app.get('/api/admin/pdf-bank', requireCapability('data.read'), async (_req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('document_bank').select(PDF_BANK_SELECT).order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin PDF bank list error:', error);
    res.status(503).json({ error: 'Unable to load the PDF bank.' });
  }
});

app.post('/api/admin/pdf-bank/upload', rateLimitFor(RATE_LIMIT_RULES.adminUpload), requireCapability('data.write', 'institution.update', 'cbt.manage'), express.json({ limit: '15mb' }), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const filenameRaw = String(req.body?.filename || '').split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g, '').trim() || '';
    const filename = filenameRaw.slice(-180);
    const title = String(req.body?.title || filename.replace(/\.pdf$/i, '')).trim().slice(0, 240);
    const dataUrl = String(req.body?.dataUrl || '');
    const match = /^data:application\/pdf;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
    if (!filename || !/\.pdf$/i.test(filename)) return res.status(400).json({ error: 'Choose a PDF file.' });
    if (!title) return res.status(400).json({ error: 'A document title is required.' });
    if (!match) return res.status(400).json({ error: 'The upload must be a PDF file.' });
    const buffer = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'The PDF is empty.' });
    if (buffer.length > PDF_UPLOAD_MAX_BYTES) return res.status(413).json({ error: 'PDF files must be 10 MB or smaller.' });
    if (!isPdfBuffer(buffer)) return res.status(400).json({ error: 'The file does not have a valid PDF signature.' });
    const supabase = getServerSupabase();
    const safeName = filename.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-120) || 'document.pdf';
    const now = new Date();
    const objectPath = `pdf-bank/${now.getUTCFullYear()}/${String(now.getUTCMonth()+1).padStart(2,'0')}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('resource-files').upload(objectPath, buffer, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase.from('document_bank').insert({
      title, original_filename: filename, mime_type: 'application/pdf', file_bytes: buffer.length,
      storage_path: objectPath, description: String(req.body?.description || '').trim().slice(0, 2000) || null,
      uploaded_by: adminUser.id,
    }).select(PDF_BANK_SELECT).single();
    if (error) {
      await supabase.storage.from('resource-files').remove([objectPath]);
      throw error;
    }
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'upload', p_entity_type: 'document_bank', p_entity_id: data.id, p_metadata: { filename, bytes: buffer.length, storage_path: objectPath } });
    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Admin PDF upload error:', error);
    res.status(500).json({ error: 'Unable to upload this PDF.' });
  }
});

app.patch('/api/admin/pdf-bank/:documentId/route', requireCapability('data.write', 'institution.update', 'cbt.manage'), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const id = String(req.params.documentId || '');
    const destination = String(req.body?.destination || 'inbox');
    const allowed = ['inbox','past_questions','admission_guides','scholarships','news_attachments','school_resources','other'];
    if (!allowed.includes(destination)) return res.status(400).json({ error: 'Choose a valid destination.' });
    const title = String(req.body?.title || '').trim().slice(0, 240);
    if (!title) return res.status(400).json({ error: 'A document title is required.' });
    const examBodyRaw = String(req.body?.exam_body || '').trim().toUpperCase();
    const examBody = ['JAMB','WAEC','NECO','POST-UTME'].includes(examBodyRaw) ? examBodyRaw : null;
    const institutionId = String(req.body?.institution_id || '').trim() || null;
    const newsArticleId = String(req.body?.news_article_id || '').trim() || null;
    const opportunityId = String(req.body?.opportunity_id || '').trim() || null;
    const subject = String(req.body?.subject || '').trim().slice(0, 120) || null;
    const course = String(req.body?.course || '').trim().slice(0, 160) || null;
    const yearRaw = req.body?.paper_year === '' || req.body?.paper_year === null || req.body?.paper_year === undefined ? null : Number(req.body.paper_year);
    const paperYear = yearRaw === null ? null : yearRaw;
    if (paperYear !== null && (!Number.isInteger(paperYear) || paperYear < 1954 || paperYear > 2100)) return res.status(400).json({ error: 'Enter a valid paper year.' });
    const sourceUrl = String(req.body?.source_url || '').trim() || null;
    if (sourceUrl) { try { if (new URL(sourceUrl).protocol !== 'https:') throw new Error(); } catch { return res.status(400).json({ error: 'Source links must use HTTPS.' }); } }
    if (req.body?.source_verified === true && !String(req.body?.source_name || '').trim()) return res.status(400).json({ error: 'Enter the source or organisation before marking this PDF verified.' });
    if (destination === 'past_questions' && !examBody) return res.status(400).json({ error: 'Select the exam body before routing to Past Questions.' });
    if (['admission_guides', 'school_resources'].includes(destination) && !institutionId) return res.status(400).json({ error: 'Choose the institution this school resource belongs to.' });
    if (destination === 'scholarships' && !opportunityId) return res.status(400).json({ error: 'Choose the opportunity this PDF supports.' });
    if (destination === 'news_attachments' && !newsArticleId) return res.status(400).json({ error: 'Choose the news article this PDF attaches to.' });
    const supabase = getServerSupabase();
    if (destination === 'scholarships') {
      const { data: opportunity, error: opportunityError } = await supabase.from('opportunities').select('id').eq('id', opportunityId).maybeSingle();
      if (opportunityError || !opportunity) return res.status(400).json({ error: 'The selected opportunity could not be found.' });
    }
    if (destination === 'news_attachments') {
      const { data: article, error: articleError } = await supabase.from('news_articles').select('id').eq('id', newsArticleId).maybeSingle();
      if (articleError || !article) return res.status(400).json({ error: 'The selected news article could not be found.' });
    }
    const { data: existing, error: existingError } = await supabase.from('document_bank').select(PDF_BANK_SELECT).eq('id', id).maybeSingle();
    if (existingError || !existing) return res.status(404).json({ error: 'PDF document not found.' });
    let routedResourceId: string | null = existing.routed_resource_id || null;
    if (destination !== 'past_questions' && existing.routed_resource_id) {
      const { error: hideError } = await supabase.from('past_question_resources')
        .update({ published: false, verified_at: null, updated_at: new Date().toISOString() })
        .eq('id', existing.routed_resource_id);
      if (hideError) throw hideError;
      routedResourceId = null;
    }
    if (destination === 'past_questions') {
      if (examBody === 'POST-UTME' && !institutionId) return res.status(400).json({ error: 'Select the institution for a Post-UTME paper.' });
      if (examBody === 'POST-UTME') {
        const { data: school, error: schoolError } = await supabase.from('institutions')
          .select('id,post_utme_available,post_utme_method,post_utme_verified')
          .eq('id', institutionId).maybeSingle();
        if (schoolError || !school || school.post_utme_available !== true || school.post_utme_verified !== true || school.post_utme_method !== 'handwritten') {
          return res.status(400).json({ error: 'Post-UTME PDFs can only be routed to a verified institution that uses handwritten/paper-based screening.' });
        }
      }
      const resource = {
        exam_body: examBody, institution_id: institutionId, subject, course, paper_year: paperYear,
        title, description: String(req.body?.description || existing.description || '').trim().slice(0, 2000) || null,
        source_name: String(req.body?.source_name || '').trim().slice(0, 160) || 'EduReach PDF Bank',
        source_url: sourceUrl, storage_path: existing.storage_path, access: 'download',
        published: Boolean(req.body?.source_verified), verified_at: req.body?.source_verified === true ? new Date().toISOString() : null,
      };
      if (routedResourceId) {
        const { error } = await supabase.from('past_question_resources').update(resource).eq('id', routedResourceId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('past_question_resources').insert(resource).select('id').single();
        if (error) throw error;
        routedResourceId = data.id;
      }
    }
    const { data, error } = await supabase.from('document_bank').update({
      title, destination, exam_body: destination === 'past_questions' ? examBody : null,
      subject, course, paper_year: paperYear,
      description: String(req.body?.description || '').trim().slice(0, 2000) || null,
      source_name: String(req.body?.source_name || '').trim().slice(0, 160) || null,
      source_url: sourceUrl, source_verified: req.body?.source_verified === true,
      institution_id: ['admission_guides', 'school_resources'].includes(destination) || (destination === 'past_questions' && examBody === 'POST-UTME') ? institutionId : null,
      news_article_id: destination === 'news_attachments' ? newsArticleId : null,
      opportunity_id: destination === 'scholarships' ? opportunityId : null,
      status: destination === 'inbox' ? 'inbox' : 'routed',
      routed_resource_id: routedResourceId, routed_by: adminUser.id,
      routed_at: destination === 'inbox' ? null : new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', id).select(PDF_BANK_SELECT).single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'route', p_entity_type: 'document_bank', p_entity_id: id, p_metadata: { destination, exam_body: examBody, institution_id: institutionId } });
    res.json({ item: data });
  } catch (error) {
    console.error('Admin PDF routing error:', error);
    res.status(500).json({ error: 'Unable to route this PDF.' });
  }
});

const UPLOAD_MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

app.post('/api/admin/uploads', rateLimitFor(RATE_LIMIT_RULES.adminUpload), requireCapability('news.create', 'opportunity.create', 'institution.update', 'calendar.update', 'service.update'), express.json({ limit: '5mb' }), async (req, res) => {
  try {
    const adminUser = (req as AuthorizedRequest).adminUser!;
    const dataUrl = String(req.body?.dataUrl || '');
    const match = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
    if (!match) return res.status(400).json({ error: 'Only PNG, JPEG, WebP or GIF images are supported.' });
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'The uploaded image is empty.' });
    if (buffer.length > 2 * 1024 * 1024) return res.status(413).json({ error: 'Images must be 2 MB or smaller.' });
    // The declared MIME type is a claim; check it against the bytes before the
    // object is written to the public bucket.
    if (!matchesDeclaredImageType(buffer, match[1])) {
      return res.status(400).json({ error: 'That file is not a valid PNG, JPEG, WebP or GIF image.' });
    }
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
 * has not been migrated yet - the site keeps serving either way.
 */
const NEWS_ROW_BASE = 'id,slug,title,excerpt,body,category,image_url,source_name,source_url,published_at,updated_at,published,featured,tags';
const NEWS_ROW_GOVERNED = `${NEWS_ROW_BASE},verification_status,expires_at,last_verified_at,source_key,source_tier`;
// NEWS-1: the database-derived canonical slug. Requested with the governed set so
// a migrated database answers a category filter with an index lookup; a
// pre-migration database falls back to the legacy columns and the client applies
// the same rule locally.
const NEWS_ROW_CATEGORISED = `${NEWS_ROW_GOVERNED},category_slug`;

type NewsRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  category: string | null;
  image_url: string | null;
  source_name: string | null;
  source_url: string | null;
  published_at: string | null;
  updated_at: string | null;
  published?: boolean;
  featured?: boolean | null;
  tags?: unknown;
  category_slug?: string | null;
  verification_status?: string | null;
  expires_at?: string | null;
  last_verified_at?: string | null;
  source_key?: string | null;
  source_tier?: string | null;
};

function newsArticleView(item: NewsRow) {
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

app.get('/api/news', async (_req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    let data: NewsRow[] | null = null;
    let error: { message?: string } | null = null;
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
    res.json({ items: (data || []).filter(isArticleCurrent).slice(0, 30).map(newsArticleView) });
  } catch (error) {
    console.error('News API error:', error);
    res.status(503).json({ error: 'News service is temporarily unavailable.' });
  }
});

app.get('/api/news/:slug', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'News content is not configured.' });
  try {
    const supabase = getServerSupabase();
    let data: NewsRow | null = null;
    let error: { message?: string } | null = null;
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
  // Canonical subject key - must stay in step with normalizeSubject() in
  // src/lib/cbt-config.ts and the SQL canonicalisation in plan_cbt_paper.
  const s = String(value || '').trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  if (s === 'use of english' || s === 'english language' || s === 'english') return 'english';
  return s;
}

/**
 * PostgREST returns at most 1,000 rows per request. Every "read the whole
 * bank" query must page explicitly or it silently truncates - that cap is
 * what made production report 0 questions for a 395-question bank. Pages are
 * walked in a stable order supplied by the caller-ordered query factory.
 */
async function fetchAllRows<T>(buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

type CbtQuestionRow = {
  id: string;
  position: number;
  subject: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation?: string | null;
};

type StartAttemptRow = {
  attempt_id: string;
  started_at: string | null;
  expires_at: string | null;
  total_questions: number | null;
  mode: string | null;
  duration_minutes: number | null;
  selected_subjects?: string[] | null;
  subject_plan?: unknown[] | null;
  resumed?: boolean;
};

type DocumentBankRow = {
  id: string;
  title: string;
  description: string | null;
  source_name: string | null;
  source_url: string | null;
  storage_path: string | null;
  destination: string | null;
  institution_id: string | null;
  news_article_id: string | null;
  opportunity_id: string | null;
  subject: string | null;
  course: string | null;
  paper_year: number | null;
  created_at: string | null;
};

type PastQuestionRow = {
  id: string;
  exam_body: string | null;
  institution_id: string | null;
  subject: string | null;
  course: string | null;
  paper_year: number | null;
  title: string;
  description: string | null;
  source_name: string | null;
  source_url: string | null;
  storage_path: string | null;
  access: string | null;
  verified_at: string | null;
};

type CbtPaperRow = {
  position: number;
  subject: string;
  question_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

type CbtSubmitResultRow = {
  attempt_id: string;
  score: number | string | null;
  correct_answers: number | null;
  total_questions: number;
  breakdown?: unknown[] | null;
};

type CbtHistoryRow = {
  attempt_id: string;
  exam_id: string;
  exam_title: string | null;
  exam_body: string | null;
  mode: string | null;
  programme: string | null;
  status: string;
  score: number | string | null;
  correct_answers: number | null;
  total_questions: number;
  duration_minutes: number | null;
  selected_subjects?: string[] | null;
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  answered: number | null;
};

function cbtSeededRank(seed: string, row: Pick<CbtQuestionRow, 'position' | 'subject' | 'question_text'>): number {
  // Stable FNV-1a hash: the same seed yields the same paper for guest display and scoring.
  const input = `${seed}|${row.position}|${normalizeSubjectKey(row.subject)}|${row.question_text || ''}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Guest paper assembly, on the same planner as configured attempts.
 *
 * Quotas come from previewPlan() - the shared proportional, capacity-aware
 * allocation that mirrors plan_cbt_paper - capped at the CBT max-questions
 * limit, with the student's seed ordering questions inside each subject so
 * display and scoring rebuild the identical paper. A requested subject with
 * no questions is an error naming the subject; there is no
 * fallback to "the first N questions of any subject", which previously
 * handed a guest a paper for subjects they never chose.
 */
function selectCbtPaperQuestions(rows: CbtQuestionRow[], subjects: string[], seed = '', maxQuestions = 100): CbtQuestionRow[] {
  const rank = (row: CbtQuestionRow) => seed ? cbtSeededRank(seed, row) : Number(row.position) || 0;

  // Distinct requested subjects by canonical key, in the order asked for.
  // No explicit selection means "the whole bank", in bank subject order.
  const requested: Array<{ key: string; label: string }> = [];
  const seen = new Set<string>();
  const source = (subjects || []).map((value) => String(value).trim()).filter(Boolean);
  const labels = source.length
    ? source
    : rows.map((row) => String(row.subject || '').trim()).filter(Boolean);
  for (const label of labels) {
    const key = normalizeSubjectKey(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    requested.push({ key, label });
  }

  const pools = requested.map(({ key, label }) => ({
    key,
    label,
    rows: rows.filter((row) => normalizeSubjectKey(row.subject) === key),
  }));
  if (source.length) {
    const missing = pools.filter((pool) => !pool.rows.length).map((pool) => pool.label);
    if (missing.length) {
      throw new Error(`No questions are available for: ${missing.join(', ')}. Remove these subjects or choose a different bank.`);
    }
  }

  const usable = pools.filter((pool) => pool.rows.length);
  const target = Math.min(maxQuestions, usable.reduce((sum, pool) => sum + pool.rows.length, 0));
  const plan = previewPlan(
    usable.map((pool) => ({ subject: pool.label, questionCount: pool.rows.length })),
    target,
  );

  const paper: CbtQuestionRow[] = [];
  usable.forEach((pool, index) => {
    const quota = plan[index]?.questions ?? 0;
    paper.push(...[...pool.rows].sort((a, b) => rank(a) - rank(b)).slice(0, quota));
  });
  return paper.map((row, index) => ({ ...row, position: index + 1 }));
}

class CbtBankPolicyUnavailable extends Error {}

/** Fail closed: service-role reads bypass RLS and must never infer public use. */
async function isPublicCbtBank(supabase: SupabaseClient, examId: string): Promise<boolean> {
  const { data, error } = await supabase.from('cbt_bank_security')
    .select('visibility').eq('exam_id', examId).maybeSingle();
  if (error) throw new CbtBankPolicyUnavailable('CBT bank policy unavailable.');
  return data?.visibility === 'public';
}

/** Whole-bank question reads, paged past the PostgREST 1,000-row cap. */
async function fetchGuestBankQuestions(supabase: SupabaseClient, examId: string, columns: string): Promise<CbtQuestionRow[]> {
  // The column list is chosen by the caller, so PostgREST's generated row type
  // cannot describe it. The shape is asserted here, at the one I/O boundary.
  return fetchAllRows<CbtQuestionRow>((from, to) => supabase
    .from('exam_questions')
    .select(columns)
    .eq('exam_id', examId)
    .neq('review_status', 'rejected')
    .order('position', { ascending: true })
    .range(from, to) as unknown as PromiseLike<{ data: CbtQuestionRow[] | null; error: unknown }>);
}

app.get('/api/cbt/exams', async (_req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('cbt_exams')
      .select('id,title,exam_body,subject,description,duration_minutes,institution_id')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Availability is stated up front, so a student never has to complete a setup
    // wizard to discover that a bank has no questions for a subject they want.
    // The read is paged: an unpaged select stops at PostgREST's 1,000-row cap
    // and under-counts every bank after the first thousand rows (production
    // once reported a 395-question bank as empty). Subjects are aggregated by
    // canonical key with a display label, mirroring cbt_subject_availability,
    // so catalogue cards, bank resolution and the setup wizard agree.
    const allExams = data || [];
    // This unauthenticated catalogue must not expose restricted-bank metadata
    // or counts via the service-role client. No policy row means unavailable.
    const policies = allExams.length ? await fetchAllRows<{ exam_id: string }>((from, to) => supabase
      .from('cbt_bank_security').select('exam_id').eq('visibility', 'public')
      .in('exam_id', allExams.map(exam => exam.id)).order('exam_id').range(from, to)) : [];
    const publicIds = new Set(policies.map(policy => policy.exam_id));
    const exams = allExams.filter(exam => publicIds.has(exam.id));
    const counts = new Map<string, { questions: number; subjects: Map<string, { subject: string; questionCount: number }> }>();
    if (exams.length) {
      const questionRows = await fetchAllRows<{ exam_id: string; subject?: string }>((from, to) => supabase
        .from('exam_questions')
        .select('exam_id,subject')
        .in('exam_id', exams.map((exam) => exam.id))
        .neq('review_status', 'rejected')
        .order('id', { ascending: true })
        .range(from, to));
      for (const row of questionRows) {
        const key = String(row.exam_id);
        const entry = counts.get(key) || { questions: 0, subjects: new Map<string, { subject: string; questionCount: number }>() };
        entry.questions += 1;
        const subject = String(row.subject || '').trim();
        if (subject) {
          const subjectKey = normalizeSubjectKey(subject);
          const current = entry.subjects.get(subjectKey);
          if (current) current.questionCount += 1;
          else entry.subjects.set(subjectKey, { subject, questionCount: 1 });
        }
        counts.set(key, entry);
      }
    }

    res.json({
      items: exams.map((exam) => {
        const entry = counts.get(exam.id);
        const subjects = [...(entry?.subjects.values() || [])]
          .sort((a, b) => a.subject.localeCompare(b.subject));
        return {
          ...exam,
          question_count: entry?.questions ?? 0,
          subject_count: subjects.length,
          subjects,
        };
      }),
    });
  } catch (error) {
    console.error('CBT exams list API error:', error);
    res.status(503).json({ error: 'CBT exams are temporarily unavailable.' });
  }
});

/** Only the exact database domain refusal may trigger an expiry check. */
function isCbtExpiredError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === 'P0001' && error.message === 'This CBT attempt has expired.';
}

/**
 * A narrow owner-scoped RPC checks the deadline and grace *after* locking the
 * attempt. It cannot alter answers or reopen a result. If the additive RPC is
 * not installed or fails, do not fall back to a privileged table update.
 * Deployment must be migration-first; legacy clients remain compatible.
 */
async function expireCbtAttempt(rpcSupabase: SupabaseClient, attemptId: string): Promise<void> {
  try {
    const { error } = await rpcSupabase.rpc('cbt_expire_owned_attempt', { p_attempt_id: attemptId });
    if (error) console.warn('CBT expiry marking unavailable.');
  } catch {
    console.warn('CBT expiry marking unavailable.');
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
       .select('id,title,exam_body,subject,description,duration_minutes,is_active,format_status,official_guidance_url,format_notes,guidance_year,institution_id,mock_question_count,mock_subject_quota')
      .eq('id', req.params.examId)
      .eq('is_active', true)
      .maybeSingle();
    if (examError || !exam) return res.status(404).json({ error: 'CBT exam not found.' });

    // Public metadata can be read by guests. Restricted bank metadata requires
    // the verified caller's database identity, never a supplied candidate ID.
    let subjectsClient = supabase;
    if (!await isPublicCbtBank(supabase, exam.id)) {
      if (!req.header('authorization')) return res.status(404).json({ error: 'CBT exam not found.' });
      const caller = await requireUser(req, 'cbt.attempt');
      const decision = await caller.rpcSupabase.rpc('cbt_bank_candidate_access', { p_exam: exam.id });
      if (decision.error) throw decision.error;
      if (decision.data !== true) return res.status(404).json({ error: 'CBT exam not found.' });
      subjectsClient = caller.rpcSupabase;
    }
    const { data: subjects, error: subjectError } = await subjectsClient.rpc('cbt_subject_availability', {
      p_exam_id: exam.id,
    });
    if (subjectError) throw subjectError;

    const { data: limits, error: limitsError } = await supabase.rpc('cbt_limits');
    if (limitsError) throw limitsError;
    const cbtLimits = limits as { minQuestions?: number; maxQuestions?: number; maxSubjects?: number } | null;

    // Editorial state of the bank, so the wizard can say plainly how much of
    // what it is offering has actually been reviewed. It does not change what
    // is servable: unapproved items are unverified practice material, not
    // approved content, and the page says so.
    const reviewRows = await fetchAllRows<{ review_status?: string }>((from, to) => supabase
      .from('exam_questions')
      .select('review_status')
      .eq('exam_id', exam.id)
      .order('id', { ascending: true })
      .range(from, to));
    const review = reviewRows.reduce(
      (totals, row) => {
        const status = String(row.review_status || 'needs_review');
        if (status === 'approved') totals.approved += 1;
        else if (status === 'rejected') totals.rejected += 1;
        else totals.needsReview += 1;
        totals.total += 1;
        return totals;
      },
      { approved: 0, needsReview: 0, rejected: 0, total: 0 },
    );

    const available = (subjects || []) as Array<{ subject: string; question_count: number }>;
    // Compulsory-subject rule, stated once here and enforced again in
    // start_cbt_attempt_configured: Use of English is compulsory for JAMB
    // (practice and mock). Other bodies carry no EduReach-imposed compulsory
    // subject. Display names are resolved against this bank's real subjects
    // so the wizard can pin exactly what the bank calls it.
    const bodyUpper = String(exam.exam_body || '').trim().toUpperCase();
    const isJamb = !bodyUpper.includes('POST') && (bodyUpper === 'JAMB' || bodyUpper === 'UTME' || bodyUpper.includes('JAMB'));
    const englishEntry = available.find((row) => normalizeSubjectKey(row.subject) === 'english');
    const compulsorySubjects = isJamb && englishEntry ? [englishEntry.subject] : [];
    res.json({
      exam: {
        id: exam.id,
        title: exam.title,
        examBody: exam.exam_body,
        subject: exam.subject,
        description: exam.description,
        defaultDurationMinutes: exam.duration_minutes,
        formatStatus: exam.format_status || 'unverified',
        officialGuidanceUrl: exam.official_guidance_url || null,
        formatNotes: exam.format_notes || null,
        guidanceYear: exam.guidance_year || null,
      },
      subjects: available.map((row) => ({ subject: row.subject, questionCount: Number(row.question_count) })),
      totalQuestions: available.reduce((sum, row) => sum + Number(row.question_count), 0),
      limits: limits || null,
      review,
      mock: {
        questionCount: exam.mock_question_count ? Number(exam.mock_question_count) : null,
        subjectQuota: (exam.mock_subject_quota || null) as Record<string, number> | null,
        durationMinutes: exam.duration_minutes ? Number(exam.duration_minutes) : null,
      },
      rules: {
        compulsorySubjects,
        compulsoryMissing: isJamb && !englishEntry,
        minSubjects: 1,
        maxSubjects: Number(cbtLimits?.maxSubjects ?? 6),
      },
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
 * plans the paper, freezes it and returns what was actually created - including
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

    // Defence in depth ahead of the (authoritative) RPC: canonical de-dup so
    // case/alias variants of one subject can never count twice, question
    // counts inside the server limits, and compulsory Use of English for
    // JAMB in both modes. A tampered browser request gets the same answer
    // the wizard would have given.
    const canonicalSubjects: string[] = [];
    const seenSubjectKeys = new Set<string>();
    for (const subject of subjects) {
      const key = normalizeSubjectKey(subject);
      if (!key || seenSubjectKeys.has(key)) continue;
      seenSubjectKeys.add(key);
      canonicalSubjects.push(subject);
    }
    if (!canonicalSubjects.length) {
      return res.status(422).json({ error: 'Choose at least one subject to practise.' });
    }
    const { data: limitData } = await rpcSupabase.rpc('cbt_limits');
    const limits = limitData as { minQuestions?: number; maxQuestions?: number; maxSubjects?: number } | null;
    const minQuestions = Number(limits?.minQuestions ?? 5);
    const maxQuestions = Number(limits?.maxQuestions ?? 100);
    const maxSubjects = Number(limits?.maxSubjects ?? 6);
    if (canonicalSubjects.length > maxSubjects) {
      return res.status(422).json({ error: `A session can include at most ${maxSubjects} subjects.` });
    }
    // A mock's size comes from the examination (cbt_exams.mock_question_count);
    // only a practice session is sized by the student.
    if (mode === 'practice' && questionCount !== null && (questionCount < minQuestions || questionCount > maxQuestions)) {
      return res.status(422).json({ error: `Choose between ${minQuestions} and ${maxQuestions} questions.` });
    }
    const { data: examRow } = await getServerSupabase()
      .from('cbt_exams')
      .select('exam_body,is_active')
      .eq('id', req.params.examId)
      .maybeSingle();
    if (examRow) {
      const bodyUpper = String(examRow.exam_body || '').trim().toUpperCase();
      const isJamb = !bodyUpper.includes('POST') && (bodyUpper === 'JAMB' || bodyUpper === 'UTME' || bodyUpper.includes('JAMB'));
      if (isJamb && !canonicalSubjects.some((subject) => normalizeSubjectKey(subject) === 'english')) {
        return res.status(422).json({ error: 'Use of English is compulsory for JAMB UTME. Include it in your subject combination.' });
      }
      if (isJamb && canonicalSubjects.length > 4) {
        return res.status(422).json({ error: 'A JAMB session can include Use of English plus three other subjects.' });
      }
      if (mode === 'mock') {
        // The same rule the RPC enforces, answered before the call so the
        // student gets a message naming what is missing rather than a 409.
        const combinationError = mockCombinationError(canonicalSubjects, examRow.exam_body);
        if (combinationError) return res.status(422).json({ error: combinationError });
      }
    }

    const { data, error } = await rpcSupabase.rpc('start_cbt_attempt_configured', {
      p_exam_id: req.params.examId,
      p_subjects: canonicalSubjects,
      p_question_count: questionCount,
      p_duration_minutes: durationMinutes,
      p_mode: mode,
      p_programme: programme,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as StartAttemptRow | null;
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
          : /No questions are available|Choose at least one subject|Choose a duration|Use of English plus|A JAMB mock paper|A session can include|Unknown CBT mode|cannot fill the|can only supply/i.test(message) ? 422
            : 409;
    res.status(status).json({ error: publicErrorMessage(message, 'Unable to start this practice session. Please try again.') });
  }
});

/**
 * UI-5 - the opt-in public profile.
 *
 * A copied profile link used to land on the private /profile route, so a
 * visitor was pushed into the owner's dashboard or a login wall. This route is
 * deliberately narrow:
 *
 *   - only rows with public_profile = true are readable;
 *   - the select is an explicit whitelist, and `id` is never returned;
 *   - email, phone, matric number, JAMB registration, results and notifications
 *     are not selected at all;
 *   - the "verified" mark is derived from a confirmed account email, not from a
 *     name or a stored self-assertion.
 *
 * It is a same-origin API read (service role) rather than an anonymous table
 * grant, so the public surface stays one reviewed projection.
 */
app.get('/api/public/profiles/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  if (!PUBLIC_PROFILE_SLUG_PATTERN.test(slug)) {
    return res.status(404).json({ error: 'Profile not found.' });
  }
  if (!isServerSupabaseConfigured()) {
    return res.status(503).json({ error: 'Public profiles are not available in this environment.' });
  }
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_SELECT)
      .eq('public_profile_slug', slug)
      .eq('public_profile', true)
      .maybeSingle();
    if (error) throw error;
    const row = data as unknown as PublicProfileRecord | null;
    if (!row) return res.status(404).json({ error: 'Profile not found.' });

    let emailVerified = false;
    try {
      const { data: account } = await supabase.auth.admin.getUserById(String(row.id));
      emailVerified = Boolean(account?.user?.email_confirmed_at);
    } catch {
      // A failed verification lookup must not turn a readable profile into an
      // error, and it must not claim a check that did not happen.
      emailVerified = false;
    }

    res.set('Cache-Control', 'no-store');
    return res.json({ profile: publicProfileResponse(row, emailVerified) });
  } catch (error) {
    console.error('Public profile read error:', error);
    return res.status(503).json({ error: 'This profile could not be loaded right now.' });
  }
});

/**
 * PQR-1 - the past-question resource library, read-only and public.
 *
 * The library is empty until staff publish a paper that they have verified, and
 * this endpoint says exactly that instead of implying documents exist. When a
 * row is hosted by EduReach, the private `resource-files` copy is opened with a
 * short-lived signed URL, and only then: a row the server cannot sign is
 * reported as unavailable rather than shown as a working download.
 */
app.get('/api/public/documents', async (req, res) => {
  const destination = String(req.query.destination || '').trim();
  const allowed = ['admission_guides', 'scholarships', 'news_attachments', 'school_resources'];
  if (!allowed.includes(destination)) return res.status(400).json({ error: 'Choose a supported public document destination.' });
  const institutionId = String(req.query.institution_id || '').trim();
  const opportunityId = String(req.query.opportunity_id || '').trim();
  const newsArticleId = String(req.query.news_article_id || '').trim();
  if (['admission_guides', 'school_resources'].includes(destination) && !institutionId) return res.json({ items: [] });
  if (destination === 'scholarships' && !opportunityId) return res.json({ items: [] });
  if (destination === 'news_attachments' && !newsArticleId) return res.json({ items: [] });
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    if (destination === 'news_attachments') {
      const { data: article, error: articleError } = await supabase.from('news_articles').select('id,published').eq('id', newsArticleId).maybeSingle();
      if (articleError || !article?.published) return res.json({ items: [] });
    }
    if (destination === 'scholarships') {
      const { data: opportunity, error: opportunityError } = await supabase.from('opportunities').select('id,is_active').eq('id', opportunityId).maybeSingle();
      if (opportunityError || opportunity?.is_active !== true) return res.json({ items: [] });
    }
    let query = supabase.from('document_bank')
      .select('id,title,description,source_name,source_url,storage_path,destination,institution_id,news_article_id,opportunity_id,subject,course,paper_year,created_at')
      .eq('destination', destination).eq('status', 'routed').eq('source_verified', true)
      .order('created_at', { ascending: false }).limit(50);
    if (institutionId) query = query.eq('institution_id', institutionId);
    if (opportunityId) query = query.eq('opportunity_id', opportunityId);
    if (newsArticleId) query = query.eq('news_article_id', newsArticleId);
    const { data, error } = await query;
    if (error) throw error;
    const items = await Promise.all((data || []).map(async (row: DocumentBankRow) => {
      let signedUrl: string | null = null;
      if (row.storage_path) {
        const { data: signed } = await supabase.storage.from('resource-files').createSignedUrl(row.storage_path, 300);
        signedUrl = signed?.signedUrl ?? null;
      }
      return {
        id: row.id, title: row.title, description: row.description, source_name: row.source_name,
        source_url: row.source_url, destination: row.destination, institution_id: row.institution_id,
        news_article_id: row.news_article_id, opportunity_id: row.opportunity_id, subject: row.subject,
        course: row.course, paper_year: row.paper_year, href: signedUrl || row.source_url || null,
        created_at: row.created_at,
      };
    }));
    res.json({ items });
  } catch (error) {
    console.error('Public PDF document list error:', error);
    res.status(503).json({ error: 'Unable to load these documents right now.' });
  }
});

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

    const items = await Promise.all((data || []).map(async (row: PastQuestionRow) => {
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
        // available  - a paper a student can open right now
        // external   - hosted elsewhere; the link leaves EduReach
        // unavailable- published, but neither copy can be opened
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
      // The page needs to distinguish "nothing published yet" (an empty
      // state) from "the service could not answer" (an error state).
      state: items.length ? 'available' : 'not-published',
    });
  } catch (error) {
    console.error('Past-question resources API error:', error);
    res.status(503).json({ error: 'The resource library is temporarily unavailable.' });
  }
});

// NOT a rollout switch. The Phase 4 candidate deliberately disables old RPCs
// in its disposable database. Never expose it in production or on a hosted platform.
function cbtV2LocalRehearsalEnabled(): boolean {
  if (process.env.CBT_V2_LOCAL_REHEARSAL !== '1' || process.env.NODE_ENV === 'production' || process.env.NETLIFY || process.env.VERCEL) return false;
  try {
    const url = new URL(process.env.VITE_SUPABASE_URL || '');
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  } catch { return false; }
}
const CBT_V2_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A v2 writing operation is allowed only when the stored attempt belongs to the
 * caller and the bank predicate permits them (public, or an active restricted
 * assignment). Unclassified banks fail closed. Identity always comes from the
 * caller's JWT; the client never supplies a candidate id.
 */
async function v2AttemptAccessible(caller: { supabase: SupabaseClient; rpcSupabase: SupabaseClient }, attemptId: string, userId: string): Promise<boolean> {
  const { data, error } = await caller.supabase.from('cbt_attempts').select('exam_id,protocol')
    .eq('id', attemptId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data || data.protocol !== 'v2') return false;
  const decision = await caller.rpcSupabase.rpc('cbt_bank_candidate_access', { p_exam: data.exam_id });
  if (decision.error) throw decision.error;
  return decision.data === true;
}

/** Local rehearsal of the owner-scoped versioned protocol; not deployable. */
app.get('/api/cbt/v2/attempts/:attemptId/state', async (req, res) => {
  if (!cbtV2LocalRehearsalEnabled()) return res.status(503).json({ error: 'CBT versioned rehearsal is unavailable.' });
  try {
    const { supabase, rpcSupabase, user } = await requireUser(req, 'cbt.attempt');
    if (!CBT_V2_UUID.test(req.params.attemptId)) return res.status(400).json({ error: 'Invalid attempt.' });
    const { data, error } = await supabase.from('cbt_attempts')
      .select('id,user_id,exam_id,protocol,status,answers_draft,candidate_answer_revision,question_ids')
      .eq('id', req.params.attemptId).eq('user_id', user.id).maybeSingle();
    if (error) return res.status(503).json({ error: 'Unable to synchronize this attempt.' });
    if (!data) return res.status(404).json({ error: 'CBT attempt not found.' });
    // A local switch is never evidence that this particular attempt is v2.
    if (data.protocol !== 'v2') return res.status(409).json({ error: 'CBT protocol mismatch.' });
    // A restricted bank requires an active assignment and an unclassified one
    // fails closed. Checked per request, so a revoked assignment stops state
    // synchronisation immediately.
    const access = await rpcSupabase.rpc('cbt_bank_candidate_access', { p_exam: data.exam_id });
    if (access.error) return res.status(503).json({ error: 'Unable to synchronize this attempt.' });
    if (access.data !== true) return res.status(404).json({ error: 'CBT attempt not found.' });
    const revision = Number(data.candidate_answer_revision);
    const paper = data.question_ids;
    const draft = data.answers_draft;
    if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(paper) || paper.length === 0 ||
        paper.some(id => typeof id !== 'string' || !CBT_V2_UUID.test(id)) || new Set(paper.map(id => String(id).toLowerCase())).size !== paper.length ||
        !draft || typeof draft !== 'object' || Array.isArray(draft) ||
        Object.entries(draft).some(([position, value]) => !/^[1-9]\d*$/.test(position) || !Number.isSafeInteger(Number(position)) ||
          Number(position) > paper.length || !Number.isInteger(value) || Number(value) < 0 || Number(value) > 3)) {
      return res.status(409).json({ error: 'This attempt requires review.' });
    }
    // The client must be able to verify the frozen ID-to-position mapping
    // before replaying any persisted question operation.
    return res.json({ protocol: 2, revision, answers: draft, status: data.status, questionIds: paper });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/Authentication required|Invalid or expired session/i.test(message)) return res.status(401).json({ error: 'Please sign in again.' });
    if (/permission/i.test(message)) return res.status(403).json({ error: 'Permission denied.' });
    return res.status(503).json({ error: 'Unable to synchronize this attempt.' });
  }
});

// This session endpoint is still confined to the disposable local rehearsal.
// A new device must explicitly request takeover; a retry reuses requestKey.
app.post('/api/cbt/v2/attempts/:attemptId/session', async (req, res) => {
  if (!cbtV2LocalRehearsalEnabled()) return res.status(503).json({ error: 'CBT versioned rehearsal is unavailable.' });
  try {
    const caller = await requireUser(req, 'cbt.attempt');
    const { protocol, requestKey, takeover } = req.body || {};
    if (protocol !== 2 || !CBT_V2_UUID.test(req.params.attemptId) || !CBT_V2_UUID.test(String(requestKey || '')) || typeof takeover !== 'boolean') {
      return res.status(400).json({ error: 'Invalid CBT session request.' });
    }
    if (!await v2AttemptAccessible(caller, req.params.attemptId, caller.user.id)) return res.status(404).json({ error: 'CBT attempt not found.' });
    const token = req.header('authorization')?.slice('Bearer '.length).trim() || '';
    const callerDb = getUserScopedSupabase(token);
    if (!callerDb) return res.status(503).json({ error: 'CBT authorization is unavailable.' });
    const { data, error } = await callerDb.rpc('cbt_v2_session_gateway', {
      p_attempt: req.params.attemptId, p_request_key: requestKey, p_takeover: takeover,
    });
    if (error) {
      if (error.code === 'P0001' && error.message === 'CBT attempt not found.') return res.status(404).json({ error: 'CBT attempt not found.' });
      if (error.code === 'P0001' && ['CBT protocol mismatch.', 'CBT attempt is not active.'].includes(error.message)) return res.status(409).json({ error: error.message });
      return res.status(503).json({ error: 'Unable to confirm this CBT writing session.' });
    }
    if (!data || typeof data !== 'object' || !['created', 'taken_over', 'resumed', 'takeover_required', 'revoked', 'expired'].includes(data.outcome) ||
        !Number.isSafeInteger(data.revision) || data.revision < 0 || !data.answers || typeof data.answers !== 'object' || Array.isArray(data.answers) ||
        data.status !== 'in_progress' ||
        (['created', 'taken_over', 'resumed', 'revoked'].includes(data.outcome) &&
          (!CBT_V2_UUID.test(String(data.sessionId || '')) || !Number.isSafeInteger(data.generation) || data.generation < 1))) {
      return res.status(503).json({ error: 'Unable to confirm this CBT writing session.' });
    }
    return res.status(['takeover_required', 'revoked', 'expired'].includes(data.outcome) ? 409 : 200).json({ protocol: 2, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/Authentication required|Invalid or expired session/i.test(message)) return res.status(401).json({ error: 'Please sign in again.' });
    if (/permission/i.test(message)) return res.status(403).json({ error: 'Permission denied.' });
    return res.status(503).json({ error: 'Unable to confirm this CBT writing session.' });
  }
});

async function cbtV2LocalWrite(req: express.Request, res: express.Response, kind: 'answer' | 'finalize') {
  if (!cbtV2LocalRehearsalEnabled()) return res.status(503).json({ error: 'CBT versioned rehearsal is unavailable.' });
  try {
    const caller = await requireUser(req, 'cbt.attempt');
    const token = req.header('authorization')?.slice('Bearer '.length).trim() || '';
    // Never fall back to service role: the gateway uses the verified JWT's auth.uid().
    const callerDb = getUserScopedSupabase(token);
    if (!callerDb) return res.status(503).json({ error: 'CBT authorization is unavailable.' });
    const { protocol, expectedRevision, operationKey, questionId, selected, sessionId, sessionGeneration } = req.body || {};
    const commonValid = protocol === 2 && CBT_V2_UUID.test(req.params.attemptId) && CBT_V2_UUID.test(String(operationKey || '')) &&
      Number.isSafeInteger(expectedRevision) && expectedRevision >= 0 &&
      CBT_V2_UUID.test(String(sessionId || '')) && Number.isSafeInteger(sessionGeneration) && sessionGeneration >= 1;
    if (!commonValid || (kind === 'answer' &&
        (!CBT_V2_UUID.test(String(questionId || '')) || !(selected === null || (Number.isInteger(selected) && selected >= 0 && selected <= 3))))) {
      return res.status(400).json({ error: 'Invalid versioned CBT operation.' });
    }
    if (!await v2AttemptAccessible(caller, req.params.attemptId, caller.user.id)) return res.status(404).json({ error: 'CBT attempt not found.' });
    // Finalization uses the same writing lease as answers. The database is
    // still the authority for revision, expiry, scoring and idempotency; a
    // client seal only lets an uncertain response be retried safely.
    const { data, error } = kind === 'answer'
      ? await callerDb.rpc('cbt_v2_answer_gateway', {
        p_attempt: req.params.attemptId, p_expected_revision: expectedRevision, p_operation_key: operationKey,
        p_question: questionId, p_selected: selected, p_session: sessionId, p_generation: sessionGeneration,
      })
      : await callerDb.rpc('cbt_v2_finalize_gateway', {
        p_attempt: req.params.attemptId, p_expected_revision: expectedRevision, p_operation_key: operationKey,
        p_session: sessionId, p_generation: sessionGeneration,
      });
    if (error) {
      if (error.code === 'P0001' && error.message === 'CBT writing session is no longer active.') return res.status(409).json({ protocol: 2, outcome: 'session_revoked', error: 'This device is no longer authorized to write. Your pending answers remain on this device for review.', code: 'CBT_SESSION_REVOKED' });
      if (error.code === 'P0001' && error.message === 'CBT attempt not found.') return res.status(404).json({ error: 'CBT attempt not found.' });
      if (error.code === 'P0001' && error.message === 'This CBT attempt has expired.') return res.status(409).json({ protocol: 2, outcome: 'expired' });
      if (error.code === 'P0001' && error.message === 'CBT attempt is not active.') return res.status(409).json({ protocol: 2, outcome: 'closed' });
      if (error.code === 'P0001' && error.message === 'CBT protocol mismatch.') return res.status(409).json({ error: 'CBT protocol mismatch.' });
      if (error.code === 'P0001' && /requires review|Operation key used for different input|Question is not in this paper/.test(error.message)) return res.status(409).json({ error: 'The operation requires review.' });
      return res.status(503).json({ error: 'Unable to confirm this CBT operation.' });
    }
    const allowed = kind === 'answer'
      ? ['accepted', 'replayed', 'conflict', 'expired', 'closed']
      : ['submitted', 'replayed', 'already_submitted', 'conflict', 'expired', 'closed'];
    if (!data || typeof data !== 'object' || !allowed.includes(data.outcome)) {
      return res.status(503).json({ error: 'Unable to confirm this CBT operation.' });
    }
    return res.status(['conflict', 'expired', 'closed'].includes(data.outcome) ? 409 : 200).json({ protocol: 2, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/Authentication required|Invalid or expired session/i.test(message)) return res.status(401).json({ error: 'Please sign in again.' });
    if (/permission/i.test(message)) return res.status(403).json({ error: 'Permission denied.' });
    return res.status(503).json({ error: 'Unable to confirm this CBT operation.' });
  }
}
app.patch('/api/cbt/v2/attempts/:attemptId/answer', (req, res) => cbtV2LocalWrite(req, res, 'answer'));
app.post('/api/cbt/v2/attempts/:attemptId/finalize', (req, res) => cbtV2LocalWrite(req, res, 'finalize'));

/** The frozen paper for one attempt, plus the student's saved draft. Owner only. */
app.get('/api/cbt/attempts/:attemptId/paper', async (req, res) => {
  try {
    const { supabase, rpcSupabase, user } = await requireUser(req, 'cbt.attempt');
    const localVersioned = cbtV2LocalRehearsalEnabled();
    if (!CBT_V2_UUID.test(req.params.attemptId)) return res.status(400).json({ error: 'Invalid attempt.' });
    const { data: attemptRow, error: attemptError } = await supabase
      .from('cbt_attempts')
      .select('id,exam_id,status,started_at,expires_at,current_question,answers_draft,selected_subjects,mode,duration_minutes,programme,subject_plan,question_ids,cbt_exams(title,exam_body,subject)')
      .eq('id', req.params.attemptId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (attemptError) return res.status(503).json({ error: 'Unable to load this CBT attempt. Please try again.' });
    if (!attemptRow) return res.status(404).json({ error: 'CBT attempt not found.' });
    // Classification always comes from the owner-scoped stored attempt, even
    // when v2 rehearsal is disabled. Never send a known v2 attempt through
    // the legacy reader. This requires the protocol migration before rollout.
    const lookup = await supabase.from('cbt_attempts').select('protocol')
      .eq('id', req.params.attemptId).eq('user_id', user.id).maybeSingle();
    if (lookup.error || !lookup.data || !['legacy', 'v2'].includes(String(lookup.data.protocol))) {
      return res.status(503).json({ error: 'Unable to confirm this CBT protocol.' });
    }
    const storedProtocol = lookup.data.protocol;
    if (storedProtocol === 'v2' && !localVersioned) return res.status(503).json({ error: 'CBT versioned rehearsal is unavailable.' });

    let paper: CbtPaperRow[];
    if (storedProtocol === 'v2') {
      // Restricted questions are served only to an actively assigned candidate.
      const access = await rpcSupabase.rpc('cbt_bank_candidate_access', { p_exam: attemptRow.exam_id });
      if (access.error) return res.status(503).json({ error: 'Unable to load this CBT attempt. Please try again.' });
      if (access.data !== true) return res.status(404).json({ error: 'CBT attempt not found.' });
      // Expired attempts may still be opened for local pending-work review;
      // the DB session/answer gateways cannot grant them a writing lease.
      if (!['in_progress', 'expired'].includes(String(attemptRow.status))) return res.status(409).json({ error: 'This CBT attempt is not active.' });
      // The legacy paper RPC deliberately refuses v2. Read only the owner's
      // frozen IDs, never answer keys, and refuse a missing/ambiguous mapping.
      // Like the legacy frozen reader, resuming an existing paper does not
      // depend on whether its exam bank was subsequently deactivated.
      // This branch is no wider than the existing loopback rehearsal guard.
      const ids = attemptRow.question_ids;
      if (!Array.isArray(ids) || ids.length === 0 || ids.some(id => typeof id !== 'string' || !CBT_V2_UUID.test(id)) ||
          new Set(ids.map(id => id.toLowerCase())).size !== ids.length) {
        return res.status(409).json({ error: 'This attempt requires review.' });
      }
      const { data: questions, error } = await supabase.from('exam_questions')
        .select('id,subject,question_text,option_a,option_b,option_c,option_d')
        .eq('exam_id', attemptRow.exam_id).neq('review_status', 'rejected').in('id', ids);
      if (error || !Array.isArray(questions)) return res.status(503).json({ error: 'Unable to load this CBT attempt. Please try again.' });
      const byId = new Map(questions.map(q => [String(q.id).toLowerCase(), q]));
      if (questions.length !== ids.length || byId.size !== ids.length || ids.some(id => !byId.has(id.toLowerCase()))) {
        return res.status(409).json({ error: 'This attempt requires review.' });
      }
      paper = ids.map((id, index) => {
        const q = byId.get(id.toLowerCase())!;
        return { position: index + 1, subject: typeof q.subject === 'string' ? q.subject.trim() : q.subject, question_id: id,
          question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d };
      });
    } else {
      const { data, error: paperError } = await rpcSupabase.rpc('get_cbt_attempt_paper', { p_attempt_id: req.params.attemptId });
      if (paperError) {
        // Recognize only the RPC's exact domain refusals; an infrastructure
        // error mentioning a missing function is not a missing student attempt.
        if (paperError.code === 'P0001' && paperError.message === 'CBT attempt not found.') return res.status(404).json({ error: 'CBT attempt not found.' });
        if (paperError.code === 'P0001' && paperError.message === 'This CBT attempt has expired.') return res.status(409).json({ error: 'This CBT attempt has expired.' });
        if (paperError.code === 'P0001' && paperError.message === 'CBT protocol mismatch.') return res.status(409).json({ error: 'CBT protocol mismatch.' });
        return res.status(503).json({ error: 'Unable to load this CBT attempt. Please try again.' });
      }
      if (!Array.isArray(data)) return res.status(503).json({ error: 'Unable to load this CBT attempt. Please try again.' });
      paper = data;
    }

    const examMeta = (attemptRow.cbt_exams || {}) as { title?: string | null; exam_body?: string | null; subject?: string | null };
    res.json({
      // The server clock, so a device with the wrong time still shows the true
      // remaining time instead of extending or shortening the examination.
      serverTime: new Date().toISOString(),
      // This is still only a local rehearsal; the flag cannot turn a legacy
      // attempt into v2. The stored protocol selects its local designation.
      protocol: localVersioned && storedProtocol === 'v2' ? { version: 2, scope: 'local-rehearsal' } : { version: 1 },
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
      questions: (paper || []).map((row: CbtPaperRow) => ({
        position: row.position,
        subject: row.subject,
        id: row.question_id,
        text: row.question_text,
        options: [row.option_a, row.option_b, row.option_c, row.option_d],
      })),
    });
  } catch (error) {
    console.error('CBT paper API error:', error);
    const message = error instanceof Error ? error.message : '';
    if (message === 'Authentication required.' || message === 'Invalid or expired session.') return res.status(401).json({ error: publicErrorMessage(message) });
    if (message === 'You do not have permission to perform this action.') return res.status(403).json({ error: publicErrorMessage(message) });
    res.status(503).json({ error: 'Unable to load this CBT attempt. Please try again.' });
  }
});

/** Submit against the frozen paper. A retried submit returns the stored result. */
app.post('/api/cbt/attempts/:attemptId/submit', async (req, res) => {
  try {
    const { rpcSupabase } = await requireUser(req, 'cbt.attempt');
    const answers = req.body?.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'Submit your answers with the attempt.' });
    }

    const { data, error } = await rpcSupabase.rpc('submit_cbt_attempt_configured', {
      p_attempt_id: req.params.attemptId,
      p_answers: answers,
    });
    if (isCbtExpiredError(error)) {
      await expireCbtAttempt(rpcSupabase, req.params.attemptId);
      return res.status(409).json({ error: 'This CBT attempt has expired.' });
    }
    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as CbtSubmitResultRow | null;
    if (!row) return res.status(409).json({ error: 'CBT submission did not produce a result.' });
    res.json({
      attemptId: row.attempt_id,
      score: row.score === null ? null : Number(row.score),
      correctAnswers: row.correct_answers === null ? null : Number(row.correct_answers),
      totalQuestions: Number(row.total_questions),
      breakdown: row.breakdown || [],
    });
  } catch (error) {
    console.error('CBT submit API error:', error);
    const message = error instanceof Error ? error.message : 'CBT submission failed.';
    const status = httpStatusForErrorMessage(message);
    if (status === 503) res.setHeader('Retry-After', '10');
    res.status(status).json({ error: publicErrorMessage(message, 'CBT submission failed. Please try again.') });
  }
});

/** Save in-progress answers and the current question so nothing is lost. */
app.patch('/api/cbt/attempts/:attemptId/draft', async (req, res) => {
  try {
    const { rpcSupabase } = await requireUser(req, 'cbt.attempt');
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
    if (isCbtExpiredError(error)) {
      await expireCbtAttempt(rpcSupabase, req.params.attemptId);
      return res.status(409).json({ error: 'This CBT attempt has expired.' });
    }
    if (error?.code === 'P0001' && error.message === 'CBT protocol mismatch.') return res.status(409).json({ error: 'CBT protocol mismatch.' });
    if (error) throw error;
    res.json({ saved: true, ...(data as Record<string, unknown>) });
  } catch (error) {
    console.error('CBT draft API error:', error);
    const message = error instanceof Error ? error.message : 'Unable to save your progress.';
    const status = httpStatusForErrorMessage(message);
    if (status === 503) res.setHeader('Retry-After', '10');
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

/** Delete the authenticated student's own CBT attempt or result. */
app.delete('/api/cbt/attempts/:attemptId', async (req, res) => {
  try {
    const { rpcSupabase } = await requireUser(req, 'cbt.attempt');
    const { data, error } = await rpcSupabase.rpc('delete_cbt_attempt', { p_attempt_id: req.params.attemptId });
    if (error) throw error;
    res.json({ deleted: Boolean(data) });
  } catch (error) {
    console.error('CBT delete API error:', error);
    const message = error instanceof Error ? error.message : 'Unable to delete this CBT result.';
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
      items: (data || []).map((row: CbtHistoryRow) => ({
        id: row.attempt_id,
        examId: row.exam_id,
        examTitle: row.exam_title,
        examBody: row.exam_body,
        mode: row.mode,
        programme: row.programme,
        status: row.status,
        score: row.score === null ? null : Number(row.score),
        correctAnswers: row.correct_answers === null ? null : Number(row.correct_answers),
        totalQuestions: Number(row.total_questions),
        durationMinutes: row.duration_minutes,
        subjects: row.selected_subjects || [],
        startedAt: row.started_at,
        expiresAt: row.expires_at,
        submittedAt: row.submitted_at,
        answered: row.answered === null ? null : Number(row.answered),
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
    // created for the caller and never for a client-supplied user id. It is the
    // same planner the configured wizard uses, so a legacy link cannot start a
    // paper outside the session limits or the compulsory-subject rules.
    const { data, error } = await rpcSupabase.rpc('start_cbt_attempt_configured', {
      p_exam_id: req.params.examId,
      p_subjects: subjects,
      p_mode: 'practice',
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as StartAttemptRow | null;
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
    const status = /Authentication|required|session/i.test(message) ? 401 : /permission/i.test(message) ? 403 : /not found/i.test(message) ? 404 : /no questions|requires Use of English|Use of English is compulsory|Choose at least one subject|A session can include/i.test(message) ? 422 : 409;
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
    if (!await isPublicCbtBank(supabase, exam.id)) return res.status(404).json({ error: 'CBT exam not found.' });

    const subjects = typeof req.query.subjects === 'string'
      ? req.query.subjects.split('|').map((value) => value.trim()).filter(Boolean)
      : [];
    const questions = await fetchGuestBankQuestions(supabase, exam.id, 'position,subject,question_text,option_a,option_b,option_c,option_d');

    const paper = selectCbtPaperQuestions(questions || [], subjects, String(req.query.seed || '').slice(0, 128));
    if (!paper.length) return res.status(422).json({ error: 'This CBT exam has no questions for the selected subjects.' });

    res.json({
      exam: { id: exam.id, title: exam.title, examBody: exam.exam_body, durationMinutes: exam.duration_minutes, subject: exam.subject },
      questions: paper.map((q) => ({ id: q.position, text: q.question_text, options: [q.option_a, q.option_b, q.option_c, q.option_d] })),
    });
  } catch (error) {
    console.error('Guest CBT question API error:', error);
    const message = error instanceof Error ? error.message : '';
    if (/No questions are available for:/i.test(message)) {
      return res.status(422).json({ error: publicErrorMessage(message, 'This CBT exam has no questions for the selected subjects.') });
    }
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
    if (!await isPublicCbtBank(supabase, exam.id)) return res.status(404).json({ error: 'CBT exam not found.' });

    const questions = await fetchGuestBankQuestions(supabase, exam.id, 'id,position,subject,question_text,option_a,option_b,option_c,option_d,correct_option,explanation');

    const paper = selectCbtPaperQuestions(questions || [], subjects, String(req.body?.paperSeed || '').slice(0, 128));
    if (!paper.length) return res.status(422).json({ error: 'This CBT exam has no questions for the selected subjects.' });

    // Corrections are released per attempted question, never for the paper as a
    // whole. This endpoint is unauthenticated, and a submission that does not
    // answer a question must not receive that question's key: an empty payload
    // (`{"answers":{}}`) previously returned correct_option and explanation for
    // every question, which disclosed the whole answer key to anyone who could
    // name an exam id. A student who answers a question still gets
    // the full correction for it, which is what the review screen needs.
    const attemptedPositions = new Set(
      paper
        .filter((question) => {
          const raw = answers[String(question.position)];
          return raw !== undefined && raw !== null;
        })
        .map((question) => question.position),
    );

    const breakdown = paper.map((question) => {
      const raw = answers[String(question.position)];
      const valid = raw === null || raw === undefined || (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3);
      if (!valid) throw new Error(`Invalid answer for question ${question.position}.`);
      const selected = raw === undefined || raw === null ? null : Number(raw);
      const selectedOption = selected === null ? null : String.fromCharCode(65 + selected);
      const attempted = attemptedPositions.has(question.position);
      const correctIndex = question.correct_option.charCodeAt(0) - 65;
      return {
        question: question.position,
        selected,
        correct: attempted ? correctIndex : null,
        isCorrect: selectedOption === question.correct_option,
        explanation: attempted ? (question.explanation || null) : null,
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
        correct_option: attemptedPositions.has(question.position) ? question.correct_option : null,
        explanation: attemptedPositions.has(question.position) ? (question.explanation || null) : null,
      })),
      breakdown,
    });
  } catch (error) {
    console.error('Guest CBT submit API error:', error);
    if (error instanceof CbtBankPolicyUnavailable) return res.status(503).json({ error: 'CBT service is temporarily unavailable.' });
    const message = error instanceof Error ? error.message : 'CBT submission failed.';
    const status = /No questions are available for:/i.test(message) ? 422 : 400;
    res.status(status).json({ error: publicErrorMessage(message, 'CBT submission failed. Please try again.') });
  }
});

app.post('/api/cbt/submit', async (req, res) => {
  try {
    const { rpcSupabase } = await requireUser(req, 'cbt.attempt');
    // `examId` is still accepted for older clients but no longer used: the
    // attempt id is the identity, and the RPC resolves its exam, paper and
    // owner itself. Submitting through one scorer means the legacy endpoint
    // cannot grade a different paper from /attempts/:id/submit.
    const { attemptId, answers } = req.body as { attemptId?: string; examId?: string; answers?: Record<string, unknown> };
    if (!attemptId || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'attemptId and answers are required.' });
    }
    // Ownership (the attempt belongs to the caller) is enforced inside the RPC
    // through auth.uid(); the server never passes a user id from the request.
    const { data, error } = await rpcSupabase.rpc('submit_cbt_attempt_configured', {
      p_attempt_id: attemptId,
      p_answers: answers,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return res.status(409).json({ error: 'CBT submission did not produce a result.' });
    res.json({
      attemptId: row.attempt_id,
      score: row.score === null ? null : Number(row.score),
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
    const { supabase, rpcSupabase, user } = await requireUser(req, 'cbt.attempt');
    // Ownership: the row must belong to the caller. A mismatch is a 404, so the
    // response never reveals that someone else's attempt exists.
    const { data: attempt, error } = await supabase
      .from('cbt_attempts')
      .select('id,exam_id,current_question,answers_draft,expires_at,status')
      .eq('id', req.params.attemptId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return res.status(503).json({ error: 'Unable to load CBT progress. Please try again.' });
    if (!attempt) return res.status(404).json({ error: 'CBT attempt not found.' });
    const access = await rpcSupabase.rpc('cbt_bank_candidate_access', { p_exam: attempt.exam_id });
    if (access.error) return res.status(503).json({ error: 'Unable to load CBT progress. Please try again.' });
    if (access.data !== true) return res.status(404).json({ error: 'CBT attempt not found.' });
    res.json({
      answers: attempt.answers_draft || {},
      questionIndex: Number.isInteger(attempt.current_question) ? attempt.current_question : 0,
      expiresAt: attempt.expires_at,
      status: attempt.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Authentication required.' || message === 'Invalid or expired session.') return res.status(401).json({ error: publicErrorMessage(message) });
    if (message === 'You do not have permission to perform this action.') return res.status(403).json({ error: publicErrorMessage(message) });
    res.status(503).json({ error: 'Unable to load CBT progress. Please try again.' });
  }
});

app.patch('/api/cbt/attempts/:attemptId/progress', async (req, res) => {
  try {
    const { rpcSupabase } = await requireUser(req, 'cbt.attempt');
    const answers = req.body?.answers && typeof req.body.answers === 'object' && !Array.isArray(req.body.answers)
      ? req.body.answers
      : {};
    const questionIndex = Number.isInteger(Number(req.body?.questionIndex)) ? Number(req.body.questionIndex) : null;

    const { data, error } = await rpcSupabase.rpc('save_cbt_attempt_draft', {
      p_attempt_id: req.params.attemptId,
      p_answers: answers,
      p_question_index: questionIndex,
    });
    if (isCbtExpiredError(error)) {
      await expireCbtAttempt(rpcSupabase, req.params.attemptId);
      return res.status(409).json({ error: 'This CBT attempt has expired.' });
    }
    if (error) throw error;
    res.json({ ok: true, saved: data || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save CBT progress.';
    const status = httpStatusForErrorMessage(message);
    if (status === 503) res.setHeader('Retry-After', '10');
    res.status(status).json({ error: publicErrorMessage(message, 'Unable to save CBT progress.') });
  }
});


// --- Unified admin content manager -----------------------------------------
// One bulk CMS surface for editable Supabase-backed content. The allowlist keeps
// the endpoint from becoming arbitrary SQL/table access.
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
function contentCbtAllowed(resource: ContentResource, user: UserPayload | null | undefined, capability: 'cbt.read' | 'cbt.manage') {
  return !['cbt_exams', 'exam_questions'].includes(resource.table) || hasCapability(user, capability);
}
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

app.get('/api/admin/content-manager/resources', requireCapability('data.read'), (req, res) => {
  const user = (req as AuthorizedRequest).adminUser;
  res.json({ resources: CONTENT_RESOURCES.filter(resource => contentCbtAllowed(resource, user, 'cbt.read')) });
});

app.get('/api/admin/content-manager/data/:resource', requireCapability('data.read'), async (req, res) => {
  try {
    const resource = getContentResource(req.params.resource);
    if (!resource) return res.status(404).json({ error: 'Content resource not found.' });
    if (!contentCbtAllowed(resource, (req as AuthorizedRequest).adminUser, 'cbt.read')) return res.status(403).json({ error: 'Permission denied.' });
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
    if (!contentCbtAllowed(resource, adminUser, 'cbt.manage')) return res.status(403).json({ error: 'Permission denied.' });
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
    if (!contentCbtAllowed(resource, adminUser, 'cbt.manage')) return res.status(403).json({ error: 'Permission denied.' });
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
    if (!contentCbtAllowed(resource, adminUser, 'cbt.manage')) return res.status(403).json({ error: 'Permission denied.' });
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from(resource.table).delete().eq('id', req.params.id).select('id').single();
    if (error) {
      const message = String(error.message || '');
      if (error.code === '23503' || /foreign key|violates|constraint/i.test(message)) return res.status(409).json({ error: 'This record is still referenced by other data. Archive/deactivate it instead of deleting it.' });
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
    if (!contentCbtAllowed(resource, adminUser, 'cbt.manage')) return res.status(403).json({ error: 'Permission denied.' });
    if (resource.table === 'exam_questions') return res.status(409).json({ error: 'Use the question import review workflow.' });
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
// Docker) and the /api path, for deployments that route /robots.txt and
// /sitemap.xml through the API (the Netlify redirect did; on Vercel the frontend
// must rewrite those two paths to the backend origin).
// ---------------------------------------------------------------------------

async function serveRobotsTxt(req: express.Request, res: express.Response) {
  const origin = resolveSiteOrigin(req);
  res.type('text/plain');
  // The body follows the request's Host header unless the origin is pinned, so
  // only a pinned origin may be served as publicly cacheable.
  for (const [name, value] of Object.entries(crawlerCacheHeaders('robots'))) res.setHeader(name, value);
  res.send(buildRobotsTxt(origin));
}

async function serveSitemapXml(req: express.Request, res: express.Response) {
  const origin = resolveSiteOrigin(req);
  const client = isServerSupabaseConfigured() ? getServerSupabase() : null;
  const entries = await collectSitemapEntries(client, origin, (source, error) => {
    console.error(`Sitemap: ${source} entries unavailable:`, error instanceof Error ? error.message : error);
  });
  res.type('application/xml');
  for (const [name, value] of Object.entries(crawlerCacheHeaders('sitemap'))) res.setHeader(name, value);
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
    // Cache policy, kept in step with public/_headers and the Vercel headers
    // in vercel.json. Express used to serve index.html as `public, max-age=0`
    // while Netlify sent
    // `no-store`, so a self-hosted deployment and a Netlify one disagreed about
    // the shell - and a cached shell references chunk filenames that a deploy
    // has already replaced. Content-hashed assets are immutable on
    // every platform.
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));
    // Middleware does not decode wildcard params, so malformed percent-encoded
    // URLs can reach the frontend's safe not-found page rather than Express's error page.
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`EduReach server running on port ${PORT}`));
}

// The disposable PostgreSQL/HTTP rehearsal imports the real Express app and
// binds its own ephemeral listener. Never suppress startup outside test mode.
const cbtLocalTestImport = process.env.NODE_ENV === 'test' && process.env.CBT_V2_LOCAL_REHEARSAL === '1' && process.env.CBT_V2_TEST_IMPORT === '1';
// Never start the listener on a hosted function platform; only self-hosted
// Express binds a port.
// `NETLIFY` is set during the build, not inside the deployed function. The Lambda
// runtime variables are the reliable runtime signal; without them the Express
// app would try to bind port 3000 inside the function invocation.
const hostedFunctionRuntime = Boolean(
  process.env.NETLIFY ||
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);
if (!hostedFunctionRuntime && !cbtLocalTestImport) {
  startServer().catch((error) => {
    console.error('Unable to start EduReach:', error);
    process.exitCode = 1;
  });
}
