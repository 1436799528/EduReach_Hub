import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// Isolated candidate protocol only: no hosted database or real student records.
const STUDENT = 'a1111111-1111-4111-8111-111111111111';
const OTHER = 'b1111111-1111-4111-8111-111111111111';
const EXAM = 'c1111111-1111-4111-8111-111111111111';
const ATTEMPT = 'd1111111-1111-4111-8111-111111111111';
const Q1 = 'e1111111-1111-4111-8111-111111111111';
const Q2 = 'e2222222-2222-4222-8222-222222222222';
const K1 = 'f1111111-1111-4111-8111-111111111111';
const K2 = 'f2222222-2222-4222-8222-222222222222';
const K3 = 'f3333333-3333-4333-8333-333333333333';
let db: PGlite;

async function asUser<T>(user: string, run: () => Promise<T>): Promise<T> {
  await db.exec('set role authenticated');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    return await run();
  } finally { await db.exec('reset role'); }
}
async function answer(user: string, question: string, selected: number | null, revision: number, key: string, expected = user) {
  return asUser(user, async () => (await db.query<{ result: any }>(
    'select public.cbt_candidate_answer($1::uuid,$2::uuid,$3::integer,$4::bigint,$5::uuid,$6::uuid) as result',
    [ATTEMPT, question, selected, revision, key, expected],
  )).rows[0].result);
}
async function finish(user: string, revision: number, key: string) {
  return asUser(user, async () => (await db.query<{ result: any }>(
    'select public.cbt_candidate_finalize($1::uuid,$2::bigint,$3::uuid,$4::uuid) as result',
    [ATTEMPT, revision, key, user],
  )).rows[0].result);
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  await db.exec(readFileSync('supabase/candidates/cbt_revision_protocol.sql', 'utf8'));
  await db.exec(`
    insert into auth.users (id,email,raw_user_meta_data) values ('${STUDENT}','a@synthetic.test','{}'),('${OTHER}','b@synthetic.test','{}');
    insert into public.cbt_exams (id,title,exam_body,subject,description,duration_minutes,is_active) values ('${EXAM}','Synthetic test','WAEC','Mathematics','fixture',30,true);
    insert into public.exam_questions (id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values
      ('${Q1}','${EXAM}','Mathematics','Q1','A','B','C','D','A',1,1),
      ('${Q2}','${EXAM}','Mathematics','Q2','A','B','C','D','A',1,2);
    insert into public.cbt_attempts (id,user_id,exam_id,status,expires_at,total_questions,question_ids,answers_draft)
      values ('${ATTEMPT}','${STUDENT}','${EXAM}','in_progress',now()+interval '30 minutes',2,array['${Q1}'::uuid,'${Q2}'::uuid],'{}');
  `);
});
after(async () => { await db.close(); });

test('stale updates conflict and idempotent retries never overwrite a newer answer', async () => {
  const first = await answer(STUDENT, Q1, 0, 0, K1);
  assert.equal(first.outcome, 'accepted');
  assert.equal(first.revision, 1);
  const stale = await answer(STUDENT, Q1, 2, 0, K2);
  assert.equal(stale.outcome, 'conflict');
  assert.equal(stale.revision, 1);
  assert.deepEqual(stale.answers, { '1': 0 });
  await assert.rejects(answer(STUDENT, Q1, 2, 1, K2), /operation key.*different/i, 'a conflict consumes its idempotency key');
  const second = await answer(STUDENT, Q1, 2, 1, 'f6666666-6666-4666-8666-666666666666');
  assert.equal(second.revision, 2);
  const retried = await answer(STUDENT, Q1, 0, 0, K1);
  assert.equal(retried.outcome, 'replayed');
  assert.equal(retried.acceptedRevision, 1);
  assert.equal(retried.revision, 2);
  assert.deepEqual(retried.answers, { '1': 2 });
  await assert.rejects(answer(STUDENT, Q1, 1, 0, K1), /operation key.*different/i);
});

test('account and paper checks reject unauthorized or invalid updates', async () => {
  await assert.rejects(answer(OTHER, Q1, 0, 2, K3, STUDENT), /account changed/i);
  await assert.rejects(answer(OTHER, Q1, 0, 2, K3), /not found/i);
  await assert.rejects(answer(STUDENT, 'e3333333-3333-4333-8333-333333333333', 0, 2, K3), /question.*paper/i);
  await assert.rejects(answer(STUDENT, Q2, 7, 2, K3), /invalid answer/i);
  const otherQuestion = await answer(STUDENT, Q2, 0, 2, 'f5555555-5555-4555-8555-555555555555');
  assert.equal(otherQuestion.revision, 3);
});

test('finalization conflicts on stale revisions and scores accepted server answers once', async () => {
  assert.equal((await finish(STUDENT, 2, K3)).outcome, 'conflict');
  await assert.rejects(finish(STUDENT, 3, K3), /operation key.*different/i);
  const finalKey = 'f7777777-7777-4777-8777-777777777777';
  const completed = await finish(STUDENT, 3, finalKey);
  assert.equal(completed.outcome, 'submitted');
  assert.equal(completed.result.correct_answers, 1, 'the second accepted answer survives finalization');
  assert.equal(completed.result.total_questions, 2);
  const retry = await finish(STUDENT, 3, finalKey);
  assert.equal(retry.outcome, 'replayed');
  assert.deepEqual(retry.result, completed.result);
  const late = await answer(STUDENT, Q2, 0, 2, 'f4444444-4444-4444-8444-444444444444');
  assert.equal(late.outcome, 'closed');
  const replay = await answer(STUDENT, Q1, 0, 0, K1);
  assert.equal(replay.outcome, 'replayed');
  assert.equal(replay.status, 'submitted');
});

test('deadline rejects new answers and finalization uses only accepted answers inside the existing grace', async () => {
  await db.query('delete from public.cbt_attempts where id=$1', [ATTEMPT]);
  await db.query(`insert into public.cbt_attempts (id,user_id,exam_id,status,expires_at,total_questions,question_ids,answers_draft)
    values ($1,$2,$3,'in_progress',now()+interval '30 minutes',2,array[$4::uuid,$5::uuid],'{}')`, [ATTEMPT, STUDENT, EXAM, Q1, Q2]);
  assert.equal((await answer(STUDENT, Q1, 0, 0, K1)).outcome, 'accepted');
  await db.query("update public.cbt_attempts set expires_at=now()-interval '60 seconds' where id=$1", [ATTEMPT]);
  const rejected = await answer(STUDENT, Q2, 0, 1, K2);
  assert.equal(rejected.outcome, 'expired');
  assert.deepEqual(rejected.answers, { '1': 0 });
  const result = await finish(STUDENT, 1, K3);
  assert.equal(result.outcome, 'submitted');
  assert.equal(result.result.correct_answers, 1);
  const stored = await db.query<{ seconds: number }>('select extract(epoch from public.cbt_submit_grace())::int as seconds');
  assert.equal(stored.rows[0].seconds, 120);
});

test('legacy snapshot RPCs and service-role table writes cannot bypass the candidate', async () => {
  for (const role of ['authenticated', 'service_role']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query('select public.save_cbt_attempt_draft($1, $2::jsonb, 0)', [ATTEMPT, '{}']), /permission denied/i);
      await assert.rejects(db.query('select * from public.submit_cbt_attempt_configured($1, $2::jsonb)', [ATTEMPT, '{}']), /permission denied/i);
      await assert.rejects(db.query('select * from public.submit_cbt_attempt($1, $2, $3::jsonb)', [ATTEMPT, EXAM, '{}']), /permission denied/i);
      await assert.rejects(db.query('select * from public.submit_cbt_attempt_for_subjects($1, $2, $3::jsonb)', [ATTEMPT, EXAM, '{}']), /permission denied/i);
      await assert.rejects(db.query("update public.cbt_attempts set answers_draft='{}' where id=$1", [ATTEMPT]), /permission denied/i);
      await assert.rejects(db.query("update public.cbt_answers set selected_option='B' where attempt_id=$1", [ATTEMPT]), /permission denied/i);
      await assert.rejects(db.query('select * from public.cbt_candidate_internal_score($1, $2::jsonb)', [ATTEMPT, '{}']), /permission denied/i);
      await assert.rejects(db.query('select * from public.cbt_candidate_operations'), /permission denied/i);
    } finally { await db.exec('reset role'); }
  }
});

test('old malformed drafts or missing frozen papers are held for review without mutation', async () => {
  const old = 'd2222222-2222-4222-8222-222222222222';
  await db.query(`insert into public.cbt_attempts(id,user_id,exam_id,status,expires_at,total_questions,question_ids,answers_draft)
    values ($1,$2,$3,'in_progress',now()+interval '30 minutes',2,array[$4::uuid,$5::uuid],'{"1":"malformed"}'::jsonb)`, [old, STUDENT, EXAM, Q1, Q2]);
  const candidateAnswer = () => asUser(STUDENT, () => db.query('select public.cbt_candidate_answer($1,$2,0,0,$3,$4)', [old, Q2, K1, STUDENT]));
  const candidateFinish = () => asUser(STUDENT, () => db.query('select public.cbt_candidate_finalize($1,0,$2,$3)', [old, K2, STUDENT]));
  await assert.rejects(candidateAnswer(), /requires review/i);
  await assert.rejects(candidateFinish(), /requires review/i);
  let row = (await db.query<any>('select status,answers_draft,candidate_answer_revision from public.cbt_attempts where id=$1', [old])).rows[0];
  assert.equal(row.status, 'in_progress'); assert.deepEqual(row.answers_draft, { '1': 'malformed' }); assert.equal(Number(row.candidate_answer_revision), 0);
  await db.query("update public.cbt_attempts set answers_draft='{}', question_ids=null where id=$1", [old]);
  await assert.rejects(candidateAnswer(), /requires review/i);
  await assert.rejects(candidateFinish(), /requires review/i);
  row = (await db.query<any>('select status,answers_draft,candidate_answer_revision from public.cbt_attempts where id=$1', [old])).rows[0];
  assert.equal(row.status, 'in_progress'); assert.deepEqual(row.answers_draft, {}); assert.equal(Number(row.candidate_answer_revision), 0);
});

test('anonymous callers and client table access are denied', async () => {
  await db.exec('set role anon');
  try {
    await assert.rejects(db.query('select public.cbt_candidate_answer($1,$2,0,0,$3,$4)', [ATTEMPT, Q1, K1, STUDENT]), /permission denied/i);
  } finally { await db.exec('reset role'); }
  await db.exec('set role authenticated');
  try { await assert.rejects(db.query('select * from public.cbt_candidate_operations'), /permission denied/i); }
  finally { await db.exec('reset role'); }
});
