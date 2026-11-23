/**
 * Validation for the homepage engagement surfaces: the editorial review
 * record, FAQ categories and FAQ questions.
 *
 * The admin console and the API share these rules so a field the form accepts
 * can never be refused by the server, and a value the renderer would have to
 * strip is refused at the boundary instead. Nothing here authenticates: the
 * caller must already have checked the capability.
 */

import { REVIEW_TEXT_MIN, cleanReviewText, isReviewExamType } from './reviewPolicy';

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'hidden'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_DISPLAY_NAME_MIN = 2;
export const REVIEW_DISPLAY_NAME_MAX = 60;
export const REVIEW_DESCRIPTION_MAX = 120;
export const REVIEW_ORDER_MAX = 10000;

export type AdminReviewInput = {
  displayName: string;
  profileImage: string | null;
  studentDescription: string | null;
  reviewText: string;
  rating: number;
  examType: string | null;
  status: ReviewStatus;
  isFeatured: boolean;
  isPlaceholder: boolean;
  displayOrder: number;
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function cleanLine(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** An avatar is an HTTPS URL returned by the upload endpoint, or nothing. */
export function cleanImageUrl(value: unknown): string | null {
  const raw = cleanLine(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parseAdminReviewDraft(body: unknown): ParseResult<AdminReviewInput> {
  const source = (body ?? {}) as Record<string, unknown>;

  const displayName = cleanLine(source.displayName ?? source.display_name).slice(0, REVIEW_DISPLAY_NAME_MAX);
  if (displayName.length < REVIEW_DISPLAY_NAME_MIN) {
    return { ok: false, error: 'Add the student name that should appear on the review (2–60 characters).' };
  }

  const reviewText = cleanReviewText(source.reviewText ?? source.review_text);
  if (reviewText.length < REVIEW_TEXT_MIN) {
    return { ok: false, error: `Write at least ${REVIEW_TEXT_MIN} characters in the review.` };
  }

  const rating = Number(source.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'Choose a rating from 1 to 5 stars.' };
  }

  const rawImage = source.profileImage ?? source.profile_image;
  const profileImage = cleanImageUrl(rawImage);
  if (cleanLine(rawImage) && !profileImage) {
    return { ok: false, error: 'The profile picture must be an uploaded image with an HTTPS address.' };
  }

  const description = cleanLine(source.studentDescription ?? source.student_description).slice(
    0,
    REVIEW_DESCRIPTION_MAX,
  );
  if (description && description.length < 2) {
    return { ok: false, error: 'The description is too short; leave it blank or write a few words.' };
  }

  const status = String(source.status ?? 'approved').toLowerCase();
  if (!(REVIEW_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: 'Choose publish, hide, pending or rejected for this review.' };
  }

  const rawExam = cleanLine(source.examType ?? source.exam_type).toUpperCase();
  if (rawExam && !isReviewExamType(rawExam)) {
    return { ok: false, error: 'Choose a valid exam type or leave it blank.' };
  }

  const order = Number(source.displayOrder ?? source.display_order ?? 0);
  if (!Number.isInteger(order) || order < 0 || order > REVIEW_ORDER_MAX) {
    return { ok: false, error: `Display order must be a whole number from 0 to ${REVIEW_ORDER_MAX}.` };
  }

  return {
    ok: true,
    value: {
      displayName,
      profileImage,
      studentDescription: description || null,
      reviewText,
      rating,
      examType: rawExam || null,
      status: status as ReviewStatus,
      isFeatured: readBoolean(source.isFeatured ?? source.is_featured, false),
      isPlaceholder: readBoolean(source.isPlaceholder ?? source.is_placeholder, false),
      displayOrder: order,
    },
  };
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const FAQ_LABEL_MIN = 2;
export const FAQ_LABEL_MAX = 60;
export const FAQ_DESCRIPTION_MAX = 200;
export const FAQ_QUESTION_MIN = 8;
export const FAQ_QUESTION_MAX = 200;
export const FAQ_ANSWER_MIN = 20;
export const FAQ_ANSWER_MAX = 4000;
export const FAQ_ORDER_MAX = 10000;

export type FaqCategoryInput = {
  label: string;
  description: string;
  isPublished: boolean;
  displayOrder: number;
};

export type FaqItemInput = {
  categoryId: string;
  question: string;
  answer: string;
  isPublished: boolean;
  displayOrder: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Turn an administrator's category name into a stable, readable key. */
export function faqSlug(label: string): string {
  const base = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return base.length >= 2 ? base : 'faq';
}

export function parseFaqCategoryDraft(body: unknown): ParseResult<FaqCategoryInput> {
  const source = (body ?? {}) as Record<string, unknown>;
  const label = cleanLine(source.label).slice(0, FAQ_LABEL_MAX);
  if (label.length < FAQ_LABEL_MIN) {
    return { ok: false, error: 'Give the category a name of 2–60 characters.' };
  }
  const description = cleanLine(source.description).slice(0, FAQ_DESCRIPTION_MAX);
  const order = Number(source.displayOrder ?? source.display_order ?? 0);
  if (!Number.isInteger(order) || order < 0 || order > 1000) {
    return { ok: false, error: 'Category order must be a whole number from 0 to 1000.' };
  }
  return {
    ok: true,
    value: {
      label,
      description,
      isPublished: readBoolean(source.isPublished ?? source.is_published, true),
      displayOrder: order,
    },
  };
}

export function parseFaqItemDraft(body: unknown): ParseResult<FaqItemInput> {
  const source = (body ?? {}) as Record<string, unknown>;
  const categoryId = cleanLine(source.categoryId ?? source.category_id);
  if (!isUuid(categoryId)) return { ok: false, error: 'Choose the category this question belongs to.' };

  const question = cleanLine(source.question).slice(0, FAQ_QUESTION_MAX);
  if (question.length < FAQ_QUESTION_MIN) {
    return { ok: false, error: 'Write a question of 8–200 characters.' };
  }

  const answer = String(source.answer ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FAQ_ANSWER_MAX);
  if (answer.length < FAQ_ANSWER_MIN) {
    return { ok: false, error: `Write an answer of at least ${FAQ_ANSWER_MIN} characters.` };
  }

  const order = Number(source.displayOrder ?? source.display_order ?? 0);
  if (!Number.isInteger(order) || order < 0 || order > FAQ_ORDER_MAX) {
    return { ok: false, error: `Question order must be a whole number from 0 to ${FAQ_ORDER_MAX}.` };
  }

  return {
    ok: true,
    value: {
      categoryId,
      question,
      answer,
      isPublished: readBoolean(source.isPublished ?? source.is_published, true),
      displayOrder: order,
    },
  };
}

export function parseReorderDraft(body: unknown, idKey: 'itemIds' | 'categoryIds'): ParseResult<string[]> {
  const source = (body ?? {}) as Record<string, unknown>;
  const ids = source[idKey];
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every(isUuid)) {
    return { ok: false, error: 'Send the ordered list of items to reorder.' };
  }
  return { ok: true, value: ids as string[] };
}
