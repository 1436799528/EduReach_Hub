import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CBT_LIMITS,
  describeSession,
  practiceDurationOptions,
  previewPlan,
  questionCountOptions,
  validateSession,
} from '../src/lib/cbt-config';

// CBT-1/CBT-2: the configuration the student sees must match what the server
// will accept. These are the pure functions behind the setup wizard, so they are
// tested directly rather than through a rendered page.

test('question-count choices never exceed what the bank can serve', () => {
  assert.deepEqual(questionCountOptions(60), [10, 20, 30, 40, 50, 60]);
  assert.deepEqual(questionCountOptions(7), [7], 'a small bank offers its real total');
  assert.deepEqual(questionCountOptions(3, { ...DEFAULT_CBT_LIMITS, minQuestions: 3 }), [3]);
  assert.deepEqual(questionCountOptions(0), [], 'an empty bank offers no choice, so the UI can say why');
  assert.ok(!questionCountOptions(60).includes(80), 'an option the bank cannot supply is never offered');
});

test('practice durations include the exam default and never exceed the server limit', () => {
  const choices = practiceDurationOptions(120);
  assert.ok(choices.includes(120), 'the exam default is always offered');
  assert.ok(choices.every((minutes) => minutes <= 120), 'no choice is longer than what the setup knows is allowed');
  const short = practiceDurationOptions(20);
  assert.ok(short.includes(20), 'a bank with a short default still offers it');
  assert.ok(!choices.includes(180), 'the longest preset is not invented when the default is lower');
});

test('the previewed plan is proportional, capacity-aware and keeps subject order', () => {
  const plan = previewPlan([
    { subject: 'Physics', questionCount: 8 },
    { subject: 'Use of English', questionCount: 40 },
  ], 24);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].subject, 'Physics', 'the student’s order is preserved');
  assert.ok(plan[0].questions <= 8, 'a small subject is never over-drawn');
  assert.equal(plan.reduce((sum, entry) => sum + entry.questions, 0), 24, 'the paper is exactly the requested size');
  // Blocks are contiguous and positions are 1-based, which is what the exam
  // shell shows as "Physics · Question 3 of 8".
  assert.equal(plan[0].first, 1);
  assert.equal(plan[0].last, plan[0].questions);
  assert.equal(plan[1].first, plan[0].last + 1);
});

test('a subject can never be over-drawn, even when the total is large', () => {
  // Physics has 3 questions and Mathematics has 5: the paper cannot exceed 8, and
  // the split follows what each subject actually holds.
  const plan = previewPlan([
    { subject: 'Physics', questionCount: 3 },
    { subject: 'Mathematics', questionCount: 5 },
  ], 30);
  assert.equal(plan[0].questions, 3, 'a subject is capped at its own questions');
  assert.equal(plan[1].questions, 5);
  assert.equal(plan.reduce((sum, entry) => sum + entry.questions, 0), 8, 'the paper is capped by the bank, not padded');

  // With a larger pool the small subject keeps its share: 30 of 53 is not
  // 30 all from one subject.
  const proportional = previewPlan([
    { subject: 'Physics', questionCount: 3 },
    { subject: 'Mathematics', questionCount: 50 },
  ], 30);
  assert.ok(proportional[0].questions >= 1 && proportional[0].questions <= 3);
  assert.equal(proportional.reduce((sum, entry) => sum + entry.questions, 0), 30);
});

test('the pre-start summary states exactly what will happen', () => {
  const plan = previewPlan([{ subject: 'Biology', questionCount: 20 }], 10);
  const lines = describeSession({ mode: 'practice', subjects: ['Biology'], questionCount: 10, durationMinutes: 30 }, plan);
  assert.deepEqual(lines, [
    'Mode: Practice',
    'Subjects: Biology',
    'Questions: 10',
    'Time: 30 minutes',
    'Biology: 10 questions (Q1–Q10)',
  ]);
  const mock = describeSession({ mode: 'mock', subjects: ['Use of English', 'Mathematics'], questionCount: 40, durationMinutes: 120 }, []);
  assert.equal(mock[0], 'Mode: Mock examination');
});

test('validation rejects the impossible with a message a student can act on', () => {
  const availability = [
    { subject: 'Use of English', questionCount: 40 },
    { subject: 'Physics', questionCount: 8 },
  ];
  const base = { mode: 'practice' as const, subjects: ['Physics'], questionCount: 8, durationMinutes: 30 };
  assert.equal(validateSession(base, availability), null);
  assert.match(validateSession({ ...base, subjects: [] }, availability)!, /at least one subject/i);
  assert.match(validateSession({ ...base, subjects: ['Economics'] }, availability)!, /No questions are available for: Economics/);
  assert.match(validateSession({ ...base, questionCount: 400 }, availability)!, /no more than/i);
  assert.match(validateSession({ ...base, durationMinutes: 1000 }, availability)!, /between/i);
  // Subject matching ignores the case/spacing differences the bank and the
  // catalogue disagree about.
  assert.equal(validateSession({ ...base, subjects: ['use of  english'] }, availability), null);
});
