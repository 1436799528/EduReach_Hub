/**
 * OBS-2 - structured server events.
 *
 * The server had ninety-odd `console.error('Something error:', error)` calls:
 * free text plus a raw error object. That is unreadable at volume, uncorrelatable
 * across a request, and unsafe by accident — a Supabase error message can quote a
 * column and a value, and a fetch error can carry a URL with a token in it.
 *
 * This module is the smallest thing that fixes all three without a dependency:
 *
 *  - **One line, one JSON object.** Every event is `{ ts, level, service, env,
 *    event, ...context }` on a single line, so a log drain can parse it and a
 *    human can read it.
 *  - **Severity is real.** `warn` and above go to stderr, so a platform that
 *    treats streams differently can alert on the error stream alone.
 *  - **Context is sanitised by construction, not by review.** Keys that name a
 *    credential are replaced, strings are capped, nesting is capped, and an
 *    `Error` is reduced to its name/SQLSTATE/status — never its message.
 *
 * What it deliberately is not: a metrics system, a tracer, or a replacement for
 * `site_analytics_events` (product events), `admin_audit_logs` (who changed
 * what) or `scheduled_job_runs` (background jobs). Those already exist and keep
 * their jobs; this is the operational log the platform captures.
 *
 * See docs/operations/OBSERVABILITY.md for the event catalogue, the severities
 * and the alert thresholds each event feeds.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

/** Levels that go to stderr. Platform log drains typically separate the streams. */
const STDERR_FROM: Record<LogLevel, boolean> = {
  debug: false,
  info: false,
  warn: true,
  error: true,
  critical: true,
};

/**
 * Anything whose name matches is replaced, not logged. This is a deny-list on
 * purpose: an allow-list of "safe" keys would silently drop a new diagnostic
 * field, while a key that names a credential must never be printed.
 */
const SENSITIVE_KEY =
  /(authorization|auth|cookie|token|secret|password|passwd|apikey|api_key|service_role|session|jwt|bearer|signature|credential)/i;

const MAX_STRING = 300;
const MAX_KEYS = 24;
const MAX_DEPTH = 2;
const REDACTED = '[redacted]';

function capString(value: string): string {
  if (value.length <= MAX_STRING) return value;
  return `${value.slice(0, MAX_STRING)}…`;
}

/**
 * Reduce an unknown value to something safe to print.
 *
 * Objects and arrays are walked only to a shallow depth; anything deeper is
 * summarised as a type name. That keeps an accidental `log.info('x', { row })`
 * from dumping a student's record into the platform log.
 */
function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return capString(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return errorFacts(value);
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return `[array:${value.length}]`;
    return value.slice(0, MAX_KEYS).map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= MAX_DEPTH) return '[object]';
    const out: Record<string, unknown> = {};
    let keys = 0;
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (keys >= MAX_KEYS) break;
      keys += 1;
      if (SENSITIVE_KEY.test(key)) {
        out[key] = REDACTED;
        continue;
      }
      out[key] = sanitizeValue(entry, depth + 1);
    }
    return out;
  }
  if (typeof value === 'function') return '[function]';
  return '[unknown]';
}

/** Sanitise a context object for logging. Exported for tests. */
export function sanitizeContext(context: Record<string, unknown> = {}): Record<string, unknown> {
  const safe = (sanitizeValue(context, 0) as Record<string, unknown>) || {};
  return safe;
}

/**
 * The facts about an error that are safe to log: what kind, which SQLSTATE, what
 * status. Never the message, because a driver or SDK message is exactly where a
 * value or a connection string ends up.
 */
export function errorFacts(error: unknown): { error_name: string; error_code?: string; error_status?: number } {
  if (error && typeof error === 'object') {
    const candidate = error as { name?: unknown; code?: unknown; status?: unknown; statusCode?: unknown };
    const facts: { error_name: string; error_code?: string; error_status?: number } = {
      error_name: typeof candidate.name === 'string' && candidate.name ? capString(candidate.name) : 'Error',
    };
    // SQLSTATE and PostgREST codes are short identifiers (23505, PGRST116).
    if (typeof candidate.code === 'string' && /^[A-Za-z0-9_]{1,20}$/.test(candidate.code))
      facts.error_code = candidate.code;
    const status = Number(candidate.status ?? candidate.statusCode);
    if (Number.isInteger(status) && status >= 100 && status <= 599) facts.error_status = status;
    return facts;
  }
  return { error_name: typeof error === 'string' ? 'NonErrorThrown' : 'Unknown' };
}

export interface LogRecord extends Record<string, unknown> {
  ts: string;
  level: LogLevel;
  service: string;
  env: string;
  event: string;
}

export type LogSink = (record: LogRecord, stream: 'stdout' | 'stderr') => void;

const defaultSink: LogSink = (record, stream) => {
  const line = JSON.stringify(record);
  if (stream === 'stderr') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
};

let sink: LogSink = defaultSink;

/** Test seam: replace the sink, and restore it by passing `null`. */
export function setLogSink(replacement: LogSink | null): void {
  sink = replacement || defaultSink;
}

function platformEnv(): string {
  // `CONTEXT` is Netlify's build/deploy context; `NODE_ENV` is what a
  // self-hosted container sets. Either one naming production is enough.
  if (process.env.CONTEXT === 'production' || process.env.NODE_ENV === 'production') return 'production';
  return process.env.NODE_ENV || 'development';
}

function deployRef(): string | undefined {
  const ref = process.env.COMMIT_REF || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  return typeof ref === 'string' && /^[0-9a-f]{7,40}$/i.test(ref) ? ref.slice(0, 12) : undefined;
}

/**
 * Emit one structured event. Never throws: a logging failure must not become the
 * second failure of a request.
 */
export function logEvent(level: LogLevel, event: string, context: Record<string, unknown> = {}): void {
  try {
    const record: LogRecord = {
      ts: new Date().toISOString(),
      level,
      service: 'edureach-api',
      env: platformEnv(),
      event,
      ...sanitizeContext(context),
    };
    const ref = deployRef();
    if (ref) record.commit = ref;
    sink(record, STDERR_FROM[level] ? 'stderr' : 'stdout');
  } catch {
    // A logging bug is not an incident. Swallow it.
  }
}

export const log = {
  debug: (event: string, context?: Record<string, unknown>) => logEvent('debug', event, context),
  info: (event: string, context?: Record<string, unknown>) => logEvent('info', event, context),
  warn: (event: string, context?: Record<string, unknown>) => logEvent('warn', event, context),
  error: (event: string, context?: Record<string, unknown>) => logEvent('error', event, context),
  critical: (event: string, context?: Record<string, unknown>) => logEvent('critical', event, context),
};

// ---------------------------------------------------------------------------
// Request correlation
// ---------------------------------------------------------------------------

/** Accept an inbound id only when it looks like an id, never like a payload. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,64}$/;

/**
 * Correlation id for this request. The platform's own id is preferred (Netlify
 * sends `x-nf-request-id`), because that is what an operator can search for in
 * the function log. A client-supplied id is trusted only if it is shaped like an
 * id, so a header cannot smuggle a value into every log line of a request.
 */
export function requestIdFor(headers: Record<string, unknown>): string {
  for (const name of ['x-nf-request-id', 'x-request-id', 'x-correlation-id']) {
    const raw = headers[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && REQUEST_ID_PATTERN.test(value)) return value;
  }
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Readiness transitions.
 *
 * A monitor polls `/api/health/ready` every minute. Logging each poll is noise;
 * logging nothing leaves an outage invisible in the log. This reports the
 * transition into and out of degradation, and repeats the degraded state rarely
 * enough to prove it is still happening.
 */
export function createReadinessReporter(options: { reminderMs?: number; now?: () => number } = {}) {
  let last: boolean | null = null;
  const reminder = new EventRateLimiter(1, options.reminderMs ?? 600_000, options.now);
  return function reportReadiness(ready: boolean, failingChecks: string[], databaseLatencyMs: number | null): void {
    if (ready) {
      if (last === false) log.info('health.recovered', { database_latency_ms: databaseLatencyMs });
      last = true;
      return;
    }
    // Always charge the reminder window, even on the transition: otherwise the
    // first poll of an ongoing outage would look like a fresh allowance and be
    // logged twice.
    const reminderDue = reminder.allow('degraded');
    if (last !== false || reminderDue) {
      log.warn('health.degraded', { failing_checks: failingChecks, database_latency_ms: databaseLatencyMs });
    }
    last = false;
  };
}

/**
 * Per-process rate limit for "this is happening a lot" events.
 *
 * An unauthenticated probe against a guarded route is expected traffic; a
 * thousand of them a minute is an incident. Logging one line per request would
 * turn the incident into a log flood, so repeated identical events are collapsed
 * and the suppressed count is reported when the window reopens.
 */
export class EventRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number; suppressed: number }>();

  constructor(
    private readonly maxPerWindow = 30,
    private readonly windowMs = 60_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Returns true when this event should be written, false when suppressed. */
  allow(key: string): boolean {
    const at = this.now();
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= at) {
      const suppressed = existing?.suppressed ?? 0;
      this.windows.set(key, { count: 1, resetAt: at + this.windowMs, suppressed: 0 });
      if (suppressed > 0) {
        logEvent('warn', 'log.suppressed', { key, suppressed_in_window: suppressed });
        return true;
      }
      return true;
    }
    if (existing.count >= this.maxPerWindow) {
      existing.suppressed += 1;
      return false;
    }
    existing.count += 1;
    return true;
  }

  reset(): void {
    this.windows.clear();
  }
}
