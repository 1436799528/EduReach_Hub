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

/* ------------------------------------------------------------------ *
 * CBT-2 — session modes, limits and configuration summaries.
 *
 * The student configures a practice session; the server validates it. These
 * helpers exist so the wizard can show the same numbers the server enforces and
 * so the summary a student confirms is built from one shared implementation.
 * ------------------------------------------------------------------ */

export type CbtMode = 'practice' | 'mock';

export type CbtLimits = {
  minQuestions: number;
  maxQuestions: number;
  minMinutes: number;
  maxMinutes: number;
  maxSubjects: number;
};

/** Mirrors `public.cbt_limits()`; replaced by the server value when it loads. */
export const DEFAULT_CBT_LIMITS: CbtLimits = {
  minQuestions: 5,
  maxQuestions: 100,
  minMinutes: 5,
  maxMinutes: 240,
  maxSubjects: 6,
};

export type CbtSessionConfig = {
  mode: CbtMode;
  subjects: string[];
  questionCount: number;
  durationMinutes: number;
};

export type CbtPlanEntry = { subject: string; questions: number; first: number; last: number };

/** Subject names differ only by case/whitespace edge cases; compare them canonically. */
export function normalizeSubject(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Question-count choices that the bank can actually serve.
 * A bank smaller than the smallest preset offers what it has, so a student is
 * never shown a choice that cannot be delivered.
 */
export function questionCountOptions(bankTotal: number, limits: CbtLimits = DEFAULT_CBT_LIMITS): number[] {
  const available = Math.max(0, Math.floor(bankTotal));
  const presets = [10, 20, 30, 40, 50, 60, 80, 100];
  const capped = [limits.maxQuestions, available, bankTotal].reduce((lowest, value) => Math.min(lowest, Math.max(0, Math.floor(value))), Number.POSITIVE_INFINITY);
  const usable = presets.filter((value) => value >= limits.minQuestions && value <= capped);
  if (available >= limits.minQuestions && !usable.includes(available) && available <= limits.maxQuestions) usable.push(available);
  return Array.from(new Set(usable)).sort((a, b) => a - b);
}

/** Duration choices for a practice session, never longer than the server allows. */
export function practiceDurationOptions(defaultMinutes: number, limits: CbtLimits = DEFAULT_CBT_LIMITS): number[] {
  const presets = [15, 30, 45, 60, 90, 120, 180];
  const capped = Math.min(limits.maxMinutes, Math.max(limits.minMinutes, defaultMinutes || 120));
  const usable = presets.filter((value) => value >= limits.minMinutes && value <= capped);
  if (!usable.includes(capped)) usable.push(capped);
  return Array.from(new Set(usable)).sort((a, b) => a - b);
}

/**
 * The plan the student is about to start, computed the same way for display as
 * the server computes the real one (proportional, capacity-aware, in the order
 * the student chose). The summary is a preview: the attempt stores the server's
 * own plan, and the two are compared before anything is submitted.
 */
export function previewPlan(
  selections: Array<{ subject: string; questionCount: number }>,
  totalQuestions: number,
): CbtPlanEntry[] {
  const pool = selections
    .filter((entry) => entry.questionCount > 0)
    .map((entry) => ({ subject: entry.subject, available: entry.questionCount, quota: 0 }));
  if (!pool.length) return [];

  const capacity = pool.reduce((sum, entry) => sum + entry.available, 0);
  const target = Math.min(Math.max(Math.floor(totalQuestions) || 0, 0), capacity);
  let assigned = 0;

  if (target >= pool.length) {
    pool.forEach((entry) => { entry.quota = 1; assigned += 1; });
  }
  while (assigned < target) {
    let best: (typeof pool)[number] | null = null;
    for (const entry of pool) {
      if (entry.quota >= entry.available) continue;
      if (!best || entry.quota / entry.available < best.quota / best.available) best = entry;
    }
    if (!best) break;
    best.quota += 1;
    assigned += 1;
  }

  let cursor = 1;
  return pool.map((entry) => {
    const first = cursor;
    cursor += entry.quota;
    return { subject: entry.subject, questions: entry.quota, first, last: cursor - 1 };
  });
}

/** What the student is asked to confirm before the timer starts. */
export function describeSession(config: CbtSessionConfig, plan: CbtPlanEntry[]): string[] {
  const lines: string[] = [];
  lines.push(config.mode === 'mock' ? 'Mode: Mock examination' : 'Mode: Practice');
  lines.push(`Subjects: ${config.subjects.join(', ') || 'None selected'}`);
  lines.push(`Questions: ${config.questionCount}`);
  lines.push(`Time: ${config.durationMinutes} minutes`);
  plan.filter((entry) => entry.questions > 0).forEach((entry) => {
    const range = entry.first === entry.last ? `Q${entry.first}` : `Q${entry.first}–Q${entry.last}`;
    lines.push(`${entry.subject}: ${entry.questions} question${entry.questions === 1 ? '' : 's'} (${range})`);
  });
  return lines;
}

/** Validate a configuration before it is sent, with a message a student can act on. */
export function validateSession(
  config: CbtSessionConfig,
  availability: Array<{ subject: string; questionCount: number }>,
  limits: CbtLimits = DEFAULT_CBT_LIMITS,
): string | null {
  if (!config.subjects.length) return 'Choose at least one subject to practise.';
  if (config.subjects.length > limits.maxSubjects) return `Choose no more than ${limits.maxSubjects} subjects.`;
  if (config.mode === 'practice') {
    if (!Number.isFinite(config.questionCount) || config.questionCount < limits.minQuestions) {
      return `Choose at least ${limits.minQuestions} questions.`;
    }
    if (config.questionCount > limits.maxQuestions) return `Choose no more than ${limits.maxQuestions} questions.`;
    if (!Number.isFinite(config.durationMinutes) || config.durationMinutes < limits.minMinutes || config.durationMinutes > limits.maxMinutes) {
      return `Choose a duration between ${limits.minMinutes} and ${limits.maxMinutes} minutes.`;
    }
  }
  const uncovered = config.subjects.filter((subject) => !availability.some(
    (entry) => normalizeSubject(entry.subject) === normalizeSubject(subject) && entry.questionCount > 0,
  ));
  if (uncovered.length) return `No questions are available for: ${uncovered.join(', ')}. Remove them or choose another bank.`;
  const available = availability
    .filter((entry) => config.subjects.some((subject) => normalizeSubject(subject) === normalizeSubject(entry.subject)))
    .reduce((sum, entry) => sum + entry.questionCount, 0);
  if (available < (config.mode === 'mock' ? Math.min(limits.minQuestions, available) : config.questionCount)) {
    return `This bank has ${available} question${available === 1 ? '' : 's'} for the subjects you chose. Choose fewer questions.`;
  }
  return null;
}
