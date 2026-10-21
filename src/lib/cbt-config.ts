/**
 * Shared CBT configuration helpers - pure functions consumed by the setup
 * wizard and unit-testable without any UI import chain.
 */

export type CatalogExam = {
  id: string;
  title: string;
  exam_body: string;
  subject: string;
  description: string | null;
  duration_minutes: number | null;
  institution_id?: string | null;
  /** Present when the catalogue came from GET /api/cbt/exams (availability-aware). */
  question_count?: number;
  subject_count?: number;
  subjects?: Array<{ subject: string; questionCount: number }>;
};

export type SetupExamKey = 'jamb' | 'waec' | 'neco' | 'post-utme';

/** Minimum session length the product allows a student to choose. */
export const MIN_CHOSEN_MINUTES = 15;

/**
 * Could a student actually start a session from this bank?
 *
 * Only judges what the catalogue payload knows: when availability counts are
 * present (GET /api/cbt/exams), a startable bank holds at least the minimum
 * session size across at least one subject, and a JAMB bank must contain the
 * compulsory English pool. Without counts (legacy/local-preview catalogues)
 * the bank cannot be judged here and is treated as startable - the bank
 * payload loaded afterwards remains the final arbiter.
 */
export function isStartableBank(exam: CatalogExam, key: SetupExamKey, minQuestions = 5): boolean {
  if (typeof exam.question_count !== 'number') return true;
  if (exam.question_count < minQuestions) return false;
  const subjectEntries = exam.subjects ?? null;
  const subjectTotal = subjectEntries ? subjectEntries.filter((entry) => entry.questionCount > 0).length : exam.subject_count;
  if (typeof subjectTotal === 'number' && subjectTotal < 1) return false;
  if (key === 'jamb' && subjectEntries) {
    return subjectEntries.some((entry) => entry.questionCount > 0 && normalizeSubject(entry.subject) === 'english');
  }
  return true;
}

/** Deterministic catalogue order: deepest servable bank first, never "newest row wins". */
function compareCatalogExams(a: CatalogExam, b: CatalogExam): number {
  const byQuestions = (b.question_count ?? -1) - (a.question_count ?? -1);
  if (byQuestions !== 0) return byQuestions;
  const byTitle = String(a.title).localeCompare(String(b.title));
  if (byTitle !== 0) return byTitle;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * Resolve the concrete production exam behind a body-level setup page.
 *
 * Precedence: an explicit `?exam=<id>` deep link (the student/card chose that
 * bank; the setup page explains if it cannot be started), then the startable
 * bank with the deepest question pool for the body. Resolution must never
 * depend on catalogue row order: a newly created near-empty bank previously
 * hijacked the default JAMB route because the catalogue was newest-first and
 * the old "English pool" heuristic inspected `cbt_exams.subject`, which is
 * "Multiple subjects" for every multi-subject bank.
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
  const ranked = [...bodyMatches].sort(compareCatalogExams);
  return ranked.find((item) => isStartableBank(item, exam)) ?? ranked[0];
}

/** Allowed duration choices for a configured exam, always including its default. */
export function durationOptionsFor(defaultMinutes: number): number[] {
  const steps = [15, 30, 45, 60, 90, 120, 150, 180];
  const capped = steps.filter((value) => value >= MIN_CHOSEN_MINUTES && value <= defaultMinutes);
  if (!capped.includes(defaultMinutes)) capped.push(defaultMinutes);
  return Array.from(new Set(capped)).sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ *
 * CBT-2 - session modes, limits and configuration summaries.
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

/**
 * Canonical subject key for every comparison (selection, filters, coverage).
 *
 * Banks, static catalogues and course guides spell the same subject three
 * ways - "Use of English" / "English Language" / "English", and
 * "Literature-in-English" / "Literature in English". Comparing raw labels
 * made real bank subjects vanish from filtered lists, so punctuation and the
 * English aliases collapse to one key. Display names are never rewritten;
 * only comparisons use this. Mirrors the SQL canonicalisation in
 * `plan_cbt_paper` / `start_cbt_attempt_configured`.
 */
export function normalizeSubject(value: string): string {
  const key = String(value || '').trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  if (key === 'use of english' || key === 'english language' || key === 'english') return 'english';
  return key;
}

export function isEnglishSubject(value: string): boolean {
  return normalizeSubject(value) === 'english';
}

/**
 * Compulsory subjects, by exam body - product rule, enforced identically by
 * the wizard and (for JAMB) by `start_cbt_attempt_configured`. Use of
 * English is compulsory for JAMB UTME in both practice and mock mode. WAEC,
 * NECO and Post-UTME impose no compulsory subject in EduReach practice/mock
 * sessions; their official rules are not JAMB's and must not be copied over.
 * Returns canonical subject keys (see normalizeSubject).
 */
export function compulsorySubjectKeys(examBodyOrKey: string): string[] {
  const body = String(examBodyOrKey || '').trim().toUpperCase();
  if (body.includes('POST')) return [];
  if (body === 'JAMB' || body === 'UTME' || body.includes('JAMB')) return ['english'];
  return [];
}

/* ------------------------------------------------------------------ *
 * Paper standards and the rules shared by the wizard and the API.
 * ------------------------------------------------------------------ */

/** The paper a national examination sets, used to derive a fair pace. */
export type ExamPaperStandard = { questions: number; minutes: number };

/**
 * JAMB UTME: 180 objective questions in 120 minutes, made up of Use of English
 * 60 plus 40 from each of the three other subjects.
 *
 * The numbers belong to the examination, not to a student's session: practice
 * keeps the same pace over a shorter paper, and a mock is the full paper.
 * `cbt_exams.mock_question_count` / `mock_subject_quota` carry the same
 * specification in the database, which is authoritative at start time; this
 * constant is the fallback when a catalogue does not report it.
 */
export const JAMB_PAPER_STANDARD: ExamPaperStandard & { subjectQuota: Record<string, number> } = {
  questions: 180,
  minutes: 120,
  subjectQuota: { english: 60, other: 40 },
};

/**
 * A mock paper as reported by the bank, or as the examination defines it.
 * `subjectQuota` maps canonical subject keys to required questions; the key
 * "other" applies to subjects without an explicit entry.
 */
export type MockPaper = { questions: number; subjectQuota: Record<string, number> | null };

export type MockPaperMeta = {
  questionCount: number | null;
  subjectQuota: Record<string, number> | null;
};

export function paperStandardFor(examBodyOrKey: string): ExamPaperStandard | null {
  return compulsorySubjectKeys(examBodyOrKey).includes('english') ? JAMB_PAPER_STANDARD : null;
}

/**
 * The paper a mock must reproduce.
 *
 * A value reported by the bank wins: an exam row can change its mock size
 * without a code release. When it reports none (WAEC, NECO and Post-UTME have
 * no fixed cross-subject paper), a JAMB bank falls back to the national
 * standard and any other body has no fixed paper at all.
 */
export function mockPaperFor(examBodyOrKey: string, meta?: MockPaperMeta | null): MockPaper | null {
  // `undefined` means no bank payload was loaded, so the examination default
  // applies. `null` (or a meta object with no count) means the bank reported
  // that it has no fixed paper, which must not be overridden by that default.
  if (meta !== undefined) {
    const questions = Math.floor(Number(meta?.questionCount) || 0);
    if (questions <= 0) return null;
    const quota = meta?.subjectQuota && Object.keys(meta.subjectQuota).length ? meta.subjectQuota : null;
    return { questions, subjectQuota: quota };
  }
  const standard = paperStandardFor(examBodyOrKey);
  return standard ? { questions: standard.questions, subjectQuota: JAMB_PAPER_STANDARD.subjectQuota } : null;
}

function quotaForSubject(subject: string, quota: Record<string, number>): number | null {
  const key = normalizeSubject(subject);
  const explicit = Number(quota[key]);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const fallback = Number(quota.other);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
}

/**
 * Why the selected subjects cannot fill this mock paper, or null when they
 * can. A short paper under the mock's name is not a mock: the database
 * refuses it, so the wizard names the subject that is short instead.
 */
export function mockPaperError(
  subjects: string[],
  availability: Array<{ subject: string; questionCount: number }>,
  paper: MockPaper | null,
): string | null {
  if (!paper || !subjects.length) return null;
  const shortfalls: string[] = [];
  let total = 0;
  for (const subject of subjects) {
    const key = normalizeSubject(subject);
    const entry = availability.find((item) => normalizeSubject(item.subject) === key);
    const available = entry?.questionCount ?? 0;
    total += available;
    const required = paper.subjectQuota ? quotaForSubject(subject, paper.subjectQuota) : null;
    if (required !== null && available < required) {
      shortfalls.push(`${entry?.subject ?? subject} needs ${required} but the bank has ${available}`);
    }
  }
  if (shortfalls.length) {
    return `This bank cannot fill a ${paper.questions}-question mock paper: ${shortfalls.join('; ')}. Choose practice for these subjects, or a bank with deeper coverage.`;
  }
  if (total < paper.questions) {
    return `A ${paper.questions}-question mock paper needs ${paper.questions} questions from the selected subjects; this bank has ${total}. Choose practice, or a bank with deeper coverage.`;
  }
  return null;
}

/**
 * How long a paper of `questionCount` questions should take.
 *
 * With a national standard (JAMB) the chosen count keeps the examination's own
 * pace: 20 questions take one ninth of 120 minutes. Without one (WAEC, NECO,
 * Post-UTME), the configured bank duration is spread across the largest paper a
 * session may hold, which is the only denominator the product defines. The
 * result never leaves the server limits, so it cannot be zero, negative or
 * longer than a session may run.
 */
export function durationForQuestionCount(
  questionCount: number,
  options: { standard?: ExamPaperStandard | null; defaultMinutes?: number | null; limits?: CbtLimits },
): number {
  const limits = options.limits ?? DEFAULT_CBT_LIMITS;
  const count = Math.max(0, Math.floor(Number(questionCount) || 0));
  const standard = options.standard ?? null;
  const questions = standard && standard.questions > 0 ? standard.questions : Math.max(1, limits.maxQuestions);
  const minutes = standard && standard.minutes > 0
    ? standard.minutes
    : Math.max(limits.minMinutes, Math.round(Number(options.defaultMinutes) || limits.maxMinutes));
  const proportional = Math.ceil((count / questions) * minutes);
  return Math.max(limits.minMinutes, Math.min(limits.maxMinutes, proportional));
}

/** The time a mock runs for: the exam's configured duration, or 120 minutes. */
export function mockDurationMinutes(defaultMinutes?: number | null): number {
  const value = Math.round(Number(defaultMinutes));
  return Number.isFinite(value) && value > 0 ? value : 120;
}

/** How many subjects one session may include for this examination. */
export function subjectLimitFor(examBodyOrKey: string, limits: CbtLimits = DEFAULT_CBT_LIMITS): number {
  const body = String(examBodyOrKey || '').trim().toUpperCase();
  if (body === 'JAMB' || body === 'UTME' || body.includes('JAMB')) return Math.min(4, limits.maxSubjects);
  if (body === 'WAEC' || body === 'NECO' || body.includes('WAEC') || body.includes('NECO')) return Math.min(9, limits.maxSubjects);
  return limits.maxSubjects;
}

/**
 * The one rule a mock combination must satisfy before the server will create
 * it. JAMB mocks require exactly four subjects including English; WAEC/NECO
 * mocks require a full nine-subject combination. Practice mode remains flexible.
 * Returns a message a student can act on, or null when acceptable.
 */
export function mockCombinationError(subjects: string[], examBodyOrKey: string): string | null {
  const body = String(examBodyOrKey || '').trim().toUpperCase();
  const unique = new Set(subjects.map(normalizeSubject));
  if (body === 'JAMB' || body === 'UTME' || body.includes('JAMB')) {
    if (!unique.has('english')) return 'Use of English is compulsory for a JAMB mock. Add it before starting.';
    if (unique.size !== 4) {
      const missing = 4 - unique.size;
      return `A JAMB mock requires exactly four subjects: Use of English plus three others. Add ${missing} more subject${missing === 1 ? '' : 's'}.`;
    }
    return null;
  }
  if (body.includes('WAEC') || body.includes('NECO')) {
    if (unique.size !== 9) return `A ${body.includes('WAEC') ? 'WAEC' : 'NECO'} mock requires nine selected subjects. Select ${Math.max(0, 9 - unique.size)} more subject(s) before starting.`;
  }
  if (body.includes('POST') && unique.size < 4) {
    return 'A Post-UTME mock requires at least four subjects. Use practice mode for a shorter session.';
  }
  return null;
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
  subjectQuota?: Record<string, number> | null,
): CbtPlanEntry[] {
  const pool = selections
    .filter((entry) => entry.questionCount > 0)
    .map((entry) => ({ subject: entry.subject, available: entry.questionCount, quota: 0 }));
  if (!pool.length) return [];

  const capacity = pool.reduce((sum, entry) => sum + entry.available, 0);
  const target = Math.min(Math.max(Math.floor(totalQuestions) || 0, 0), capacity);
  let assigned = 0;

  // A paper with a subject quota (a JAMB mock) is shown exactly as it will be
  // planned: required questions first, then the remainder by capacity.
  if (subjectQuota && Object.keys(subjectQuota).length) {
    for (const entry of pool) {
      const required = quotaForSubject(entry.subject, subjectQuota);
      if (required !== null) entry.quota = Math.min(required, entry.available, target);
      assigned += entry.quota;
    }
    if (assigned > target) {
      for (let index = pool.length - 1; index >= 0 && assigned > target; index -= 1) {
        const trim = Math.min(pool[index].quota, assigned - target);
        pool[index].quota -= trim;
        assigned -= trim;
      }
    }
  }

  if (assigned === 0 && target >= pool.length) {
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
  compulsoryKeys: string[] = [],
): string | null {
  if (!config.subjects.length) return 'Choose at least one subject to practise.';
  if (config.subjects.length > limits.maxSubjects) return `Choose no more than ${limits.maxSubjects} subjects.`;
  const missingCompulsory = compulsoryKeys.filter(
    (key) => !config.subjects.some((subject) => normalizeSubject(subject) === key),
  );
  if (missingCompulsory.length) {
    const names = missingCompulsory.map(
      (key) => availability.find((entry) => normalizeSubject(entry.subject) === key)?.subject ?? 'Use of English',
    );
    return `${names.join(', ')} is compulsory for this examination. Add it before starting.`;
  }
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
  // A mock's size is the bank's paper, and its coverage is checked against the
  // paper spec; only a practice session is sized by the student.
  if (config.mode === 'practice' && available < config.questionCount) {
    return `This bank has ${available} question${available === 1 ? '' : 's'} for the subjects you chose. Choose fewer questions.`;
  }
  return null;
}
