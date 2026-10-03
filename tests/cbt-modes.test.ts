import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// CBT-2: student-configured practice and governed mock examinations.
//
// The replay proves the migration applies; these tests *run* the functions the
// student's session depends on, against real rows, on a real PostgreSQL engine:
// paper planning and capacity, per-subject validation, the practice duration the
// student chose becoming the authoritative expiry, mock duration being taken from
// the exam rather than the request, frozen papers, draft persistence, idempotent
// submission, deletion rules and study history.

const JAMB = '11111111-1111-1111-1111-111111111111';
const WAEC = '22222222-2222-2222-2222-222222222222';
const STUDENT = '33333333-3333-3333-3333-333333333333';
const OTHER_STUDENT = '44444444-4444-4444-4444-444444444444';

let db: PGlite;

async function asUser<T>(userId: string, run: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  return run();
}

function insertQuestions(examId: string, subject: string, count: number, offset: number): string {
  const values = Array.from({ length: count }, (_, index) => {
    const position = offset + index;
    return `('${examId}'::uuid,'${subject}','${subject} question ${position}','Option A','Option B','Option C','Option D','A',1,${position})`;
  }).join(',');
  return `insert into public.exam_questions (exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values ${values};`;
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${STUDENT}','student@example.test','{}'::jsonb),
      ('${OTHER_STUDENT}','other@example.test','{}'::jsonb);
  `);
  await db.exec(`
    insert into public.cbt_exams (id,title,exam_body,subject,description,duration_minutes,is_active) values
      ('${JAMB}','JAMB UTME Practice Bank','JAMB','Multiple subjects','bank',120,true),
      ('${WAEC}','WAEC SSCE Practice Bank','WAEC','Multiple subjects','bank',90,true);
  `);
  await db.exec(insertQuestions(JAMB, 'Use of English', 30, 100));
  await db.exec(insertQuestions(JAMB, 'Mathematics', 25, 200));
  await db.exec(insertQuestions(JAMB, 'Physics', 8, 300));
  await db.exec(insertQuestions(JAMB, 'Chemistry', 10, 500));
  await db.exec(insertQuestions(WAEC, 'Biology', 12, 400));
  // The signed-in student for the whole suite; individual tests switch to
  // another account with asUser() to prove the ownership boundary.
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [STUDENT]);
});

after(async () => { await db.close(); });

test('subject availability comes from the real bank, not a static catalogue', async () => {
  const { rows } = await db.query<{ subject: string; question_count: number }>(
    `select subject, question_count from public.cbt_subject_availability($1)`,
    [JAMB],
  );
  const bySubject = Object.fromEntries(rows.map((row) => [row.subject, row.question_count]));
  assert.deepEqual(bySubject, { 'Chemistry': 10, 'Mathematics': 25, 'Physics': 8, 'Use of English': 30 });
  assert.equal(rows.length, 4, 'only subjects that actually have questions are offered');
});

test('planning respects the requested size and per-subject capacity', async () => {
  const { rows } = await db.query<{ ids: string[] }>(
    `select public.plan_cbt_paper($1, array['Mathematics','Physics','Use of English'], 40) as ids`,
    [JAMB],
  );
  const ids = rows[0].ids;
  assert.equal(ids.length, 40, 'a 40-question paper over a 63-question bank is 40 questions');

  // Physics only has 8, so the paper can never take more than 8 from it.
  const { rows: physRows } = await db.query<{ n: number }>(
    `select count(*)::int as n from public.exam_questions where id = any($1::uuid[]) and subject = 'Physics'`,
    [ids],
  );
  assert.ok(physRows[0].n <= 8, `Physics quota exceeded capacity: ${physRows[0].n}`);

  // Asking for more than the bank holds returns the whole bank, not an error.
  const { rows: big } = await db.query<{ ids: string[] }>(
    `select public.plan_cbt_paper($1, array['Mathematics','Physics'], 500) as ids`,
    [JAMB],
  );
  assert.equal(big[0].ids.length, 33, 'the plan is capped by what the bank can supply');
  void 0;

  const { rows: none } = await db.query<{ ids: string[] }>(
    `select public.plan_cbt_paper($1, array['Economics'], 10) as ids`,
    [JAMB],
  );
  assert.deepEqual(none[0].ids, [], 'an uncovered subject plans no questions');
});

test('practice configuration is server-authoritative and freezes the paper', async () => {
  const { rows } = await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Physics','Mathematics'], 20, 45, 'practice', null)`,
    [JAMB],
  );
  const attempt = rows[0];
  assert.equal(attempt.total_questions, 20, 'the requested question count is honoured');
  assert.equal(attempt.duration_minutes, 45, 'the chosen duration is stored on the attempt');
  assert.equal(attempt.mode, 'practice');
  assert.equal(attempt.resumed, false);

  // Expiry must equal start + the student's chosen time, not the exam default.
  const startedAt = new Date(attempt.started_at).getTime();
  const expiresAt = new Date(attempt.expires_at).getTime();
  assert.equal(Math.round((expiresAt - startedAt) / 60000), 45, 'the timer cannot disagree with the configuration');

  assert.equal(attempt.subject_plan.length, 2, 'the plan names each subject block');
  assert.deepEqual(attempt.subject_plan.map((entry: any) => entry.subject), ['Physics', 'Mathematics'], 'subjects keep the order the student chose');
  const planned = attempt.subject_plan.reduce((sum: number, entry: any) => sum + entry.questions, 0);
  assert.equal(planned, 20, 'the plan accounts for every question');
  assert.equal(attempt.subject_plan[0].first, 1);
  assert.equal(attempt.subject_plan[attempt.subject_plan.length - 1].last, 20);

  const paper = await asUser(STUDENT, async () => db.query<any>(
    `select "position", subject, question_text, option_a from public.get_cbt_attempt_paper($1)`,
    [attempt.attempt_id],
  ));
  assert.equal(paper.rows.length, 20);
  assert.equal(paper.rows[0].subject, 'Physics', 'the first question belongs to the first planned subject');
  assert.equal(paper.rows[19].subject, 'Mathematics');
  assert.ok(
    paper.rows.every((row: any) => !('correct_option' in row) && !('explanation' in row)),
    'the paper never carries the answer key',
  );
});

test('an unknown subject fails with the subject named, not a generic message', async () => {
  await assert.rejects(
    () => db.query(`select * from public.start_cbt_attempt_configured($1, array['Mathematics','Economics'], 10, 30, 'practice', null)`, [JAMB]),
    /No questions are available for: Economics/,
  );
});

test('practice limits are validated server-side', async () => {
  await assert.rejects(
    () => db.query(`select * from public.start_cbt_attempt_configured($1, array['Physics'], 5, 999, 'practice', null)`, [JAMB]),
    /Choose a duration between/,
  );
  await assert.rejects(
    () => db.query(`select * from public.start_cbt_attempt_configured($1, array[]::text[], 10, 30, 'practice', null)`, [JAMB]),
    /Choose at least one subject/,
  );
  await assert.rejects(
    () => db.query(`select * from public.start_cbt_attempt_configured($1, array['Physics'], 10, 30, 'cram', null)`, [JAMB]),
    /Unknown CBT mode/,
  );
});

test('mock duration comes from the exam configuration, never from the client', async () => {
  const { rows } = await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Biology'], 5, 999, 'mock', 'Nursing Science')`,
    [WAEC],
  );
  const attempt = rows[0];
  assert.equal(attempt.duration_minutes, 90, "the exam's configured duration wins over the request");
  assert.equal(attempt.mode, 'mock');
  assert.equal(attempt.total_questions, 5, 'a mock may still be a short paper');

  const { rows: stored } = await db.query<{ programme: string }>(
    `select programme from public.cbt_attempts where id = $1`,
    [attempt.attempt_id],
  );
  assert.equal(stored[0].programme, 'Nursing Science', 'the intended programme is recorded with the mock');
});

test('a JAMB mock is the governed four-subject combination', async () => {
  await assert.rejects(
    () => db.query(`select * from public.start_cbt_attempt_configured($1, array['Mathematics','Physics'], 10, null, 'mock', null)`, [JAMB]),
    /Use of English plus three other subjects/,
  );
  const { rows } = await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Use of English','Mathematics','Physics','Chemistry'], 40, null, 'mock', 'Medicine and Surgery')`,
    [JAMB],
  );
  assert.equal(rows[0].duration_minutes, 120, 'the JAMB bank default is used for the mock');
  assert.equal(rows[0].total_questions, 40, 'a governed mock still respects the requested paper size');
  assert.deepEqual(
    rows[0].subject_plan.map((entry: any) => entry.subject),
    ['Use of English', 'Mathematics', 'Physics', 'Chemistry'],
    'the governed combination is planned in the official order',
  );
  await db.query(`select public.delete_cbt_practice_attempt($1)`, [rows[0].attempt_id]).catch(() => undefined);
});

test('draft answers are validated, bounded and persisted for resume', async () => {
  const id = await asUser(STUDENT, async () => (await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Mathematics'], 10, 30, 'practice', null)`,
    [JAMB],
  )).rows[0].attempt_id);

  const { rows } = await asUser(STUDENT, async () => db.query<any>(
    `select public.save_cbt_attempt_draft($1, '{"1":0,"2":3,"3":9,"999":1,"x":2,"4":"1"}'::jsonb, 3) as saved`,
    [id],
  ));
  const saved = rows[0].saved;
  assert.deepEqual(saved.answers, { '1': 0, '2': 3 }, 'out-of-range, non-numeric and unknown positions are dropped');
  assert.equal(saved.questionIndex, 3);

  const { rows: stored } = await db.query<any>(
    `select answers_draft, current_question from public.cbt_attempts where id = $1`,
    [id],
  );
  assert.deepEqual(stored[0].answers_draft, { '1': 0, '2': 3 });
  assert.equal(stored[0].current_question, 3);

  // Another student can neither read nor write this attempt.
  await assert.rejects(
    () => asUser(OTHER_STUDENT, async () => db.query(`select public.save_cbt_attempt_draft($1, '{}'::jsonb, 0)`, [id])),
    /CBT attempt not found/,
  );
  await assert.rejects(
    () => asUser(OTHER_STUDENT, async () => db.query(`select * from public.get_cbt_attempt_paper($1)`, [id])),
    /CBT attempt not found/,
  );
});

test('submission scores the frozen paper and is idempotent on retry', async () => {
  const id = await asUser(STUDENT, async () => (await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Use of English'], 5, 30, 'practice', null)`,
    [JAMB],
  )).rows[0].attempt_id);

  const { rows: paper } = await db.query<any>(`select "position" from public.get_cbt_attempt_paper($1)`, [id]);
  const answers: Record<string, number> = {};
  paper.forEach((row: any) => { answers[String(row.position)] = 0; }); // all correct: seeded key is A

  const first = await asUser(STUDENT, async () => db.query<any>(
    `select * from public.submit_cbt_attempt_configured($1, $2::jsonb)`,
    [id, JSON.stringify(answers)],
  ));
  const result = first.rows[0];
  assert.equal(result.total_questions, 5);
  assert.equal(result.correct_answers, 5);
  assert.equal(Number(result.score), 100);
  assert.equal(result.breakdown.length, 5);
  assert.equal(result.breakdown[0].subject, 'Use of English');
  assert.ok('explanation' in result.breakdown[0], 'explanations are released only after submission');

  const retry = await asUser(STUDENT, async () => db.query<any>(
    `select * from public.submit_cbt_attempt_configured($1, $2::jsonb)`,
    [id, JSON.stringify({})],
  ));
  assert.equal(Number(retry.rows[0].score), 100, 'a retried submit returns the stored result instead of failing');
  assert.equal(retry.rows[0].breakdown.length, 5);

  const { rows: cleared } = await db.query<any>(`select answers_draft, status from public.cbt_attempts where id = $1`, [id]);
  assert.equal(cleared[0].status, 'submitted');
  assert.deepEqual(cleared[0].answers_draft, {}, 'the draft is cleared once it is a result');
});

test('a student can delete practice data but never a mock record', async () => {
  const practiceId = await asUser(STUDENT, async () => (await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Physics'], 5, 20, 'practice', null)`,
    [JAMB],
  )).rows[0].attempt_id);

  const { rows: deleted } = await asUser(STUDENT, async () => db.query<any>(
    `select public.delete_cbt_practice_attempt($1) as ok`, [practiceId],
  ));
  assert.equal(deleted[0].ok, true);
  const { rows: gone } = await db.query<{ n: number }>(`select count(*)::int as n from public.cbt_attempts where id = $1`, [practiceId]);
  assert.equal(gone[0].n, 0, 'practice data is really deleted, not hidden');

  const mockId = await asUser(STUDENT, async () => (await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Biology'], 5, null, 'mock', null)`,
    [WAEC],
  )).rows[0].attempt_id);
  await assert.rejects(
    () => asUser(STUDENT, async () => db.query(`select public.delete_cbt_practice_attempt($1)`, [mockId])),
    /Only practice attempts can be deleted/,
  );

  // Abandoning closes the attempt without destroying the record.
  const { rows: abandoned } = await asUser(STUDENT, async () => db.query<any>(
    `select public.abandon_cbt_attempt($1) as ok`, [mockId],
  ));
  assert.equal(abandoned[0].ok, true);
  const { rows: closed } = await db.query<{ status: string }>(`select status from public.cbt_attempts where id = $1`, [mockId]);
  assert.equal(closed[0].status, 'cancelled');

  // Deleting someone else's practice attempt is refused.
  await assert.rejects(
    () => asUser(OTHER_STUDENT, async () => db.query(`select public.delete_cbt_practice_attempt($1)`, [mockId])),
    /CBT attempt not found/,
  );
});

test('starting a differently configured session supersedes the old one without deleting it', async () => {
  const first = await asUser(STUDENT, async () => (await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Mathematics'], 10, 20, 'practice', null)`,
    [JAMB],
  )).rows[0]);

  const same = await asUser(STUDENT, async () => (await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Mathematics'], 10, 20, 'practice', null)`,
    [JAMB],
  )).rows[0]);
  assert.equal(same.attempt_id, first.attempt_id, 'the same configuration resumes the same paper');
  assert.equal(same.resumed, true, 'and says so, so the UI can explain it');

  const changed = await asUser(STUDENT, async () => (await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Mathematics'], 10, 60, 'practice', null)`,
    [JAMB],
  )).rows[0]);
  assert.notEqual(changed.attempt_id, first.attempt_id, 'a new configuration is a new session');
  const { rows: prior } = await db.query<{ status: string }>(`select status from public.cbt_attempts where id = $1`, [first.attempt_id]);
  assert.equal(prior[0].status, 'cancelled', 'the superseded session is closed, not deleted');
});

test('expired attempts cannot accept drafts or submissions', async () => {
  const id = await asUser(STUDENT, async () => (await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Physics'], 5, 30, 'practice', null)`,
    [JAMB],
  )).rows[0].attempt_id);
  await db.exec(`update public.cbt_attempts set expires_at = now() - interval '1 minute' where id = '${id}'`);

  await assert.rejects(
    () => asUser(STUDENT, async () => db.query(`select public.save_cbt_attempt_draft($1, '{"1":0}'::jsonb, 0)`, [id])),
    /expired/,
  );
  await assert.rejects(
    () => asUser(STUDENT, async () => db.query(`select * from public.submit_cbt_attempt_configured($1, '{}'::jsonb)`, [id])),
    /expired/,
  );
  // The refusal is raised inside the RPC, and PostgreSQL rolls that call back, so
  // the status transition is the server's job (it marks the attempt expired when it
  // maps the error, and the API test asserts that end to end). What SQL guarantees
  // here is that an expired attempt is never scored and never accepts answers.
  const { rows } = await db.query<{ status: string; score: string | null }>(
    `select status, score from public.cbt_attempts where id = $1`, [id],
  );
  assert.equal(rows[0].score, null, 'an expired attempt is never silently scored');
});

test('study history is owner-scoped and carries the configuration', async () => {
  const { rows } = await asUser(STUDENT, async () => db.query<any>(
    `select * from public.get_cbt_attempt_history(50)`,
  ));
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row: any) => row.mode === 'practice' || row.mode === 'mock'));
  const submitted = rows.find((row: any) => row.status === 'submitted');
  assert.ok(submitted, 'a submitted attempt appears in history');
  assert.ok(Array.isArray(submitted.selected_subjects));
  assert.equal(typeof submitted.duration_minutes, 'number');

  const { rows: others } = await asUser(OTHER_STUDENT, async () => db.query<any>(
    `select * from public.get_cbt_attempt_history(50)`,
  ));
  assert.equal(others.length, 0, 'another student sees none of these attempts');
});
