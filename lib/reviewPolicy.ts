/**
 * What makes a review usable. Shared by the API and its tests so the two can
 * never disagree about the minimum length, the allowed exam types or how much
 * of a pasted essay is kept.
 *
 * A review is not a testimonial: the text is required, the rating is an
 * integer a radio group produced, and an unknown exam type is refused rather
 * than silently stored as something else.
 */
export const REVIEW_EXAM_TYPES = ['JAMB', 'WAEC', 'NECO', 'POST-UTME', 'Other'] as const;
export const REVIEW_TEXT_MIN = 20;
export const REVIEW_TEXT_MAX = 1200;

export type ReviewExamType = (typeof REVIEW_EXAM_TYPES)[number];

export type ReviewDraft = {
  rating: number;
  reviewText: string;
  examType: ReviewExamType | null;
};

export type ReviewDraftResult = { ok: true; value: ReviewDraft } | { ok: false; error: string };

/** Collapse whitespace and bound the stored text; never trust the client. */
export function cleanReviewText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, REVIEW_TEXT_MAX);
}

export function isReviewExamType(value: string): value is ReviewExamType {
  return (REVIEW_EXAM_TYPES as readonly string[]).includes(value);
}

/**
 * Validate one submission body. The caller still authenticates and checks
 * meaningful use; this only decides whether the values are acceptable and what
 * the exact refusal sentence is.
 */
export function parseReviewDraft(body: unknown): ReviewDraftResult {
  const source = (body ?? {}) as Record<string, unknown>;
  const rating = Number(source.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'Choose a rating from 1 to 5 stars.' };
  }

  const reviewText = cleanReviewText(source.reviewText ?? source.review_text);
  if (reviewText.length < REVIEW_TEXT_MIN) {
    return { ok: false, error: `Write at least ${REVIEW_TEXT_MIN} characters about your experience.` };
  }

  const rawExam = String(source.examType ?? source.exam_type ?? '')
    .trim()
    .toUpperCase();
  let examType: ReviewExamType | null = null;
  if (rawExam) {
    if (!isReviewExamType(rawExam)) {
      return { ok: false, error: 'Choose a valid exam type or leave it blank.' };
    }
    examType = rawExam;
  }

  return { ok: true, value: { rating, reviewText, examType } };
}
