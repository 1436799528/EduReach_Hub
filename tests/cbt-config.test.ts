import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_CBT_LIMITS,
  JAMB_PAPER_STANDARD,
  compulsorySubjectKeys,
  describeSession,
  durationForQuestionCount,
  isStartableBank,
  mockCombinationError,
  mockDurationMinutes,
  mockPaperError,
  mockPaperFor,
  normalizeSubject,
  paperStandardFor,
  practiceDurationOptions,
  previewPlan,
  questionCountOptions,
  resolveSetupExam,
  subjectLimitFor,
  validateSession,
  type CatalogExam,
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
  // Compulsory subjects are validated with the bank's own display name.
  assert.match(validateSession(base, availability, DEFAULT_CBT_LIMITS, ['english'])!, /Use of English is compulsory/);
  assert.equal(validateSession({ ...base, subjects: ['English Language', 'Physics'] }, availability, DEFAULT_CBT_LIMITS, ['english']), null);
});

test('subject names canonicalise across bank, catalogue and course-guide spellings', () => {
  assert.equal(normalizeSubject('Use of English'), 'english');
  assert.equal(normalizeSubject('English Language'), 'english');
  assert.equal(normalizeSubject('ENGLISH'), 'english');
  assert.equal(normalizeSubject('Literature-in-English'), normalizeSubject('Literature in English'));
  assert.equal(normalizeSubject('  Physics  '), 'physics');
  assert.deepEqual(compulsorySubjectKeys('jamb'), ['english']);
  assert.deepEqual(compulsorySubjectKeys('JAMB'), ['english']);
  assert.deepEqual(compulsorySubjectKeys('WAEC'), []);
  assert.deepEqual(compulsorySubjectKeys('NECO'), []);
  assert.deepEqual(compulsorySubjectKeys('POST-UTME'), [], 'Post-UTME must not inherit the JAMB rule via the UTME substring');
  assert.deepEqual(compulsorySubjectKeys('post-utme'), []);
});

test('bank resolution never lets a newer near-empty bank hijack the default route', () => {
  const bank = (over: Partial<CatalogExam>): CatalogExam => ({
    id: 'x', title: 'Bank', exam_body: 'JAMB', subject: 'Multiple subjects',
    description: null, duration_minutes: 120, ...over,
  });
  // Mirrors the production defect: the catalogue arrives newest-first, and
  // the newest JAMB bank holds two test Physics questions and no English.
  const testBank = bank({
    id: '33075e1c', title: 'JAMB UTME Practice Bank', question_count: 2, subject_count: 1,
    subjects: [{ subject: 'Physics', questionCount: 2 }],
  });
  const comprehensive = bank({
    id: 'f56e8e07', title: 'JAMB UTME Comprehensive Practice Bank', question_count: 400, subject_count: 9,
    subjects: [
      { subject: 'Use of English', questionCount: 80 },
      { subject: 'Physics', questionCount: 40 },
    ],
  });

  assert.equal(isStartableBank(testBank, 'jamb'), false, 'two questions and no English cannot start a JAMB session');
  assert.equal(isStartableBank(comprehensive, 'jamb'), true);
  assert.equal(
    resolveSetupExam([testBank, comprehensive], 'jamb', null)?.id,
    'f56e8e07',
    'the default JAMB route opens the comprehensive bank, not the newest row',
  );
  assert.equal(
    resolveSetupExam([comprehensive, testBank], 'jamb', null)?.id,
    'f56e8e07',
    'catalogue order must not change the answer',
  );
  assert.equal(
    resolveSetupExam([testBank, comprehensive], 'jamb', '33075e1c')?.id,
    '33075e1c',
    'an explicit ?exam= deep link still wins; the wizard then explains the bank',
  );

  // An English alias satisfies the JAMB startability rule.
  const aliasBank = bank({
    id: 'alias', question_count: 50, subject_count: 2,
    subjects: [{ subject: 'English Language', questionCount: 30 }, { subject: 'Physics', questionCount: 20 }],
  });
  assert.equal(isStartableBank(aliasBank, 'jamb'), true);

  // Without availability counts the bank cannot be judged and stays eligible.
  const legacy = bank({ id: 'legacy' });
  assert.equal(isStartableBank(legacy, 'jamb'), true);
  assert.equal(resolveSetupExam([legacy], 'jamb', null)?.id, 'legacy');

  // Other bodies do not require English to be startable.
  const waec = bank({
    id: 'waec1', exam_body: 'WAEC', title: 'WAEC SSCE Bank', question_count: 40, subject_count: 1,
    subjects: [{ subject: 'Biology', questionCount: 40 }],
  });
  assert.equal(isStartableBank(waec, 'waec'), true);
  assert.equal(resolveSetupExam([waec], 'waec', null)?.id, 'waec1');
});

test('practice time is proportional to the examination pace, within limits', () => {
  // JAMB sets 180 questions in 120 minutes: 20 questions take 14 minutes at
  // that pace. Nobody types that ratio into a page.
  assert.equal(durationForQuestionCount(20, { standard: paperStandardFor('jamb') }), 14);
  assert.equal(durationForQuestionCount(90, { standard: paperStandardFor('jamb') }), 60);
  assert.equal(durationForQuestionCount(180, { standard: paperStandardFor('jamb') }), 120);
  assert.equal(durationForQuestionCount(0, { standard: paperStandardFor('jamb') }), DEFAULT_CBT_LIMITS.minMinutes);
  assert.equal(
    durationForQuestionCount(1000, { standard: paperStandardFor('jamb') }),
    DEFAULT_CBT_LIMITS.maxMinutes,
    'an absurd count is clamped, never sent as an excessive duration',
  );

  // Without a national standard the bank duration is spread over the largest
  // paper the server allows (100 questions by default).
  assert.equal(durationForQuestionCount(50, { defaultMinutes: 90 }), 45);
  assert.equal(durationForQuestionCount(100, { defaultMinutes: 90 }), 90);

  // Post-UTME carries no JAMB standard even though its name contains "UTME".
  assert.equal(paperStandardFor('post-utme'), null);
  assert.equal(paperStandardFor('JAMB'), JAMB_PAPER_STANDARD);
});

test('the subject cap follows the examination, not the bank default', () => {
  assert.equal(subjectLimitFor('jamb'), 4, 'JAMB UTME is Use of English plus three');
  assert.equal(subjectLimitFor('JAMB UTME'), 4);
  assert.equal(subjectLimitFor('jamb', { ...DEFAULT_CBT_LIMITS, maxSubjects: 3 }), 4, "JAMB's four-subject standard is not reduced by a generic limit");
  assert.equal(subjectLimitFor('waec'), 9);
  assert.equal(subjectLimitFor('neco'), 9);
  assert.equal(subjectLimitFor('post-utme'), 9);
});

test('a JAMB mock is a four-subject paper and says what is missing', () => {
  assert.match(String(mockCombinationError(['Mathematics', 'Physics'], 'jamb')), /Use of English is compulsory/);
  assert.match(
    String(mockCombinationError(['Use of English', 'Mathematics'], 'jamb')),
    /Add 2 more subjects/,
  );
  assert.equal(mockCombinationError(['Use of English', 'Mathematics', 'Physics', 'Chemistry'], 'jamb'), null);
  assert.match(String(mockCombinationError(['Mathematics'], 'waec')), /requires at least four subjects/i);
  assert.match(String(mockCombinationError(['Mathematics', 'Biology', 'Chemistry'], 'waec')), /requires at least four subjects/i);
  assert.equal(mockCombinationError(['English', 'Mathematics', 'Biology', 'Chemistry'], 'waec'), null);
  assert.equal(mockCombinationError(['English', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Government', 'Economics', 'Geography', 'Literature in English'], 'waec'), null, 'WAEC can use up to nine subjects');
  assert.match(String(mockCombinationError(['English', 'Mathematics', 'Biology'], 'post-utme')), /at least four subjects/i);
  assert.equal(
    mockCombinationError(['Use of English', 'Mathematics', 'Physics', 'Use of English'], 'jamb'),
    'A JAMB mock requires exactly four subjects: Use of English plus three others. Add 1 more subject.',
    'a duplicate spelling is one subject, not two',
  );
});

test('mock duration is the examination duration, never zero or negative', () => {
  assert.equal(mockDurationMinutes(120), 120);
  assert.equal(mockDurationMinutes(90), 90);
  assert.equal(mockDurationMinutes(null), 120);
  assert.equal(mockDurationMinutes(undefined), 120);
  assert.equal(mockDurationMinutes(0), 120);
  assert.equal(mockDurationMinutes(-30), 120);
});

test('the mock paper comes from the bank, with the JAMB standard as fallback', () => {
  assert.deepEqual(mockPaperFor('jamb'), { questions: 180, subjectQuota: { english: 60, other: 40 } });
  assert.deepEqual(
    mockPaperFor('jamb', { questionCount: 180, subjectQuota: { english: 60, other: 40 } }),
    { questions: 180, subjectQuota: { english: 60, other: 40 } },
    'the database value is used as reported',
  );
  assert.deepEqual(
    mockPaperFor('jamb', { questionCount: 120, subjectQuota: null }),
    { questions: 120, subjectQuota: null },
    'a bank can change the paper without a release',
  );
  assert.equal(mockPaperFor('waec'), null, 'WAEC has no fixed cross-subject paper');
  assert.equal(
    mockPaperFor('jamb', { questionCount: null, subjectQuota: null }),
    null,
    'a bank that reports no fixed paper is not overridden by the JAMB default',
  );
  assert.deepEqual(mockPaperFor('waec', { questionCount: 90, subjectQuota: null }), { questions: 90, subjectQuota: null });
});

test('a mock that the bank cannot fill is blocked before the API call', () => {
  const paper = mockPaperFor('jamb');
  const full = [
    { subject: 'Use of English', questionCount: 120 },
    { subject: 'Mathematics', questionCount: 60 },
    { subject: 'Physics', questionCount: 60 },
    { subject: 'Chemistry', questionCount: 60 },
  ];
  assert.equal(mockPaperError(['Use of English', 'Mathematics', 'Physics', 'Chemistry'], full, paper), null);

  const shallow = full.map((entry) => entry.subject === 'Use of English' ? { ...entry, questionCount: 24 } : entry);
  assert.match(
    String(mockPaperError(['Use of English', 'Mathematics', 'Physics', 'Chemistry'], shallow, paper)),
    /Use of English needs 60 but the bank has 24/,
    'the subject that is short is named, with both numbers',
  );

  assert.match(
    String(mockPaperError(
      ['Biology', 'Physics'],
      [{ subject: 'Biology', questionCount: 12 }, { subject: 'Physics', questionCount: 8 }],
      { questions: 100, subjectQuota: null },
    )),
    /needs 100 questions .* this bank has 20/,
    'a paper without quotas is still checked against the total pool',
  );
  assert.equal(mockPaperError([], full, paper), null, 'the combination rule reports an empty selection');
});

test('the mock preview allocates the examination quota, not a proportional split', () => {
  const plan = previewPlan([
    { subject: 'Use of English', questionCount: 120 },
    { subject: 'Mathematics', questionCount: 120 },
    { subject: 'Physics', questionCount: 120 },
    { subject: 'Chemistry', questionCount: 120 },
  ], 180, { english: 60, other: 40 });
  assert.deepEqual(plan.map((entry) => entry.questions), [60, 40, 40, 40]);
  assert.deepEqual(plan.map((entry) => entry.first), [1, 61, 101, 141]);
  assert.equal(plan[plan.length - 1].last, 180);

  const clamped = previewPlan([
    { subject: 'Use of English', questionCount: 30 },
    { subject: 'Mathematics', questionCount: 120 },
  ], 180, { english: 60, other: 40 });
  assert.equal(clamped[0].questions, 30, 'a preview never promises questions the bank does not have');
});
