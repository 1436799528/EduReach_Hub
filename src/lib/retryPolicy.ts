/**
 * Retry policy for CBT writes that must survive a flaky connection.
 *
 * The exam hall retries the same idempotent request — never a new operation —
 * with bounded exponential backoff and jitter, so a school lab reconnecting all
 * at once does not stampede one endpoint. A request whose outcome is unknown
 * keeps its stored operation key; retrying it cannot duplicate the write.
 */

export interface BackoffPolicy {
  /** Delay before the first retry. */
  baseMs: number;
  /** Ceiling any single delay can reach. */
  maxMs: number;
  /** Fraction of the computed delay that is randomised (0 disables jitter). */
  jitterRatio: number;
  /** Total attempts including the first one. */
  maxAttempts: number;
}

/** Answer saves and timer-triggered submissions: gentle, capped, jittered. */
export const DEFAULT_WRITE_BACKOFF: BackoffPolicy = {
  baseMs: 2_000,
  maxMs: 30_000,
  jitterRatio: 0.4,
  maxAttempts: 8,
};

/**
 * Delay before retry number `attempt` (1-based: the delay after the first
 * failure). Deterministic when `random` is injected, which is how the tests
 * pin the schedule.
 */
export function backoffDelayMs(attempt: number, policy: BackoffPolicy, random: () => number = Math.random): number {
  const n = Math.max(1, Math.floor(attempt));
  const exponential = Math.min(policy.maxMs, policy.baseMs * 2 ** (n - 1));
  const jitter = Math.min(1, Math.max(0, policy.jitterRatio));
  if (jitter === 0) return exponential;
  // Downward jitter only: the computed delay is the ceiling, never a surprise
  // extension beyond it.
  const factor = 1 - jitter * Math.min(1, Math.max(0, random()));
  return Math.max(1, Math.round(exponential * factor));
}

/** Failures whose request may or may not have reached the server. */
export function isRetryableFailureKind(kind: string): boolean {
  return kind === 'offline' || kind === 'timeout' || kind === 'server' || kind === 'unknown';
}
