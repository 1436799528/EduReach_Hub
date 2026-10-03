/**
 * APP-4 — one vocabulary for "what went wrong", shared by every screen.
 *
 * Before this existed, each page invented its own copy: a dropped connection, a
 * five-second timeout, a 500 and an expired session could all surface as either
 * "Failed to fetch", a raw Supabase code, or a blank area. A student in Lagos on
 * a weak mobile connection needs to know three things: is it my connection, is it
 * the server, or do I need to sign in again — and is it worth retrying.
 *
 * Nothing here touches the network itself; it classifies an error that already
 * happened and describes the recovery the UI should offer.
 */

export type FailureKind =
  | 'offline'
  | 'timeout'
  | 'server'
  | 'auth'
  | 'validation'
  | 'not-found'
  | 'rate-limited'
  | 'unknown';

export type Failure = {
  kind: FailureKind;
  /** Plain-language title, safe to show directly. */
  title: string;
  /** What the student can do about it. */
  detail: string;
  /** Whether offering a "Try again" control is meaningful. */
  retryable: boolean;
  /** Whether the student's typed input should be preserved (it nearly always should). */
  preserveInput: boolean;
};

const MESSAGES: Record<FailureKind, Omit<Failure, 'kind'>> = {
  offline: {
    title: 'You are offline',
    detail: 'Your device has no connection. Your work is kept on this device and will sync when you reconnect.',
    retryable: true,
    preserveInput: true,
  },
  timeout: {
    title: 'This is taking too long',
    detail: 'The request did not finish in time. This is usually a slow connection — try again in a moment.',
    retryable: true,
    preserveInput: true,
  },
  server: {
    title: 'EduReach is having a problem',
    detail: 'The service could not complete that request. It is not something you did — please try again shortly.',
    retryable: true,
    preserveInput: true,
  },
  auth: {
    title: 'Your session has ended',
    detail: 'Sign in again to continue. Nothing you have already saved is lost.',
    retryable: false,
    preserveInput: true,
  },
  validation: {
    title: 'Please check your details',
    detail: 'Something in the form needs changing before this can be sent.',
    retryable: false,
    preserveInput: true,
  },
  'not-found': {
    title: 'Not available',
    detail: 'This item may have been removed or never existed. Go back and choose another.',
    retryable: false,
    preserveInput: false,
  },
  'rate-limited': {
    title: 'Too many attempts',
    detail: 'Please wait a moment before trying again.',
    retryable: true,
    preserveInput: true,
  },
  unknown: {
    title: 'Something went wrong',
    detail: 'Please try again. If it keeps happening, reload the page.',
    retryable: true,
    preserveInput: true,
  },
};

export class EduReachError extends Error {
  readonly kind: FailureKind;
  readonly status: number | null;

  constructor(message: string, kind: FailureKind = 'unknown', status: number | null = null) {
    super(message);
    this.name = 'EduReachError';
    this.kind = kind;
    this.status = status;
  }
}

/** Classify an error into a student-facing failure with recovery guidance. */
export function classifyFailure(error: unknown, fallbackKind: FailureKind = 'unknown'): Failure {
  const kind = failureKindOf(error) ?? fallbackKind;
  return { kind, ...MESSAGES[kind] };
}

export function failureKindOf(error: unknown): FailureKind | null {
  if (!error) return null;
  if (error instanceof EduReachError && error.kind !== 'unknown') return error.kind;

  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && PG_CODE_KINDS[code]) return PG_CODE_KINDS[code];

  const status = statusOf(error);
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not-found';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 429) return 'rate-limited';
  if (status === 422) return 'validation';
  if (status !== null && status >= 500) return 'server';

  const message = String((error as { message?: string })?.message ?? error).toLowerCase();
  if (/offline|no internet|network (error|request failed)|failed to fetch|load failed|connection/i.test(message)) {
    // A browser that is reporting "no network" while `navigator.onLine` is true
    // is still an offline-shaped failure for the student.
    return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'server';
  }
  if (/timeout|timed out|aborted/i.test(message)) return 'timeout';
  if (/invalid or expired session|authentication required|sign in|unauthor/i.test(message)) return 'auth';
  if (/permission|not allowed|not authorised|not authorized/i.test(message)) return 'auth';
  if (/not found|no longer available|removed/i.test(message)) return 'not-found';
  if (/too many|rate limit/i.test(message)) return 'rate-limited';
  if (/no questions are available|must|required|invalid|choose|select|enter a valid/i.test(message)) return 'validation';
  return null;
}

/**
 * PostgreSQL/Supabase error codes that carry a student-facing meaning.
 * `relation does not exist` is not something to show a student; "not available"
 * is, and it tells the UI not to offer a pointless retry.
 */
const PG_CODE_KINDS: Record<string, FailureKind> = {
  '42P01': 'not-found',   // undefined_table
  '42883': 'not-found',   // undefined_function
  'PGRST202': 'not-found',
  'PGRST205': 'not-found',
  '23505': 'validation',  // unique_violation
  '23503': 'validation',  // foreign_key_violation
  '23514': 'validation',  // check_violation
  '42501': 'auth',        // insufficient_privilege
  'PGRST301': 'auth',     // JWT/claim failure
  'PGRST302': 'auth',
  '53300': 'server',      // too_many_connections
  '57014': 'timeout',     // query_canceled (statement timeout)
};

function statusOf(error: unknown): number | null {
  const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown } | null;
  for (const value of [candidate?.status, candidate?.statusCode]) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  // Supabase/PostgREST numeric codes arrive as strings ("42P01", "23505"…); only
  // HTTP-shaped codes are statuses.
  const code = typeof candidate?.code === 'string' ? Number(candidate.code) : NaN;
  return Number.isFinite(code) && code >= 400 && code < 600 ? code : null;
}

/** True when the browser reports the device is offline. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
