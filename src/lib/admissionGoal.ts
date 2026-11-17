/**
 * Admission-goal arithmetic.
 *
 * The hard rule this module exists to enforce: an EduReach CBT score is a
 * percentage of the questions a student answered in a practice paper. It is not
 * a JAMB UTME score out of 400, and it is not evidence that anybody will be
 * admitted. So this module never:
 *
 *   * multiplies or rescales a practice percentage into a UTME score;
 *   * turns a cut-off into a probability, a chance or an eligibility claim;
 *   * compares a 0-100 aggregate with a 0-400 UTME score.
 *
 * What it does compute is honest and checkable: which practice attempts actually
 * practise the subjects the institution requires, the student's average and best
 * accuracy on those, and the distance between that accuracy and a target the
 * student set for themselves — in percentage points, on the same scale.
 */

export type EntryMode = 'UTME' | 'DIRECT_ENTRY' | 'JUPEB' | 'IJMB' | 'PRE_DEGREE' | 'DIPLOMA' | 'ND' | 'HND' | 'TRANSFER' | 'OTHER';
export type TargetExam = 'JAMB_UTME' | 'WAEC' | 'NECO' | 'POST_UTME' | 'OTHER';

export interface RequirementInput {
  programmeName?: string | null;
  entryMode?: EntryMode | null;
  utmeSubjects?: string[] | null;
  oLevelRequirements?: Record<string, unknown> | null;
  minimumUtmeScore?: number | null;
  minimumUtmeScale?: number | null;
}

export interface AttemptInput {
  attemptId: string;
  examSubject?: string | null;
  examBody?: string | null;
  examTitle?: string | null;
  /** 0-100. A practice percentage, never a UTME score. */
  scorePercent?: number | null;
  submittedAt?: string | null;
}

export type MatchStatus = 'matched' | 'subject_mismatch' | 'exam_mismatch' | 'requirements_unavailable' | 'excluded';

export interface MatchResult {
  status: MatchStatus;
  reason: string;
  matchedSubjects: string[];
  missingSubjects: string[];
}

const SUBJECT_ALIASES: Record<string, string> = {
  english: 'english language',
  'use of english': 'english language',
  'english language': 'english language',
  mathematics: 'mathematics',
  maths: 'mathematics',
  'further mathematics': 'further mathematics',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  economics: 'economics',
  government: 'government',
  'literature in english': 'literature in english',
  literature: 'literature in english',
  geography: 'geography',
  'agricultural science': 'agricultural science',
  commerce: 'commerce',
  accounting: 'accounting',
  'christian religious studies': 'christian religious studies',
  crs: 'christian religious studies',
  'islamic studies': 'islamic studies',
};

export function normalizeSubject(subject: string): string {
  const key = subject.toLowerCase().replace(/\s+/g, ' ').trim();
  return SUBJECT_ALIASES[key] ?? key;
}

/**
 * Does this practice attempt practise what the institution asks for?
 *
 * A requirement is only usable when the institution published subject
 * combinations. Without them the attempt is `requirements_unavailable` — it is
 * kept, but it must not count towards the goal.
 */
export function matchAttemptToRequirement(attempt: AttemptInput, requirement: RequirementInput | null): MatchResult {
  if (!requirement || !(requirement.utmeSubjects ?? []).length) {
    return {
      status: 'requirements_unavailable',
      reason: 'The institution has not published verified subject requirements for this programme yet.',
      matchedSubjects: [],
      missingSubjects: [],
    };
  }

  const required = [...new Set((requirement.utmeSubjects ?? []).map(normalizeSubject))];
  const workbook = new Set<string>();
  if (attempt.examSubject) workbook.add(normalizeSubject(attempt.examSubject));
  const body = normalizeSubject(String(attempt.examBody ?? ''));
  if (body) workbook.add(body);

  // A practice paper is a subject drill. It matches when the paper's subject is
  // one the institution requires; a multi-subject simulation is not claimed.
  const subject = attempt.examSubject ? normalizeSubject(attempt.examSubject) : '';
  if (!subject) {
    return {
      status: 'excluded',
      reason: 'This attempt has no subject, so it cannot be matched to a requirement.',
      matchedSubjects: [],
      missingSubjects: required,
    };
  }

  const requiredSet = new Set(required);
  if (requiredSet.has(subject)) {
    return { status: 'matched', reason: `Practises ${subject}, which this programme requires.`, matchedSubjects: [subject], missingSubjects: required.filter((item) => item !== subject) };
  }

  const missing = required.filter((item) => item !== subject);
  return {
    status: 'subject_mismatch',
    reason: `${subject} is not one of the subjects this programme requires.`,
    matchedSubjects: [],
    missingSubjects: missing,
  };
}

export interface GoalProgress {
  /** Attempts that count towards the goal (match_status = matched). */
  countedAttempts: number;
  /** Average and best accuracy, 0-100 percentages. Null when nothing counts. */
  averagePercent: number | null;
  bestPercent: number | null;
  /** Distance to the student's own target, in percentage points. Null without a target. */
  gapToTargetPoints: number | null;
  /** Mirrors the practice scale; never a UTME scale. */
  scoreScale: { min: 0; max: 100 };
  /** Statements that must accompany any rendering of the numbers above. */
  disclaimers: string[];
}

export function computeGoalProgress(
  attempts: Array<{ matchStatus: MatchStatus; scorePercent: number | null | undefined }>,
  targetPercent: number | null | undefined,
): GoalProgress {
  const scores = attempts
    .filter((attempt) => attempt.matchStatus === 'matched')
    .map((attempt) => attempt.scorePercent)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  const average = scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : null;
  const best = scores.length ? Math.max(...scores) : null;
  const target = typeof targetPercent === 'number' && Number.isFinite(targetPercent) ? targetPercent : null;

  return {
    countedAttempts: scores.length,
    averagePercent: average,
    bestPercent: best,
    gapToTargetPoints: average !== null && target !== null ? Math.round((target - average) * 10) / 10 : null,
    scoreScale: { min: 0, max: 100 },
    disclaimers: [
      'This is your accuracy on EduReach practice papers, out of 100. It is not a JAMB score out of 400.',
      'Nothing here predicts admission. Cut-offs and eligibility are decided by the institution and by JAMB.',
      'Only attempts whose subject matches a verified requirement are counted.',
    ],
  };
}

/**
 * Human label for a benchmark, with its own scale attached. A caller that
 * renders this cannot accidentally print "180/100" or compare a 400-scale score
 * with a 100-scale aggregate.
 */
export function describeBenchmark(benchmark: {
  benchmarkType: string;
  benchmarkLabel?: string | null;
  benchmarkValue: number | string;
  scoreScaleMin?: number | string | null;
  scoreScaleMax: number | string;
  categoryKey?: string | null;
  stateCategory?: string | null;
  admissionSession?: string | null;
}): string {
  const value = Number(benchmark.benchmarkValue);
  const max = Number(benchmark.scoreScaleMax);
  const min = Number(benchmark.scoreScaleMin ?? 0);
  const category = benchmark.categoryKey && benchmark.categoryKey !== 'general'
    ? ` · ${benchmark.categoryKey}${benchmark.stateCategory ? ` (${benchmark.stateCategory})` : ''}`
    : '';
  const session = benchmark.admissionSession ? ` · ${benchmark.admissionSession}` : '';
  return `${benchmark.benchmarkLabel ?? benchmark.benchmarkType}: ${value} of ${min}-${max}${category}${session}`;
}
