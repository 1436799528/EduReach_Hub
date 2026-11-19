/**
 * The rules for a student's question report (working guide 5.3 Step I, 5.7).
 *
 * Kept out of `server.ts` so the rules can be tested as rules: what a valid
 * category is, what happens to a pasted wall of text, and what a tidied note
 * looks like. The route is then only transport, ownership and storage.
 */

/** What a student may say is wrong. Mirrors the CHECK on question_reports.category. */
export const QUESTION_REPORT_CATEGORIES = ['wrong_answer', 'typo', 'image', 'other'] as const;
export type QuestionReportCategory = (typeof QUESTION_REPORT_CATEGORIES)[number];

/** The states an administrator may move a report to. `open` is the default only. */
export const QUESTION_REPORT_STATUSES = ['triaged', 'resolved', 'dismissed'] as const;
export type QuestionReportStatus = (typeof QUESTION_REPORT_STATUSES)[number];

/** Free text is one sentence, not an essay. Matches the CHECK on detail. */
export const QUESTION_REPORT_DETAIL_MAX = 500;

export function isQuestionReportCategory(value: unknown): value is QuestionReportCategory {
  return typeof value === 'string' && (QUESTION_REPORT_CATEGORIES as readonly string[]).includes(value);
}

export function isQuestionReportStatus(value: unknown): value is QuestionReportStatus {
  return typeof value === 'string' && (QUESTION_REPORT_STATUSES as readonly string[]).includes(value);
}

/**
 * Tidy a free-text note.
 *
 * - `undefined`/`null` becomes `null` (the student said nothing, which is allowed).
 * - A non-string is `'invalid'`: the caller must reject it rather than coerce it,
 *   because `["a"]` or `{}` arriving here means a malformed client.
 * - Control characters are replaced with a space and runs of whitespace are
 *   collapsed, so a paste of tab-separated text is readable in the queue.
 * - The result is capped at `QUESTION_REPORT_DETAIL_MAX` characters. The cap is
 *   applied after trimming so a note cannot be padded past the limit.
 * - Whitespace-only input is `null`, not an empty string: an empty note and no
 *   note are the same thing, and storing `''` would look like a written note.
 */
export function cleanReportDetail(value: unknown): string | null | 'invalid' {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return 'invalid';
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, QUESTION_REPORT_DETAIL_MAX);
}
