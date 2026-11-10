import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { practiceSuggestion, singleSubjectProgress } from '../src/lib/dashboardCbtStats';

const paper = (subject: string, correct: number, date: string) => ({
  status: 'submitted', score: correct * 10, correct_answers: correct, total_questions: 10,
  subject_plan: [{ subject, questions: 10 }], selected_subjects: [subject], submitted_at: date,
});

test('new students and incomplete, expired, mixed and unscored records cannot invent subject scores', () => {
  assert.deepEqual(singleSubjectProgress([]), []);
  const base = paper('Physics', 4, '2026-01-01T10:00:00Z');
  assert.deepEqual(singleSubjectProgress([
    { ...base, status: 'expired' }, { ...base, status: 'in_progress' }, { ...base, score: null },
    { ...base, subject_plan: null }, { ...base, subject_plan: [] },
    { ...base, subject_plan: [{ subject: 'Physics', questions: 5 }, { subject: 'Biology', questions: 5 }] },
    { ...base, subject_plan: [{ subject: 'Physics', questions: 9 }] },
    { ...base, correct_answers: 7 }, { ...base, score: 500 }, { ...base, correct_answers: null },
    { ...base, subject_plan: [{ subject: '', questions: 10 }] },
  ]), []);
  assert.equal(practiceSuggestion([]), null);
});

test('single-subject summaries are weighted by real question counts and dated results', () => {
  const p1 = paper(' Physics ', 4, '2026-01-01T10:00:00Z');
  const p2 = paper('physics', 6, '2026-01-02T10:00:00Z');
  const b1 = paper('Biology', 9, '2026-01-01T11:00:00Z');
  const b2 = paper('Biology', 8, '2026-01-02T11:00:00Z');
  const results = singleSubjectProgress([p1, b2, p2, b1]);
  assert.deepEqual(results, [
    { subject: 'Biology', attempts: 2, questions: 20, correct: 17, average: 85, latest: 80, previous: 90 },
    { subject: 'Physics', attempts: 2, questions: 20, correct: 10, average: 50, latest: 60, previous: 40 },
  ]);
  assert.equal(practiceSuggestion(results)?.subject, 'Physics');
  assert.equal(practiceSuggestion(singleSubjectProgress([p1, p2, b1])), null, 'one subject lacks sufficient papers');
  assert.equal(practiceSuggestion(singleSubjectProgress([p1, p2])), null, 'one subject cannot be compared');
});

test('question-weighted results avoid averaging differently sized papers equally', () => {
  const small = paper('Biology', 10, '2026-01-01T10:00:00Z');
  const large = { ...paper('Biology', 0, '2026-01-02T10:00:00Z'), total_questions: 30, subject_plan: [{ subject: 'Biology', questions: 30 }] };
  const [result] = singleSubjectProgress([small, large]);
  assert.equal(result.average, 25);
  assert.equal(result.questions, 40);
  assert.equal(result.correct, 10);
});

test('recommendations are suppressed for ties and insufficient question counts', () => {
  const p = [paper('Physics', 5, '2026-01-01T10:00:00Z'), paper('Physics', 5, '2026-01-02T10:00:00Z')];
  const b = [paper('Biology', 5, '2026-01-01T10:00:00Z'), paper('Biology', 5, '2026-01-02T10:00:00Z')];
  assert.equal(practiceSuggestion(singleSubjectProgress([...p, ...b])), null);
  const short = b.map(record => ({ ...record, total_questions: 5, correct_answers: 4, score: 80, subject_plan: [{ subject: 'Biology', questions: 5 }] }));
  assert.equal(practiceSuggestion(singleSubjectProgress([...p, ...short])), null);
});

test('same-time and undated papers are not ordered as a reliable trend', () => {
  const a = paper('Maths', 5, '2026-01-01T10:00:00Z');
  const b = paper('Maths', 8, '2026-01-01T10:00:00Z');
  const row = singleSubjectProgress([a, b, { ...a, submitted_at: null }])[0];
  assert.equal(row.latest, null);
  assert.equal(row.previous, null);
  assert.equal(row.attempts, 3);
});

test('dashboard reads a bounded current-user history and never queries the full question bank', () => {
  const page = readFileSync('pages/StudentDashboardV2.tsx', 'utf8');
  assert.match(page, /from\('cbt_attempts'\).*subject_plan.*\.eq\('user_id', user\.id\).*\.limit\(50\)/);
  assert.doesNotMatch(page, /from\('exam_questions'\)/);
  assert.match(page, /return attempts\.sort\([\s\S]*?\)\.slice\(0, 50\)/, 'local preview uses the same history ceiling');
  assert.match(page, /void load\(\)\.catch\(/, 'unexpected load failures cannot leave an endless skeleton');
  assert.match(page, /Dashboard unavailable/);
});
