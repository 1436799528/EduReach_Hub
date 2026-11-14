import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  latestScoredResult,
  learningRecommendation,
  orderedScoredRecords,
  performanceHighlights,
  scoreDistribution,
  scoreTrend,
  subjectPerformance,
  summarizePerformance,
  trendSummary,
} from '../src/lib/dashboardAnalytics';

// UI-5: the dashboard is allowed to say "improved" only when two scored papers
// exist, and it may call a subject score a subject score only when the saved
// plan proves it. These fixtures use question counts that divide 100 exactly, so
// `singleSubjectProgress` can validate `score` against correct/total.

type Fixture = Parameters<typeof scoreDistribution>[0][number];

function paper(options: {
  id: string;
  subject: string;
  correct: number;
  total: number;
  date: string;
  status?: string;
  score?: number | null;
}): Fixture {
  return {
    id: options.id,
    status: options.status ?? 'submitted',
    score: options.score === undefined ? Math.round((options.correct / options.total) * 100) : options.score,
    correct_answers: options.correct,
    total_questions: options.total,
    submitted_at: options.date,
    created_at: options.date,
    subject: options.subject,
    selected_subjects: [options.subject],
    subject_plan: [{ subject: options.subject, questions: options.total }],
  };
}

const mathematicsFirst = paper({ id: 'm1', subject: 'Mathematics', correct: 14, total: 20, date: '2026-10-01T09:00:00Z' });
const mathematicsSecond = paper({ id: 'm2', subject: 'Mathematics', correct: 16, total: 20, date: '2026-10-08T09:00:00Z' });
const englishWeak = paper({ id: 'e1', subject: 'English', correct: 12, total: 25, date: '2026-10-10T09:00:00Z' });
const physicsStrong = paper({ id: 'p1', subject: 'Physics', correct: 22, total: 25, date: '2026-10-12T09:00:00Z' });

test('only submitted, in-range scores enter a series, oldest first', () => {
  const records: Fixture[] = [
    mathematicsSecond,
    { ...physicsStrong, status: 'draft' },
    paper({ id: 'e-invalid', subject: 'English', correct: 0, total: 10, date: '2026-10-11T09:00:00Z', score: 120 }),
    mathematicsFirst,
  ];
  assert.deepEqual(orderedScoredRecords(records).map((record) => record.id), ['m1', 'm2']);
});

test('the trend is bounded and carries deterministic date labels', () => {
  const points = scoreTrend([mathematicsSecond, mathematicsFirst, physicsStrong], 2);
  assert.deepEqual(points.map((point) => point.score), [80, 88]);
  assert.deepEqual(points.map((point) => point.label), ['08 Oct', '12 Oct']);
  assert.equal(points[0].at, Date.parse('2026-10-08T09:00:00Z'));
});

test('trend direction is the first-to-last movement in the sample', () => {
  assert.deepEqual(trendSummary([{ score: 60, at: 1, label: '' }, { score: 72, at: 2, label: '' }]), { direction: 'up', change: 12 });
  assert.deepEqual(trendSummary([{ score: 72, at: 1, label: '' }, { score: 64, at: 2, label: '' }]), { direction: 'down', change: -8 });
  assert.equal(trendSummary([{ score: 70, at: 1, label: '' }]), null);
});

test('distribution buckets include both edges and ignore non-scored records', () => {
  const buckets = scoreDistribution([
    paper({ id: 'a', subject: 'X', correct: 39, total: 100, date: '2026-10-01T00:00:00Z' }),
    paper({ id: 'b', subject: 'X', correct: 40, total: 100, date: '2026-10-02T00:00:00Z' }),
    paper({ id: 'c', subject: 'X', correct: 49, total: 100, date: '2026-10-03T00:00:00Z' }),
    paper({ id: 'd', subject: 'X', correct: 50, total: 100, date: '2026-10-04T00:00:00Z' }),
    paper({ id: 'e', subject: 'X', correct: 90, total: 100, date: '2026-10-05T00:00:00Z' }),
    paper({ id: 'f', subject: 'X', correct: 100, total: 100, date: '2026-10-06T00:00:00Z' }),
    paper({ id: 'ignored', subject: 'X', correct: 100, total: 100, date: '2026-10-07T00:00:00Z', status: 'in_progress' }),
  ]);
  const byId = Object.fromEntries(buckets.map((bucket) => [bucket.id, bucket.count]));
  assert.equal(byId['below-40'], 1);
  assert.equal(byId['40-49'], 2);
  assert.equal(byId['50-59'], 1);
  assert.equal(byId['90-100'], 2);
  assert.equal(buckets.reduce((total, bucket) => total + bucket.count, 0), 6);
});

test('the latest result compares with the previous scored paper, in points', () => {
  const latest = latestScoredResult([mathematicsFirst, mathematicsSecond, englishWeak]);
  assert.ok(latest);
  assert.equal(latest.subject, 'English');
  assert.equal(latest.score, 48);
  assert.equal(latest.previousScore, 80);
  assert.equal(latest.change, -32);
});

test('subject averages only come from a matching single-subject plan', () => {
  const multiSubject = {
    ...paper({ id: 'multi', subject: 'Mixed', correct: 30, total: 50, date: '2026-10-13T00:00:00Z' }),
    selected_subjects: ['Mathematics', 'Physics'],
    subject_plan: [
      { subject: 'Mathematics', questions: 25 },
      { subject: 'Physics', questions: 25 },
    ],
  };
  const rows = subjectPerformance([mathematicsFirst, mathematicsSecond, multiSubject]);
  assert.deepEqual(rows.map((row) => row.subject), ['Mathematics']);
  const [mathematics] = rows;
  assert.equal(mathematics.questions, 40);
  assert.equal(mathematics.average, 75);
  assert.equal(mathematics.latest, 80);
  assert.equal(mathematics.previous, 70);
  assert.equal(mathematics.change, 10);
  assert.equal(mathematics.band, 'strong');
});

test('highlights name the strongest subjects and the weakest below the strong band', () => {
  const rows = subjectPerformance([mathematicsFirst, mathematicsSecond, englishWeak, physicsStrong]);
  const highlights = performanceHighlights(rows);
  assert.deepEqual(highlights.strengths.map((row) => row.subject), ['Physics', 'Mathematics']);
  assert.deepEqual(highlights.needsPractice.map((row) => row.subject), ['English']);
});

test('a sample where every subject is strong does not invent a weakness', () => {
  const rows = subjectPerformance([mathematicsFirst, mathematicsSecond, physicsStrong]);
  assert.deepEqual(performanceHighlights(rows).needsPractice, []);
});

test('a recommendation with no evidence asks for the first paper, not a verdict', () => {
  const recommendation = learningRecommendation([], null, 0);
  assert.equal(recommendation?.title, 'Take your first timed paper');
  assert.match(recommendation?.detail || '', /one scored practice test/i);
});

test('a decline recommends reviewing the latest result and deep-links to it', () => {
  const latest = latestScoredResult([mathematicsSecond, englishWeak])!;
  const recommendation = learningRecommendation([], latest, 1);
  assert.equal(recommendation?.href, '/dashboard/cbt/results/e1');
  assert.match(recommendation?.detail || '', /32 points below/);
});

test('two comparable subjects produce a practice recommendation for the lower one', () => {
  const englishSecond = paper({ id: 'e2', subject: 'English', correct: 15, total: 25, date: '2026-10-14T00:00:00Z' });
  const records = [mathematicsFirst, mathematicsSecond, englishWeak, englishSecond];
  const summary = summarizePerformance(records);
  assert.equal(summary.recommendation?.title, 'Practise English');
  assert.equal(summary.recommendation?.href, '/cbt');
});

test('the summary reports no average at all when nothing has been scored', () => {
  const summary = summarizePerformance([{ ...mathematicsFirst, status: 'in_progress' }]);
  assert.equal(summary.scoredCount, 0);
  assert.equal(summary.averageScore, null);
  assert.equal(summary.latest, null);
  assert.equal(summary.distributionTotal, 0);
});
