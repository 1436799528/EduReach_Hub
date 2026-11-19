/**
 * MONT-2 - error aggregation, behind a switch that is off by default.
 *
 * The structured log answers "what happened in this request". It deliberately
 * does not answer "which of these is the same problem, and how often" - that is
 * aggregation, and it belongs to an error tracker rather than to a log line.
 *
 * This module is the whole integration surface:
 *
 *  - **Inert without configuration.** No `SENTRY_DSN` means the SDK is never
 *    imported, nothing is initialised, no socket is opened, and every other
 *    behaviour is byte-identical to the build that did not have this file.
 *  - **The log stays the record of truth.** `lib/observability.ts` writes one
 *    sanitised line per event and hands the same record - with the original
 *    exception, which the line deliberately omits - to a registered forwarder.
 *    There is no second logging pipeline.
 *  - **Volume is bounded twice.** Only error/critical events, only a documented
 *    allowlist (or an event that carries an exception), and at most a fixed
 *    number of events per hour. The free tier is 5,000 errors a month; a burst
 *    must not be able to consume it in a morning.
 *  - **Nothing identifying is sent.** `sendDefaultPii: false`, no user object, no
 *    request body, no cookies, no headers, no server name, no query string, no
 *    breadcrumb data, and `extra` is run through the same key-name redactor the
 *    log uses. That is the privacy review this feature was approved under; see
 *    docs/operations/MONITORING.md.
 *
 * What it is not: performance tracing (`tracesSampleRate: 0`), a metrics store,
 * or a replacement for `scheduled_job_runs`, `site_analytics_events` or
 * `admin_audit_logs`.
 */

import { EventRateLimiter, sanitizeContext, setLogForwarder, type LogLevel, type LogRecord } from './observability';

export interface ErrorTrackingPayload {
  event: string;
  level: LogLevel;
  requestId?: string;
  context: Record<string, unknown>;
}

export interface ErrorTrackingClient {
  captureException(error: unknown, payload: ErrorTrackingPayload): void;
  captureMessage(payload: ErrorTrackingPayload): void;
  flush(timeoutMs: number): Promise<boolean>;
}

/**
 * Events worth an issue of their own.
 *
 * The rule is "a maintainer would act on this". Route-level admin failures stay
 * out: every one of them also produces `http.server_error` with the route and
 * status, which is the aggregation grain that matters. Forwarding both would
 * double every incident in the tracker.
 */
export const FORWARDED_EVENTS: readonly string[] = [
  'http.server_error',
  'http.unhandled_exception',
  'process.uncaught_exception',
  'process.unhandled_rejection',
  'server.start_failed',
  'cbt.start_failed',
  'cbt.paper_failed',
  'cbt.draft_save_failed',
  'cbt.submit_failed',
  'cbt.guest_submit_failed',
  'cbt.regrade.failed',
  'cbt.regrade.preview_failed',
  'audit.write_failed',
  'scheduled_job.failed',
  'newsroom.refresh_failed',
];

const FORWARDED = new Set(FORWARDED_EVENTS);

/** An exception is always worth forwarding; a bare error-level event is not. */
export function shouldForward(event: string, level: LogLevel, hasError = false): boolean {
  if (level !== 'error' && level !== 'critical') return false;
  return hasError || FORWARDED.has(event);
}

let client: ErrorTrackingClient | null = null;
let installed = false;

/** Test seam, and the seam a self-hosted deployment could use. */
export function setErrorTrackingClient(replacement: ErrorTrackingClient | null): void {
  client = replacement;
}

export function errorTrackingConfigured(): boolean {
  return client !== null;
}

export async function flushErrorTracking(timeoutMs = 2000): Promise<boolean> {
  if (!client) return true;
  try {
    return await client.flush(timeoutMs);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Privacy: what is allowed to leave the process
// ---------------------------------------------------------------------------

const MAX_STRING = 300;
const SENSITIVE_KEY =
  /(authorization|auth|cookie|token|secret|password|passwd|apikey|api_key|service_role|session|jwt|bearer|signature|credential)/i;

function cap(value: string): string {
  return value.length <= MAX_STRING ? value : `${value.slice(0, MAX_STRING)}…`;
}

/**
 * The path only: a query string can carry a search term or a token. Applied to
 * breadcrumb messages too, because a fetch breadcrumb's message is a URL.
 */
function pathOf(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const withoutQuery = url.split('?')[0].split('#')[0];
  return cap(withoutQuery);
}

function stringTags(tags: unknown): Record<string, string> | undefined {
  if (!tags || typeof tags !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (value === null || value === undefined) continue;
    out[key.slice(0, 64)] = cap(String(value));
  }
  return out;
}

/**
 * Reduce a SDK event to the minimum that is still useful.
 *
 * Exported because it is the part worth testing: everything else in this file is
 * wiring, and this is the function that decides what a third party learns about
 * a student's request.
 */
export function redactSentryEvent<T extends Record<string, unknown>>(event: T): T {
  const safe = { ...event } as Record<string, unknown>;

  // Hostname and deployment identity are our infrastructure, not the error.
  delete safe.server_name;
  // No identity of any kind: an operator has the request id and can look up the
  // same event in our own log if a human needs to.
  delete safe.user;
  // OS/device/runtime/cloud-resource context is fingerprinting surface.
  delete safe.contexts;

  if (safe.request && typeof safe.request === 'object') {
    const request = safe.request as Record<string, unknown>;
    // Headers, cookies, body and query string are all dropped: the only parts
    // kept are the method and the path.
    safe.request = { method: request.method, url: pathOf(request.url) };
  }

  if (safe.extra && typeof safe.extra === 'object') {
    safe.extra = sanitizeContext(safe.extra as Record<string, unknown>);
  }
  if (safe.tags) safe.tags = stringTags(safe.tags);
  if (typeof safe.message === 'string') safe.message = cap(safe.message);

  if (Array.isArray(safe.breadcrumbs)) {
    safe.breadcrumbs = (safe.breadcrumbs as Array<Record<string, unknown>>).slice(-10).map((crumb) => ({
      category: typeof crumb.category === 'string' ? cap(crumb.category) : undefined,
      level: crumb.level,
      timestamp: crumb.timestamp,
      message: pathOf(crumb.message),
      // `data` is where a fetch breadcrumb keeps the full URL.
    }));
  }

  return safe as T;
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/**
 * Quota protection for the free tier, in two dimensions.
 *
 * The hourly cap keeps a storm from spending the month in an afternoon; the
 * daily cap is the one that makes the monthly quota unreachable: 30/hour and
 * 150/day can never exceed 4,650 events in a 31-day month, against a 5,000/month
 * allowance. A capped event is still a line in our own log - the tracker is the
 * aggregation, not the record.
 */
function budgetFor(env: NodeJS.ProcessEnv): { hourly: EventRateLimiter; daily: EventRateLimiter } {
  const hour = Number(env.SENTRY_MAX_EVENTS_PER_HOUR);
  const day = Number(env.SENTRY_MAX_EVENTS_PER_DAY);
  return {
    hourly: new EventRateLimiter(Number.isFinite(hour) && hour > 0 ? hour : 30, 3_600_000),
    daily: new EventRateLimiter(Number.isFinite(day) && day > 0 ? day : 150, 86_400_000),
  };
}

function environmentFor(env: NodeJS.ProcessEnv): string {
  return env.CONTEXT || env.NODE_ENV || 'development';
}

function releaseFor(env: NodeJS.ProcessEnv): string | undefined {
  const ref = env.COMMIT_REF || env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA;
  return typeof ref === 'string' && /^[0-9a-f]{7,40}$/i.test(ref) ? ref.slice(0, 12) : undefined;
}

/** Register the forwarding rule on a client. Separated so tests need no SDK. */
export function installForwarder(
  target: ErrorTrackingClient,
  budget: EventRateLimiter,
  daily: EventRateLimiter = new EventRateLimiter(150, 86_400_000),
): void {
  setLogForwarder((record: LogRecord, error?: unknown) => {
    if (!shouldForward(record.event, record.level, error !== undefined)) return;
    // Both windows must allow it: the hourly cap smooths a burst, the daily cap
    // is what actually bounds the month.
    if (!budget.allow(record.event)) return;
    if (!daily.allow(record.event)) return;
    const { ts: _ts, service: _service, env: _env, ...context } = record;
    const payload: ErrorTrackingPayload = {
      event: record.event,
      level: record.level,
      requestId: typeof record.request_id === 'string' ? record.request_id : undefined,
      context,
    };
    // `sanitizeContext` already ran when the line was built; running it again
    // costs nothing and is the guarantee, not an optimisation.
    payload.context = sanitizeContext(context);
    if (error !== undefined) target.captureException(error, payload);
    else target.captureMessage(payload);
  });
}

/**
 * Start error aggregation if - and only if - a DSN is configured.
 *
 * Returns whether the tracker is active. Never throws: a misconfigured tracker
 * must not stop the server from serving.
 */
export async function startErrorTracking(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (installed) return client !== null;
  installed = true;
  const dsn = env.SENTRY_DSN;
  if (!dsn) return false;

  try {
    // Imported only when configured: an unconfigured deployment never loads the
    // SDK, so its startup path and memory profile are unchanged.
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: environmentFor(env),
      release: releaseFor(env),
      // The privacy review, expressed as SDK options rather than as a promise.
      // This SDK version replaced `sendDefaultPii` with per-category collection:
      // every category is off, so the payload is the exception, the stack and our
      // own sanitised `extra` - nothing the SDK gathers by itself.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        graphQL: { document: false, variables: false },
        genAI: { inputs: false, outputs: false },
        mcp: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false,
        frameContextLines: 0,
      },
      // No performance data: that is the unapproved "full APM" item.
      tracesSampleRate: 0,
      maxBreadcrumbs: 10,
      beforeBreadcrumb: (crumb) => ({
        category: crumb.category,
        level: crumb.level,
        message: pathOf(crumb.message),
      }),
      beforeSend: (event) => redactSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
    });

    const adapter: ErrorTrackingClient = {
      captureException: (error, payload) => {
        Sentry.captureException(error, {
          level: payload.level === 'critical' ? 'fatal' : 'error',
          // One issue per event name (plus route/status where we have them), so
          // counts mean "how often did this happen", not "how many strings".
          fingerprint: [payload.event, String(payload.context.route ?? ''), String(payload.context.status ?? '')],
          tags: {
            event: payload.event,
            request_id: payload.requestId ?? 'none',
          },
          extra: payload.context,
        });
      },
      captureMessage: (payload) => {
        Sentry.captureMessage(payload.event, {
          level: payload.level === 'critical' ? 'fatal' : 'error',
          fingerprint: [payload.event, String(payload.context.route ?? ''), String(payload.context.status ?? '')],
          tags: { event: payload.event, request_id: payload.requestId ?? 'none' },
          extra: payload.context,
        });
      },
      flush: (timeoutMs) => Sentry.flush(timeoutMs),
    };

    const budget = budgetFor(env);
    setErrorTrackingClient(adapter);
    installForwarder(adapter, budget.hourly, budget.daily);
    return true;
  } catch {
    // A tracker that cannot start is a missing diagnostic, not an outage: the
    // structured log still has the event.
    return false;
  }
}

/** Reset module state. Tests only. */
export function __resetErrorTrackingForTests(): void {
  client = null;
  installed = false;
  setLogForwarder(null);
}
