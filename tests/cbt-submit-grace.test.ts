import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// The submission delivery window (20261022093000, widened by 20261025120000):
// a submission that arrives shortly after the countdown reaches zero is
// graded; answers cannot be added after the deadline; and how late an
// accepted submission arrived is recorded. Run against the real functions on
// a real PostgreSQL engine, the same way tests/cbt-modes.test.ts does.

const EXAM = '22222222-2222-2222-2222-222222222222';
const STUDENT = '33333333-3333-3333-3333-333333333333';

let db: PGlite;

async function startAttempt(): Promise<string> {
  const { rows } = await db.query<any>(
    `select * from public.start_cbt_attempt_configured($1, array['Mathematics'], 5, 30, 'practice', null)`,
    [EXAM],
  );
  return rows[0].attempt_id as string;
}

async function expireBy(attemptId: string, secondsAgo: number): Promise<void> {
  await db.query(
    `update public.cbt_attempts set expires_at = now() - ($2 || ' seconds')::interval where id = $1`,
    [attemptId, String(secondsAgo)],
  );
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${STUDENT}','student@example.test','{}'::jsonb);
    insert into public.cbt_exams (id,title,exam_body,subject,description,duration_minutes,is_active) values
      ('${EXAM}','WAEC SSCE Practice Bank','WAEC','Multiple subjects','bank',90,true);
  `);
  const values = Array.from({ length: 10 }, (_, index) => {
    const position = 700 + index;
    return `('${EXAM}'::uuid,'Mathematics','Mathematics question ${position}','Option A','Option B','Option C','Option D','A',1,${position})`;
  }).join(',');
  await db.exec(
    `insert into public.exam_questions (exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values ${values};`,
  );
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [STUDENT]);
});

after(async () => { await db.close(); });

test('the delivery window is 120 seconds', async () => {
  const { rows } = await db.query<{ seconds: number }>(
    `select extract(epoch from public.cbt_submit_grace())::int as seconds`,
  );
  assert.equal(rows[0].seconds, 120);
});

test('a submission inside the window is graded, its lateness is recorded, and a retry is idempotent', async () => {
  const attemptId = await startAttempt();
  await expireBy(attemptId, 60);

  const { rows } = await db.query<any>(
    `select * from public.submit_cbt_attempt_configured($1, '{"1":0,"2":0}'::jsonb)`,
    [attemptId],
  );
  assert.equal(rows[0].total_questions, 5);
  assert.equal(rows[0].correct_answers, 2, 'two correct answers (option A) out of five');
  assert.equal(Number(rows[0].score), 40);

  const { rows: stored } = await db.query<any>(
    `select status, submission_late_ms from public.cbt_attempts where id = $1`,
    [attemptId],
  );
  assert.equal(stored[0].status, 'submitted');
  assert.ok(
    stored[0].submission_late_ms >= 59_000 && stored[0].submission_late_ms <= 66_000,
    `lateness recorded near 60s, got ${stored[0].submission_late_ms}`,
  );

  // A retried submit after a dropped connection returns the stored result.
  const { rows: retry } = await db.query<any>(
    `select * from public.submit_cbt_attempt_configured($1, '{"1":0,"2":0}'::jsonb)`,
    [attemptId],
  );
  assert.equal(Number(retry[0].score), 40, 'the retry returns the same score');
  assert.equal(retry[0].total_questions, 5);
});

test('an on-time submission records zero lateness', async () => {
  const attemptId = await startAttempt();
  const { rows } = await db.query<any>(
    `select * from public.submit_cbt_attempt_configured($1, '{}'::jsonb)`,
    [attemptId],
  );
  assert.equal(rows[0].total_questions, 5);
  const { rows: stored } = await db.query<any>(
    `select submission_late_ms from public.cbt_attempts where id = $1`,
    [attemptId],
  );
  assert.equal(stored[0].submission_late_ms, 0);
});

test('draft saves stop at the deadline, and a submission past the window is refused', async () => {
  const attemptId = await startAttempt();
  await expireBy(attemptId, 60);
  await assert.rejects(
    db.query(`select public.save_cbt_attempt_draft($1, '{"1":1}'::jsonb, 0)`, [attemptId]),
    /expired/i,
    'no answer can be added after the deadline, even inside the delivery window',
  );

  await expireBy(attemptId, 300);
  await assert.rejects(
    db.query(`select * from public.submit_cbt_attempt_configured($1, '{"1":0}'::jsonb)`, [attemptId]),
    /expired/i,
    'five minutes late is past the window',
  );
});
