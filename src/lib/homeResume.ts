import { cbtAttemptState } from './dashboardPriority';

/**
 * The attempt the home page offers to continue.
 *
 * The server's `resumable` flag and the same expiry rule the dashboard uses are
 * both required: an `in_progress` row whose time has run out must never be
 * presented as something a student can pick up. Returning null is the normal
 * state for a guest, a new student, or someone who has finished everything.
 */
export type ResumableAttempt = {
  id: string;
  status: string;
  resumable: boolean;
  expiresAt: string | null;
};

export function selectResumableAttempt<T extends ResumableAttempt>(
  attempts: readonly T[],
  now: number = Date.now(),
): T | null {
  return attempts.find((attempt) => (
    attempt.resumable
    && cbtAttemptState({ id: attempt.id, status: attempt.status, expires_at: attempt.expiresAt }, now) === 'active'
  )) ?? null;
}
