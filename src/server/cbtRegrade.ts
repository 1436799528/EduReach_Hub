/**
 * Rules for the answer-key regrade tool (working guide 5.5 Step 7).
 *
 * The database function `cbt_regrade_question` does the recompute. This module
 * holds the parts that must be decided in TypeScript and be testable as rules:
 * what an operator may confirm, how a raw RPC payload is validated before it is
 * trusted, and what gets written to the audit log.
 *
 * Nothing here reads or writes a result. In particular the regrade never takes
 * a score, a correct answer or an attempt id from the request body: the only
 * inputs are the question id and the operator's confirmation of the key they
 * believe is now stored.
 */

export const REGRADE_KEYS = ['A', 'B', 'C', 'D'] as const;
export type RegradeKey = (typeof REGRADE_KEYS)[number];

/** The grader that produced the recomputed result. Recorded so a result can be
 *  explained later without guessing which code path wrote it. */
export const REGRADE_GRADER = 'regrade-1';

export function isRegradeKey(value: unknown): value is RegradeKey {
  return typeof value === 'string' && (REGRADE_KEYS as readonly string[]).includes(value.toUpperCase());
}

export interface RegradeVerdict {
  score: number | null;
  correctAnswers: number;
  isCorrect: boolean;
}

export interface RegradeAttemptChange {
  attemptId: string;
  userId: string;
  protocol: string;
  changed: boolean;
  before: RegradeVerdict;
  after: RegradeVerdict;
}

export interface RegradeOutcome {
  applied: boolean;
  questionId: string;
  examId: string;
  correctOption: RegradeKey;
  grader: string;
  scanned: number;
  changed: number;
  unchanged: number;
  truncated: boolean;
  attempts: RegradeAttemptChange[];
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCount(value: unknown, fallback = 0): number {
  const parsed = toNumberOrNull(value);
  return parsed !== null && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

function readVerdict(value: unknown): RegradeVerdict | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return {
    score: toNumberOrNull(row.score),
    correctAnswers: toCount(row.correctAnswers),
    isCorrect: row.isCorrect === true,
  };
}

function readChange(value: unknown): RegradeAttemptChange | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const before = readVerdict(row.before);
  const after = readVerdict(row.after);
  if (!before || !after) return null;
  if (typeof row.attemptId !== 'string' || !row.attemptId) return null;
  return {
    attemptId: row.attemptId,
    userId: typeof row.userId === 'string' ? row.userId : '',
    protocol: typeof row.protocol === 'string' ? row.protocol : 'legacy',
    changed: row.changed === true,
    before,
    after,
  };
}

/**
 * Validate the JSON the database function returned before anything is reported
 * to an operator or written to the audit log. A malformed payload is a failure,
 * not an empty success: reporting "0 attempts changed" because the shape was
 * unexpected would be a silent lie about a scoring change.
 */
export function parseRegradeOutcome(value: unknown): RegradeOutcome | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.questionId !== 'string' || !row.questionId) return null;
  if (typeof row.examId !== 'string' || !row.examId) return null;
  if (!isRegradeKey(row.correctOption)) return null;
  if (!Array.isArray(row.attempts)) return null;
  const attempts: RegradeAttemptChange[] = [];
  for (const entry of row.attempts) {
    const change = readChange(entry);
    if (!change) return null;
    attempts.push(change);
  }
  const scanned = toCount(row.scanned);
  const changed = toCount(row.changed);
  if (changed > scanned) return null;
  return {
    applied: row.applied === true,
    questionId: row.questionId,
    examId: row.examId,
    correctOption: row.correctOption.toUpperCase() as RegradeKey,
    grader: typeof row.grader === 'string' && row.grader ? row.grader : REGRADE_GRADER,
    scanned,
    changed,
    unchanged: toCount(row.unchanged, Math.max(0, scanned - changed)),
    truncated: row.truncated === true,
    attempts,
  };
}

/**
 * The confirmation the operator typed, checked against the key that is actually
 * stored now.
 *
 * A correction and a regrade are two separate steps, and between them another
 * reviewer may have edited the key again. Refusing the mismatch is what stops a
 * regrade from being applied to a key the operator never saw.
 */
export function checkExpectedKey(expected: unknown, current: unknown): { ok: true } | { ok: false; error: string } {
  if (expected === undefined || expected === null || expected === '') return { ok: true };
  if (!isRegradeKey(expected)) return { ok: false, error: 'Confirm the answer key as A, B, C or D.' };
  if (!isRegradeKey(current)) return { ok: false, error: 'This question has no stored answer key to regrade against.' };
  if (expected.toUpperCase() !== current.toUpperCase()) {
    return {
      ok: false,
      error: 'The stored answer key has changed since you reviewed it. Reload the question and check it before regrading.',
    };
  }
  return { ok: true };
}

/** One sentence an operator can act on. */
export function regradeHeadline(result: RegradeOutcome): string {
  if (!result.applied) {
    if (result.changed === 0) return 'No submitted attempt is affected by this key. Nothing would change.';
    return `${result.changed} of ${result.scanned} submitted attempt${result.scanned === 1 ? '' : 's'} would change.`;
  }
  if (result.changed === 0) {
    return `Nothing to change: ${result.scanned} submitted attempt${result.scanned === 1 ? '' : 's'} already match this key.`;
  }
  return `Regraded ${result.changed} of ${result.scanned} submitted attempt${result.scanned === 1 ? '' : 's'}.`;
}

/**
 * Audit metadata for one regrade run.
 *
 * Kept as a single entry so the record of what changed is written once, with the
 * operation, rather than as hundreds of rows that could be interrupted halfway
 * and leave an audit trail that disagrees with the results. The per-attempt list
 * is capped at the same 500 the database function returns; `truncated` says when
 * the cap was reached, and the counts above it are always complete.
 */
export function regradeAuditMetadata(result: RegradeOutcome): Record<string, unknown> {
  return {
    exam_id: result.examId,
    correct_option: result.correctOption,
    applied: result.applied,
    grader: result.grader,
    scanned: result.scanned,
    changed: result.changed,
    unchanged: result.unchanged,
    truncated: result.truncated,
    attempts: result.attempts.map((attempt) => ({
      attempt_id: attempt.attemptId,
      user_id: attempt.userId || null,
      protocol: attempt.protocol,
      before: attempt.before,
      after: attempt.after,
    })),
  };
}
