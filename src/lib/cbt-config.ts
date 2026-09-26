/**
 * Shared CBT configuration helpers — pure functions consumed by the setup
 * wizard and unit-testable without any UI import chain.
 */

export type CatalogExam = {
  id: string;
  title: string;
  exam_body: string;
  subject: string;
  description: string | null;
  duration_minutes: number;
};

export type SetupExamKey = 'jamb' | 'waec' | 'neco' | 'post-utme';

/** Minimum session length the product allows a student to choose. */
export const MIN_CHOSEN_MINUTES = 15;

/**
 * Resolve the concrete production exam behind a body-level setup page.
 *
 * Precedence: an explicit `?exam=<id>` deep link (used by the question-bank
 * and past-question cards), then the active exam whose body/title best matches
 * the configured body. For JAMB the compulsory Use of English pool is
 * preferred, so starting JAMB with English selected retrieves the approved
 * English question set instead of an arbitrary JAMB bank.
 */
export function resolveSetupExam(exams: CatalogExam[], exam: SetupExamKey, requestedId: string | null): CatalogExam | null {
  if (requestedId) {
    const exact = exams.find((item) => item.id === requestedId);
    if (exact) return exact;
  }
  const bodyMatches = exams.filter((item) => {
    const value = `${item.exam_body} ${item.title}`.toLowerCase();
    if (exam === 'post-utme') return value.includes('post-utme') || value.includes('postutme');
    return value.includes(exam);
  });
  if (!bodyMatches.length) return null;
  if (exam === 'jamb') {
    const english = bodyMatches.find((item) => String(item.subject || '').toLowerCase().includes('english'));
    if (english) return english;
  }
  return bodyMatches[0];
}

/** Allowed duration choices for a configured exam, always including its default. */
export function durationOptionsFor(defaultMinutes: number): number[] {
  const steps = [15, 30, 45, 60, 90, 120, 150, 180];
  const capped = steps.filter((value) => value >= MIN_CHOSEN_MINUTES && value <= defaultMinutes);
  if (!capped.includes(defaultMinutes)) capped.push(defaultMinutes);
  return Array.from(new Set(capped)).sort((a, b) => a - b);
}
