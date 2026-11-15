import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  homeAttemptHref,
  homeAttemptLabel,
  recentHomeAttempts,
  summarizeHomeActivity,
  type HomeAttempt,
} from '../src/lib/homeActivity';

// UX-7: the home screen's record must describe only finished papers, count a
// subject once, and never leak a bank id into a label.

const NOW = Date.now();
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

const attempts: HomeAttempt[] = [
  { id: 'a1', status: 'submitted', exam_id: 'jamb', score: 60, submitted_at: at(-60), selected_subjects: ['maths', 'english'] },
  { id: 'a2', status: 'submitted', exam_id: 'waec', score: 80, submitted_at: at(-30), subject_plan: { maths: 20, physics: 20 } },
  { id: 'a3', status: 'in_progress', exam_id: 'neco', expires_at: at(20), created_at: at(-10) },
  { id: 'a4', status: 'expired', exam_id: 'post-utme', expires_at: at(-5), created_at: at(-90) },
];

test('the home record counts finished papers and real scores only', () => {
  const summary = summarizeHomeActivity(attempts);
  assert.equal(summary.papers, 2);
  assert.equal(summary.averageScore, 70);
  assert.equal(summary.bestScore, 80);
  // math + english + physics: the two maths entries are one subject.
  assert.equal(summary.subjects, 3);
});

test('an empty record is honest, not zero-filled', () => {
  assert.deepEqual(summarizeHomeActivity([]), { papers: 0, averageScore: null, bestScore: null, subjects: 0 });
});

test('recent activity is newest first and bounded', () => {
  const recent = recentHomeAttempts(attempts, 3);
  assert.deepEqual(recent.map((attempt) => attempt.id), ['a3', 'a2', 'a1']);
});

test('a bank id never becomes a label', () => {
  assert.equal(homeAttemptLabel({ id: 'x', exam_id: '9f4c6a4e-0000-4000-8000-000000000000' }), 'CBT practice');
  assert.equal(homeAttemptLabel({ id: 'x', exam_id: 'jamb-2026' }), 'JAMB practice');
  assert.equal(homeAttemptLabel({ id: 'x', mode: 'Post-UTME' }), 'Post-UTME practice');
});

test('attempts link to the live session or the saved result', () => {
  assert.equal(homeAttemptHref(attempts[2]), '/cbt/session/a3');
  assert.equal(homeAttemptHref(attempts[1]), '/dashboard/cbt/results/a2');
  // An expired paper has no result to open; sending the student to a missing
  // result page would be a broken promise.
  assert.equal(homeAttemptHref(attempts[3]), '/dashboard/cbt');
});
