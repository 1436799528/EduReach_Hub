import { trackEvent } from './api';

/**
 * P2-2 — client-side error telemetry.
 *
 * There was no error signal from the browser anywhere in the repository: a
 * broken route rendered a friendly panel and logged to a console nobody reads,
 * and an unhandled rejection was not captured at all. The audit found two
 * defects (P1-2, P1-3) by running gates, not by monitoring — this is the
 * missing signal.
 *
 * Design constraints, all load-bearing:
 *
 *  - **No message, no stack, no component path.** What is sent is a source
 *    enum and an error constructor name. An error message can contain anything
 *    the page was holding (a student's name, a search term, a token); the
 *    taxonomy refuses free text by construction and this module never has a
 *    reason to try.
 *  - **Bounded.** One report per (source, kind) per session, hard-capped, so a
 *    render loop cannot turn a bug into an analytics flood.
 *  - **It can never break the page.** Everything is wrapped; telemetry failing
 *    must never be the second error.
 *  - **Off unless a real deployment.** Global listeners are installed only when
 *    `import.meta.env.PROD` is true, so tests and dev sessions do not emit.
 */

export type ClientErrorSource = 'boundary' | 'window_error' | 'unhandled_rejection';

type Emit = (event: 'client_error', payload: { metadata: Record<string, unknown> }) => void;

/**
 * The production transport. Written as an explicit literal `trackEvent` call
 * because `scripts/analytics-audit.ts` reads call sites statically — it must be
 * able to see that this module emits the declared event, and exactly which
 * metadata keys it sends.
 */
function defaultEmit(_event: 'client_error', payload: { metadata: Record<string, unknown> }): void {
  trackEvent('client_error', { metadata: payload.metadata });
}

/** A constructor name is an identifier; anything else is not sent. */
const KIND_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$.]{0,63}$/;
const MAX_REPORTS_PER_SESSION = 10;

let reportedCount = 0;
const reported = new Set<string>();

export function clientErrorKind(error: unknown): string {
  if (error instanceof Error && typeof error.name === 'string' && KIND_PATTERN.test(error.name)) return error.name;
  if (typeof error === 'string' || typeof error === 'number') return 'NonErrorThrown';
  return 'Unknown';
}

/**
 * Record that a page failed. Returns true when a report was sent. The `emit`
 * argument is the test seam; production callers leave it at `trackEvent`.
 */
export function reportClientError(source: ClientErrorSource, error: unknown, emit: Emit = defaultEmit): boolean {
  try {
    if (reportedCount >= MAX_REPORTS_PER_SESSION) return false;
    const kind = clientErrorKind(error);
    const key = `${source}:${kind}`;
    // Deduplicated per session: the signal is "this thing is broken", and the
    // first occurrence already carries it.
    if (reported.has(key)) return false;
    reported.add(key);
    reportedCount += 1;
    emit('client_error', { metadata: { source, kind } });
    return true;
  } catch {
    return false;
  }
}

/** Test seam: forget what has already been reported in this session. */
export function resetClientErrorReporting(): void {
  reported.clear();
  reportedCount = 0;
}

let installed = false;

export function installGlobalErrorReporting(): void {
  if (installed) return;
  if (typeof window === 'undefined') return;
  if (!import.meta.env?.PROD) return;
  installed = true;

  window.addEventListener('error', (event) => {
    reportClientError('window_error', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportClientError('unhandled_rejection', event.reason);
  });
}
