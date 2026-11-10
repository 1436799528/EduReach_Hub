/** A bounded history summary: only submitted attempts with real scores are scored. */
export type DashboardCbtRecord = {
  status?: string | null;
  score?: number | null;
  mode?: string | null;
  selected_subjects?: string[] | null;
  subject_plan?: unknown;
  total_questions?: number | null;
  correct_answers?: number | null;
  submitted_at?: string | null;
};

export function isScoredSubmission(record: DashboardCbtRecord): boolean {
  return record.status === 'submitted' && typeof record.score === 'number' && Number.isFinite(record.score) && record.score >= 0 && record.score <= 100;
}

export function cbtModeLabel(mode?: string | null): string {
  return mode === 'practice' ? 'Practice' : mode === 'mock' ? 'Mock' : 'Mode unavailable';
}

/** Selection counts, not scores: a multi-subject paper contributes once per subject. */
export function submittedSubjectCounts(records: DashboardCbtRecord[]): Array<{ subject: string; count: number }> {
  const totals = new Map<string, { subject: string; count: number }>();
  for (const record of records) {
    if (record.status !== 'submitted' || !Array.isArray(record.selected_subjects)) continue;
    const seen = new Set<string>();
    for (const value of record.selected_subjects) {
      if (typeof value !== 'string') continue;
      const subject = value.trim();
      const key = subject.toLowerCase();
      if (!subject || seen.has(key)) continue;
      seen.add(key);
      const previous = totals.get(key);
      if (previous) previous.count += 1;
      else totals.set(key, { subject, count: 1 });
    }
  }
  return [...totals.values()].sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject));
}

export type SubjectProgress = {
  subject: string;
  attempts: number;
  questions: number;
  correct: number;
  average: number;
  latest: number | null;
  previous: number | null;
};

/**
 * A saved plan is derived from frozen question IDs, unlike selected_subjects.
 * Only a complete one-subject plan makes the paper score a subject score.
 * Multi-subject papers lack a persisted per-subject score and are excluded.
 */
export function singleSubjectProgress(records: DashboardCbtRecord[]): SubjectProgress[] {
  const grouped = new Map<string, SubjectProgress & { dated: Array<{ time: number; score: number }> }>();
  for (const record of records) {
    if (!isScoredSubmission(record) || !Array.isArray(record.subject_plan) || record.subject_plan.length !== 1) continue;
    const plan = record.subject_plan[0] as { subject?: unknown; questions?: unknown } | null;
    const subject = typeof plan?.subject === 'string' ? plan.subject.trim() : '';
    const total = record.total_questions;
    const correct = record.correct_answers;
    if (!subject || typeof total !== 'number' || !Number.isInteger(total) || total < 1 || plan?.questions !== total ||
        typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0 || correct > total ||
        Math.abs(Number(record.score) - correct / total * 100) > 0.011) continue;
    const key = subject.toLowerCase();
    const row = grouped.get(key) || { subject, attempts: 0, questions: 0, correct: 0, average: 0, latest: null, previous: null, dated: [] };
    row.attempts += 1;
    row.questions += total;
    row.correct += correct;
    const time = record.submitted_at ? Date.parse(record.submitted_at) : NaN;
    if (Number.isFinite(time)) row.dated.push({ time, score: Number(record.score) });
    grouped.set(key, row);
  }
  return [...grouped.values()].map(({ dated, ...row }) => {
    dated.sort((a, b) => b.time - a.time);
    const latestDistinct = dated.length > 0 && (dated.length === 1 || dated[0].time !== dated[1].time);
    const previousDistinct = latestDistinct && dated.length > 1 && (dated.length === 2 || dated[1].time !== dated[2].time);
    return { ...row, average: Math.round(row.correct / row.questions * 100), latest: latestDistinct ? Math.round(dated[0].score) : null, previous: previousDistinct ? Math.round(dated[1].score) : null };
  }).sort((a, b) => a.subject.localeCompare(b.subject));
}

/** A comparison is only useful when two subjects have a modest evidence base. */
export function practiceSuggestion(rows: SubjectProgress[]): SubjectProgress | null {
  const eligible = rows.filter(row => row.attempts >= 2 && row.questions >= 20).sort((a, b) => a.correct / a.questions - b.correct / b.questions);
  if (eligible.length < 2 || eligible[0].correct / eligible[0].questions === eligible[1].correct / eligible[1].questions) return null;
  return eligible[0];
}
