import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// Known-vulnerability characterization, NOT a restricted-bank security test.
// Uses only synthetic rows in a disposable local PostgreSQL database. Remove or
// invert these assertions when an actual restricted boundary is implemented.
const student = 'bd111111-1111-4111-8111-111111111111';
const exam = 'bd222222-2222-4222-8222-222222222222';
let db: PGlite;

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  await db.exec(`
    insert into auth.users(id,email,raw_user_meta_data)
      values ('${student}','bank-exposure@synthetic.test','{}'::jsonb);
    insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active)
      values ('${exam}','Synthetic shared bank','WAEC','Mathematics',30,true);
    insert into public.exam_questions(exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position)
      select '${exam}','Mathematics','Synthetic question ' || n,'A','B','C','D','A',1,n
      from generate_series(1,5) n;
    set role authenticated;
  `);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [student]);
});
after(async () => { if (db) await db.close(); });

test('direct question table is denied but legacy definer readers disclose an active bank to any authenticated student', async () => {
  await assert.rejects(db.query('select question_text from public.exam_questions'), /permission denied/i);
  const whole = await db.query('select * from public.get_cbt_questions($1)', [exam]);
  const subjects = await db.query("select * from public.get_cbt_questions_for_subjects($1,array['Mathematics'])", [exam]);
  assert.equal(whole.rows.length, 5);
  assert.equal(subjects.rows.length, 5);
});

test('repeat configured submissions expose individual correctness and scores enable a differential oracle', async () => {
  const start = async () => {
    const result = await db.query<{ attempt_id: string }>(
      "select * from public.start_cbt_attempt_configured($1,array['Mathematics'],5,null,'practice',null)", [exam],
    );
    return result.rows[0].attempt_id;
  };
  const submit = async (attempt: string, answers: object) => {
    const result = await db.query<{ attempt_id: string; score: string | number; breakdown: Array<{ correct: number }> }>(
      'select * from public.submit_cbt_attempt_configured($1,$2::jsonb)', [attempt, JSON.stringify(answers)],
    );
    return result.rows[0];
  };
  const first = await submit(await start(), { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
  const second = await submit(await start(), { '1': 1, '2': 0, '3': 0, '4': 0, '5': 0 });
  assert.equal(first.breakdown[0].correct, 0);
  assert.equal(Number(first.score) - Number(second.score), 20,
    'changing only one selected option changes the total score, allowing key inference even if the correction field were hidden');
  const attempts = await db.query<{ score: string | number }>('select score from public.cbt_attempts where user_id=$1 order by score desc', [student]);
  assert.deepEqual(attempts.rows.map(row => Number(row.score)), [100, 80], 'owner-scoped table reads also disclose scores');
  const results = await db.query<{ correct_option: string; explanation: string | null }>('select correct_option,explanation from public.get_cbt_result($1)', [first.attempt_id]);
  assert.equal(results.rows.length, 5);
  assert.ok(results.rows.every(row => row.correct_option === 'A'));
});
