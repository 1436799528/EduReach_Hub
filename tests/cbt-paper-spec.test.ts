import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// Mock paper specification and usable-question rules.
//
// A mock claims to reproduce an examination paper. For JAMB that claim is
// specific: 180 questions in 120 minutes, Use of English 60 plus 40 from each
// of the other three subjects. These tests run the functions that make the
// claim, because a spec stored on the exam row is only real if the planner and
// the start RPC read it.

const STUDENT = '55555555-5555-5555-5555-555555555555';
const JAMB_FULL = 'aaaaaaaa-0000-0000-0000-000000000001';
const JAMB_SHORT = 'aaaaaaaa-0000-0000-0000-000000000002';
const JAMB_REJECTED = 'aaaaaaaa-0000-0000-0000-000000000003';
const WAEC = 'bbbbbbbb-0000-0000-0000-000000000001';

let db: PGlite;

function insertQuestions(examId: string, subject: string, count: number, offset: number, reviewStatus = 'needs_review'): string {
  const values = Array.from({ length: count }, (_, index) => {
    const position = offset + index;
    return `('${examId}'::uuid,'${subject}','${subject} question ${position}','Option A','Option B','Option C','Option D','A',1,${position},'${reviewStatus}')`;
  }).join(',');
  return `insert into public.exam_questions (exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position,review_status) values ${values};`;
}

async function startMock(examId: string, subjects: string[], requested = 40) {
  const { rows } = await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, $2::text[], $3, null, 'mock', null)`,
    [examId, subjects, requested],
  );
  return rows[0];
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${STUDENT}','mock@example.test','{}'::jsonb);`);
  await db.exec(`
    insert into public.cbt_exams (id,title,exam_body,subject,description,duration_minutes,is_active,mock_question_count,mock_subject_quota) values
      ('${JAMB_FULL}','JAMB full mock bank','JAMB','Multiple subjects','bank',120,true,180,'{"english": 60, "other": 40}'::jsonb),
      ('${JAMB_SHORT}','JAMB shallow bank','JAMB','Multiple subjects','bank',120,true,180,'{"english": 60, "other": 40}'::jsonb),
      ('${JAMB_REJECTED}','JAMB rejected bank','JAMB','Multiple subjects','bank',120,true,null,'{}'::jsonb),
      ('${WAEC}','WAEC bank','WAEC','Multiple subjects','bank',90,true,null,'{}'::jsonb);
  `);
  // A bank that can fill the real JAMB paper.
  await db.exec(insertQuestions(JAMB_FULL, 'Use of English', 60, 100));
  await db.exec(insertQuestions(JAMB_FULL, 'Mathematics', 40, 300));
  await db.exec(insertQuestions(JAMB_FULL, 'Physics', 40, 500));
  await db.exec(insertQuestions(JAMB_FULL, 'Chemistry', 40, 700));
  // A bank that cannot: enough subjects, not enough questions.
  await db.exec(insertQuestions(JAMB_SHORT, 'Use of English', 5, 100));
  await db.exec(insertQuestions(JAMB_SHORT, 'Mathematics', 40, 300));
  await db.exec(insertQuestions(JAMB_SHORT, 'Physics', 40, 500));
  await db.exec(insertQuestions(JAMB_SHORT, 'Chemistry', 40, 700));
  // A bank whose extra questions were rejected by an editor.
  await db.exec(insertQuestions(JAMB_REJECTED, 'Use of English', 6, 100));
  await db.exec(insertQuestions(JAMB_REJECTED, 'Use of English', 4, 900, 'rejected'));
  await db.exec(insertQuestions(JAMB_REJECTED, 'Mathematics', 6, 300));
  await db.exec(insertQuestions(WAEC, 'Biology', 12, 100));
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [STUDENT]);
});

after(async () => { await db.close(); });

test('a JAMB mock is exactly the 180-question paper, split 60/40/40/40', async () => {
  const attempt = await startMock(JAMB_FULL, ['Use of English', 'Mathematics', 'Physics', 'Chemistry'], 40);
  assert.equal(attempt.total_questions, 180, 'the client cannot shrink the paper');
  assert.equal(attempt.duration_minutes, 120);
  assert.equal(attempt.subject_plan.length, 4);
  assert.deepEqual(
    attempt.subject_plan.map((entry: any) => [entry.subject, entry.questions]),
    [['Use of English', 60], ['Mathematics', 40], ['Physics', 40], ['Chemistry', 40]],
    'the paper follows the examination specification, not a proportional split',
  );
});

test('the order the subjects were chosen in is preserved in the plan', async () => {
  const attempt = await startMock(JAMB_FULL, ['Physics', 'Use of English', 'Chemistry', 'Mathematics']);
  assert.deepEqual(
    attempt.subject_plan.map((entry: any) => entry.subject),
    ['Physics', 'Use of English', 'Chemistry', 'Mathematics'],
    'the JAMB rule does not require English to be listed first',
  );
  assert.deepEqual(
    attempt.subject_plan.map((entry: any) => entry.questions),
    [40, 60, 40, 40],
    'the quota follows the subject, not its position',
  );
  assert.equal(attempt.total_questions, 180);
});

test('a bank that cannot fill the paper is refused with the shortfall named', async () => {
  await assert.rejects(
    () => startMock(JAMB_SHORT, ['Use of English', 'Mathematics', 'Physics', 'Chemistry']),
    /cannot fill the 180-question mock paper.*Use of English needs 60 questions but this bank has 5/s,
    'the message says which subject is short and by how much',
  );
});

test('rejected questions are not served, planned or counted', async () => {
  const { rows: availability } = await db.query<{ subject: string; question_count: number }>(
    `select subject, question_count from public.cbt_subject_availability($1)`,
    [JAMB_REJECTED],
  );
  const english = availability.find((row) => row.subject === 'Use of English');
  assert.equal(english?.question_count, 6, 'the four rejected English items are not part of the bank');

  const { rows } = await db.query<{ ids: string[] }>(
    `select public.plan_cbt_paper($1, array['Use of English'], 10) as ids`,
    [JAMB_REJECTED],
  );
  assert.equal(rows[0].ids.length, 6, 'planning stops at the usable questions');
});

test('practice keeps the student\'s count; a mock keeps the examination\'s', async () => {
  const practice = await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Biology'], 8, 20, 'practice', null)`,
    [WAEC],
  );
  assert.equal(practice.rows[0].total_questions, 8, 'a practice session is the size the student asked for');
  assert.equal(practice.rows[0].duration_minutes, 8, 'and is timed at the paper pace for those 8 questions');

  const mock = await startMock(WAEC, ['Biology'], 5);
  assert.equal(mock.total_questions, 12, 'a mock uses the bank paper at the exam duration');
  assert.equal(mock.duration_minutes, 90);
});

test('the start RPC is closed to a client that is not signed in', async () => {
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await assert.rejects(
    () => db.query(`select * from public.start_cbt_attempt_configured($1, array['Biology'], 8, 20, 'practice', null)`, [WAEC]),
    /Authentication required/,
  );
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [STUDENT]);
});

test('JAMB practice refuses a fifth subject, not just the mock', async () => {
  await assert.rejects(
    () => db.query(
      `select * from public.start_cbt_attempt_configured($1, array['Use of English','Mathematics','Physics','Chemistry','Biology'], 10, null, 'practice', null)`,
      [JAMB_FULL],
    ),
    /Use of English plus three other subjects/,
    'the four-subject rule is a database rule, not a picker detail',
  );
});

test('a JAMB bank created later still carries the mock standard', async () => {
  await db.exec(`
    insert into public.cbt_exams (id,title,exam_body,subject,description,duration_minutes,is_active) values
      ('aaaaaaaa-0000-0000-0000-000000000009','New JAMB bank','JAMB','Multiple subjects','bank',120,true),
      ('bbbbbbbb-0000-0000-0000-000000000009','New WAEC bank','WAEC','Multiple subjects','bank',90,true);
  `);
  const { rows } = await db.query<{ id: string; mock_question_count: number | null; mock_subject_quota: Record<string, number> }>(
    `select id, mock_question_count, mock_subject_quota from public.cbt_exams
      where id in ('aaaaaaaa-0000-0000-0000-000000000009','bbbbbbbb-0000-0000-0000-000000000009')
      order by id`,
  );
  const jamb = rows.find((row) => row.id.startsWith('aaaaaaaa'))!;
  const waec = rows.find((row) => row.id.startsWith('bbbbbbbb'))!;
  assert.equal(jamb.mock_question_count, 180);
  assert.deepEqual(jamb.mock_subject_quota, { english: 60, other: 40 });
  assert.equal(waec.mock_question_count, null, 'no other body is given JAMB rules');
  assert.deepEqual(waec.mock_subject_quota, {});
});
