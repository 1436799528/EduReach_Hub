/**
 * UI-5 — the student's performance, in the terms the dashboard is allowed to
 * claim.
 *
 * The dashboard used to hide its evidence inside the "My CBT" tab: the
 * Overview answered "what needs doing" but never "how am I doing". This module
 * derives the second answer from the same bounded attempt sample the rest of
 * the page uses, and it refuses to overstate it:
 *
 *   - only scored submissions count (see `isScoredSubmission`);
 *   - a subject figure needs a saved single-subject question plan, so a
 *     multi-subject paper cannot silently become a subject score;
 *   - "improved" means the latest score is higher than the previous scored
 *     paper, not that a trend line looks nice;
 *   - no score, no percentage. A missing figure is `null`, never 0%.
 *
 * Nothing here invents a target, a grade or a weakness diagnosis. The copy the
 * dashboard renders from these values says "average across this sample", and
 * the recommendation is a next action, not a verdict.
 */

import {
  isScoredSubmission,
  practiceSuggestion,
  singleSubjectProgress,
  type DashboardCbtRecord,
  type SubjectProgress,
} from './dashboardCbtStats';

export type AnalyticsRecord = DashboardCbtRecord & {
  id?: string;
  subject?: string | null;
  created_at?: string | null;
};

export type TrendPoint = {
  id?: string;
  score: number;
  at: number;
  label: string;
};

export type DistributionBucket = {
  id: string;
  label: string;
  min: number;
  max: number;
  count: number;
};

export type LatestResult = {
  id?: string;
  subject: string;
  score: number;
  at: number;
  previousScore: number | null;
  /** Percentage points, not percent: +12 means twelve points. */
  change: number | null;
};

export type SubjectBand = 'strong' | 'building' | 'needs-practice';

export type SubjectPerformance = SubjectProgress & {
  change: number | null;
  band: SubjectBand;
};

export type PerformanceHighlights = {
  strengths: SubjectPerformance[];
  needsPractice: SubjectPerformance[];
};

export type LearningRecommendation = {
  title: string;
  detail: string;
  href: string;
  cta: string;
};

function recordTime(record: AnalyticsRecord): number {
  const value = record.submitted_at || record.created_at;
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : 0;
}

function recordScore(record: AnalyticsRecord): number {
  return Math.round(Number(record.score));
}

/** Scored attempts, oldest first, so every series shares one ordering. */
export function orderedScoredRecords(records: AnalyticsRecord[]): AnalyticsRecord[] {
  return records
    .filter(isScoredSubmission)
    .slice()
    .sort((a, b) => {
      const timeDifference = recordTime(a) - recordTime(b);
      if (timeDifference !== 0) return timeDifference;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
}

/** A short, deterministic date label. UTC keeps the label stable in tests. */
export function shortDateLabel(at: number): string {
  if (!Number.isFinite(at) || at <= 0) return '—';
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(at));
}

export function subjectLabel(record: AnalyticsRecord): string {
  const direct = typeof record.subject === 'string' ? record.subject.trim() : '';
  if (direct) return direct;
  const selected = Array.isArray(record.selected_subjects)
    ? record.selected_subjects.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  if (selected.length) return selected.join(', ');
  return 'CBT practice';
}

/**
 * The most recent scored papers, oldest → newest. `limit` keeps the chart
 * readable on a phone; the empty value is the honest "no evidence yet".
 */
export function scoreTrend(records: AnalyticsRecord[], limit = 8): TrendPoint[] {
  const ordered = orderedScoredRecords(records).slice(-Math.max(1, limit));
  return ordered.map((record) => {
    const at = recordTime(record);
    return { id: record.id, score: recordScore(record), at, label: shortDateLabel(at) };
  });
}

export function trendSummary(points: TrendPoint[]): { direction: 'up' | 'down' | 'flat'; change: number } | null {
  if (points.length < 2) return null;
  const change = points[points.length - 1].score - points[0].score;
  return { direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat', change };
}

/** Fixed buckets: a score of 40 belongs to 40–49, never to 30–39. */
export const SCORE_BUCKETS: ReadonlyArray<{ id: string; label: string; min: number; max: number }> = [
  { id: 'below-40', label: 'Below 40', min: 0, max: 39 },
  { id: '40-49', label: '40–49', min: 40, max: 49 },
  { id: '50-59', label: '50–59', min: 50, max: 59 },
  { id: '60-69', label: '60–69', min: 60, max: 69 },
  { id: '70-79', label: '70–79', min: 70, max: 79 },
  { id: '80-89', label: '80–89', min: 80, max: 89 },
  { id: '90-100', label: '90–100', min: 90, max: 100 },
];

export function scoreDistribution(records: AnalyticsRecord[]): DistributionBucket[] {
  const buckets = SCORE_BUCKETS.map((bucket) => ({ ...bucket, count: 0 }));
  for (const record of records) {
    if (!isScoredSubmission(record)) continue;
    const score = Number(record.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) continue;
    const bucket = buckets.find((candidate) => score >= candidate.min && score <= candidate.max);
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

export function latestScoredResult(records: AnalyticsRecord[]): LatestResult | null {
  const ordered = orderedScoredRecords(records);
  if (!ordered.length) return null;
  const latest = ordered[ordered.length - 1];
  const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
  const score = recordScore(latest);
  const previousScore = previous ? recordScore(previous) : null;
  return {
    id: latest.id,
    subject: subjectLabel(latest),
    score,
    at: recordTime(latest),
    previousScore,
    change: previousScore === null ? null : score - previousScore,
  };
}

export function subjectBand(average: number): SubjectBand {
  if (average >= 70) return 'strong';
  if (average >= 50) return 'building';
  return 'needs-practice';
}

/**
 * Subject averages, with a movement figure only when two distinct scored papers
 * exist. `singleSubjectProgress` already guarantees the saved plan matches the
 * paper, so this projection does not need to re-validate the score.
 */
export function subjectPerformance(records: AnalyticsRecord[]): SubjectPerformance[] {
  return singleSubjectProgress(records).map((row) => ({
    ...row,
    change: row.latest !== null && row.previous !== null ? row.latest - row.previous : null,
    band: subjectBand(row.average),
  }));
}

export function performanceHighlights(rows: SubjectPerformance[]): PerformanceHighlights {
  const strengths = rows
    .filter((row) => row.band === 'strong')
    .sort((a, b) => b.average - a.average || a.subject.localeCompare(b.subject));
  const weakest = rows
    .slice()
    .sort((a, b) => a.average - b.average || a.subject.localeCompare(b.subject))[0];
  return {
    strengths,
    // "Needs practice" is a relative statement about this sample, so it is only
    // shown when the lowest average is actually below the strong band.
    needsPractice: weakest && weakest.average < 70 ? [weakest] : [],
  };
}

export type AnalyticsSummary = {
  scoredCount: number;
  averageScore: number | null;
  latest: LatestResult | null;
  subjects: SubjectPerformance[];
  highlights: PerformanceHighlights;
  trend: TrendPoint[];
  trendSummary: ReturnType<typeof trendSummary>;
  distribution: DistributionBucket[];
  distributionTotal: number;
  recommendation: LearningRecommendation | null;
};

export function learningRecommendation(
  rows: SubjectPerformance[],
  latest: LatestResult | null,
  subjectsWithScores: number,
): LearningRecommendation | null {
  const suggested = practiceSuggestion(rows);
  if (suggested) {
    return {
      title: `Practise ${suggested.subject}`,
      detail: `${suggested.subject} averages ${suggested.average}% across ${suggested.attempts} scored single-subject papers in this sample. Another paper is the next evidence-based step.`,
      href: '/cbt',
      cta: 'Choose a practice paper',
    };
  }

  if (!latest) {
    return {
      title: 'Take your first timed paper',
      detail: 'One scored practice test is enough to start tracking your average, subject scores and score trend.',
      href: '/cbt',
      cta: 'Start practice',
    };
  }

  if (latest.change !== null && latest.change < 0) {
    return {
      title: `Review your latest ${latest.subject} result`,
      detail: `Your latest ${latest.subject} score is ${latest.score}%, ${Math.abs(latest.change)} points below the previous scored paper. Review the answers before trying again.`,
      href: latest.id ? `/dashboard/cbt/results/${encodeURIComponent(latest.id)}` : '/dashboard/cbt',
      cta: 'Review the result',
    };
  }

  const weakest = rows
    .slice()
    .sort((a, b) => a.average - b.average || a.subject.localeCompare(b.subject))[0];
  if (subjectsWithScores >= 2 && weakest) {
    return {
      title: `Keep building ${weakest.subject}`,
      detail: `${weakest.subject} is your lowest subject average at ${weakest.average}% across ${weakest.attempts} scored ${weakest.attempts === 1 ? 'paper' : 'papers'}. A short practice paper is the cheapest way to test whether that is changing.`,
      href: '/cbt',
      cta: 'Practise this subject',
    };
  }

  return null;
}

export function summarizePerformance(records: AnalyticsRecord[]): AnalyticsSummary {
  const ordered = orderedScoredRecords(records);
  const subjects = subjectPerformance(records);
  const latest = latestScoredResult(records);
  const trend = scoreTrend(records);
  const distribution = scoreDistribution(records);
  const scoredCount = ordered.length;
  const averageScore = scoredCount
    ? Math.round(ordered.reduce((total, record) => total + Number(record.score), 0) / scoredCount)
    : null;
  return {
    scoredCount,
    averageScore,
    latest,
    subjects,
    highlights: performanceHighlights(subjects),
    trend,
    trendSummary: trendSummary(trend),
    distribution,
    distributionTotal: distribution.reduce((total, bucket) => total + bucket.count, 0),
    recommendation: learningRecommendation(subjects, latest, subjects.length),
  };
}
