import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cbtModeLabel, isScoredSubmission, submittedSubjectCounts } from '../src/lib/dashboardCbtStats';

test('only submitted papers with a finite percentage count toward score summaries', () => {
  assert.equal(isScoredSubmission({ status: 'submitted', score: 0 }), true);
  assert.equal(isScoredSubmission({ status: 'submitted', score: 100 }), true);
  for (const record of [
    { status: 'expired', score: 0 }, { status: 'cancelled', score: 60 },
    { status: 'in_progress', score: 80 }, { status: 'submitted', score: null },
    { status: 'submitted', score: Number.NaN }, { status: 'submitted', score: 101 },
  ]) assert.equal(isScoredSubmission(record), false);
});

test('unknown modes are not guessed', () => {
  assert.equal(cbtModeLabel('practice'), 'Practice');
  assert.equal(cbtModeLabel('mock'), 'Mock');
  assert.equal(cbtModeLabel(null), 'Mode unavailable');
});

test('subject summaries count recorded selections once per submitted paper, never infer performance', () => {
  const counts = submittedSubjectCounts([
    { status: 'submitted', selected_subjects: ['Physics', 'Biology', ' physics '] },
    { status: 'submitted', score: null, selected_subjects: ['PHYSICS'] },
    { status: 'expired', selected_subjects: ['Biology'] },
    { status: 'cancelled', selected_subjects: ['Chemistry'] },
    { status: 'submitted', selected_subjects: null },
  ]);
  assert.deepEqual(counts, [{ subject: 'Physics', count: 2 }, { subject: 'Biology', count: 1 }]);
  assert.deepEqual(submittedSubjectCounts([]), []);
});

test('dashboard failure and bounded sample are disclosed without claiming automatic submission', () => {
  const page = readFileSync('pages/StudentDashboardV2.tsx', 'utf8');
  assert.match(page, /\.eq\('user_id', user\.id\)\.order\('created_at', \{ ascending: false \}\)\.limit\(50\)/);
  assert.match(page, /attemptsUnavailable \? <p role="status">CBT history could not be loaded/);
  assert.match(page, /not all-time totals/);
  assert.doesNotMatch(page, /Answers were submitted automatically/);
  assert.match(page, /subject-level weaknesses are not inferred/);
});
