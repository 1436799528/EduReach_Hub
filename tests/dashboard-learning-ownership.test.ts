import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// Disposable PostgreSQL and synthetic users; not evidence about hosted drift.
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const exam = '33333333-3333-4333-8333-333333333333';
let db: PGlite;

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  await db.exec(`
    insert into auth.users (id,email,raw_user_meta_data) values
      ('${owner}','owner@example.test','{}'::jsonb), ('${other}','other@example.test','{}'::jsonb);
    insert into public.cbt_exams (id,title,exam_body,subject,duration_minutes,is_active)
      values ('${exam}','Synthetic practice','WAEC','Multiple subjects',60,true);
    insert into public.cbt_attempts (user_id,exam_id,status,score,correct_answers,total_questions,subject_plan,selected_subjects)
      values ('${owner}','${exam}','submitted',80,8,10,'[{"subject":"Physics","questions":10}]'::jsonb,array['Physics']),
             ('${other}','${exam}','submitted',50,5,10,'[{"subject":"Biology","questions":10}]'::jsonb,array['Biology']);
  `);
});
after(async () => { if (db) await db.close(); });

test('authenticated role sees only its own subject plans and cannot request another owner', async () => {
  await db.exec('set role authenticated');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    const own = await db.query<{ user_id: string; score: string; subject_plan: unknown }>('select user_id,score,subject_plan from public.cbt_attempts order by created_at desc limit 50');
    assert.equal(own.rows.length, 1);
    assert.equal(own.rows[0].user_id, owner);
    assert.deepEqual(own.rows[0].subject_plan, [{ subject: 'Physics', questions: 10 }]);
    const target = await db.query('select id,subject_plan from public.cbt_attempts where user_id = $1 limit 50', [other]);
    assert.equal(target.rows.length, 0);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
    const reverse = await db.query<{ user_id: string }>('select user_id from public.cbt_attempts where user_id = $1 limit 50', [owner]);
    assert.equal(reverse.rows.length, 0);
  } finally {
    await db.exec('reset role');
  }
});

test('anonymous role cannot select attempts', async () => {
  await db.exec('set role anon');
  try {
    await assert.rejects(db.query('select id,subject_plan from public.cbt_attempts limit 50'), /permission denied/i);
  } finally {
    await db.exec('reset role');
  }
});
