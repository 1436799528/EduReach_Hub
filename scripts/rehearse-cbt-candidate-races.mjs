// Disposable local PostgreSQL only. Candidate is NOT integrated or deployable.
// node scripts/rehearse-cbt-candidate-races.mjs /tmp/.../embedded-postgres/dist/index.js
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Provide the separately installed embedded-postgres module path.');
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = resolve(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'edureach-cbt-race-'));
const port = await new Promise((ok, fail) => {
  const server = net.createServer(); server.once('error', fail);
  server.listen(0, '127.0.0.1', () => { const addr = server.address(); if (!addr || typeof addr === 'string') return fail(new Error('No port')); server.close(() => ok(addr.port)); });
});
const pg = new EmbeddedPostgres({ databaseDir: join(dir, 'db'), user: 'postgres', password: randomBytes(24).toString('hex'), port, persistent: true, autoRehydrateSymlinks: true, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
const clients = []; let started = false;
try {
  await pg.initialise(); await pg.start(); started = true;
  for (let i = 0; i < 3; i++) { const c = pg.getPgClient(); await c.connect(); clients.push(c); }
  const [admin, a, b] = clients;
  await admin.query(await readFile(join(root, 'supabase/ci/platform-shims.sql'), 'utf8'));
  const migrationDir = join(root, 'supabase/migrations');
  const files = (await readdir(migrationDir)).filter(file => file.endsWith('.sql')).sort();
  for (const file of files) await admin.query(await readFile(join(migrationDir, file), 'utf8'));
  await admin.query(await readFile(join(root, 'supabase/candidates/cbt_revision_protocol.sql'), 'utf8'));
  const student = 'a1111111-1111-4111-8111-111111111111';
  const exam = 'c1111111-1111-4111-8111-111111111111';
  const attempt = 'd1111111-1111-4111-8111-111111111111';
  const q1 = 'e1111111-1111-4111-8111-111111111111', q2 = 'e2222222-2222-4222-8222-222222222222';
  const k1 = 'f1111111-1111-4111-8111-111111111111', k2 = 'f2222222-2222-4222-8222-222222222222';
  const k3 = 'f3333333-3333-4333-8333-333333333333', k4 = 'f4444444-4444-4444-8444-444444444444';
  const k5 = 'f5555555-5555-4555-8555-555555555555', k6 = 'f6666666-6666-4666-8666-666666666666';
  await admin.query(`insert into auth.users(id,email,raw_user_meta_data) values ($1,'student@synthetic.test','{}')`, [student]);
  await admin.query(`insert into public.cbt_exams(id,title,exam_body,subject,description,duration_minutes,is_active) values ($1,'Synthetic','WAEC','Mathematics','test',30,true)`, [exam]);
  for (const [id, pos] of [[q1, 1], [q2, 2]]) await admin.query(`insert into public.exam_questions(id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values ($1,$2,'Mathematics','Synthetic','A','B','C','D','A',1,$3)`, [id, exam, pos]);
  await admin.query(`insert into public.cbt_attempts(id,user_id,exam_id,status,expires_at,total_questions,question_ids,answers_draft) values ($1,$2,$3,'in_progress',now()+interval '30 minutes',2,array[$4::uuid,$5::uuid],'{}')`, [attempt, student, exam, q1, q2]);
  for (const c of [a, b]) { await c.query('set role authenticated'); await c.query("select set_config('request.jwt.claim.sub',$1,false)", [student]); await c.query("set statement_timeout='10s'"); }
  const answer = (c, q, selected, rev, key) => c.query('select public.cbt_candidate_answer($1,$2,$3,$4,$5,$6) as result', [attempt, q, selected, rev, key, student]).then(r => r.rows[0].result);
  const finish = (c, rev, key) => c.query('select public.cbt_candidate_finalize($1,$2,$3,$4) as result', [attempt, rev, key, student]).then(r => r.rows[0].result);
  await assert.rejects(a.query('select public.save_cbt_attempt_draft($1,$2::jsonb,0)', [attempt, '{}']), /permission denied/i);
  await assert.rejects(a.query('select * from public.submit_cbt_attempt_configured($1,$2::jsonb)', [attempt, '{}']), /permission denied/i);
  await assert.rejects(a.query('select * from public.submit_cbt_attempt($1,$2,$3::jsonb)', [attempt, exam, '{}']), /permission denied/i);
  await assert.rejects(a.query('select * from public.cbt_candidate_internal_score($1,$2::jsonb)', [attempt, '{}']), /permission denied/i);
  await admin.query('set role service_role');
  try {
    await assert.rejects(admin.query("update public.cbt_attempts set answers_draft='{}' where id=$1", [attempt]), /permission denied/i);
    await assert.rejects(admin.query("update public.cbt_answers set selected_option='B' where attempt_id=$1", [attempt]), /permission denied/i);
    await assert.rejects(admin.query('select * from public.cbt_candidate_operations'), /permission denied/i);
  } finally { await admin.query('reset role'); }
  console.log('ok local legacy RPCs and service-role table writes denied');
  async function waitForBlocked() {
    const until = Date.now()+5000;
    while (Date.now()<until) {
      if ((await admin.query('select wait_event_type from pg_stat_activity where pid=$1', [b.processID])).rows[0]?.wait_event_type === 'Lock') return;
      await new Promise(done => setTimeout(done,20));
    }
    throw new Error('Competing session did not acquire a blocking lock');
  }
  await a.query('begin');
  assert.equal((await answer(a, q1, 0, 0, k1)).outcome, 'accepted');
  const duplicate = answer(b, q1, 0, 0, k1); await waitForBlocked(); await a.query('commit');
  assert.equal((await duplicate).outcome, 'replayed');
  assert.equal((await answer(b, q1, 2, 0, k2)).outcome, 'conflict');
  console.log('ok identical concurrent calls replay once; stale competing answer conflicts');
  await a.query('begin');
  assert.equal((await answer(a, q2, 0, 1, k3)).outcome, 'accepted');
  const pendingFinish = finish(b, 1, k4); await waitForBlocked(); await a.query('commit');
  const conflict = await pendingFinish;
  assert.equal(conflict.outcome, 'conflict'); assert.equal(conflict.revision, 2); assert.deepEqual(conflict.answers, { '1': 0, '2': 0 });
  // Model a response lost before a different accepted answer: retrying the
  // original operation must replay, never restore its older snapshot.
  const delayedReplay = await answer(b, q1, 0, 0, k1);
  assert.equal(delayedReplay.outcome, 'replayed');
  assert.equal(delayedReplay.acceptedRevision, 1);
  assert.equal(delayedReplay.revision, 2);
  assert.deepEqual(delayedReplay.answers, { '1': 0, '2': 0 });
  console.log('ok pending accepted answer makes stale finalization conflict; lost-response retry preserves newer draft');
  await a.query('begin');
  const result = await finish(a, 2, k5);
  const duplicateFinish = finish(b, 2, k5); await waitForBlocked(); await a.query('commit');
  const retry = await duplicateFinish;
  assert.equal(result.outcome, 'submitted'); assert.equal(result.result.correct_answers, 2);
  assert.equal(retry.outcome, 'replayed'); assert.deepEqual(retry.result, result.result);
  assert.equal((await answer(b, q1, 3, 2, k6)).outcome, 'closed');
  console.log('ok concurrent finalization replays; both accepted answers scored; late write closed');

  // Each waiting transaction starts before the deadline but obtains the row
  // lock afterwards. PostgreSQL now() is fixed at transaction start, so a
  // time check using now() after the lock does NOT enforce the real boundary.
  await admin.query('delete from public.cbt_attempts where id=$1', [attempt]);
  await admin.query(`insert into public.cbt_attempts(id,user_id,exam_id,status,expires_at,total_questions,question_ids,answers_draft)
    values ($1,$2,$3,'in_progress',clock_timestamp()+interval '3 seconds',2,array[$4::uuid,$5::uuid],'{}')`, [attempt, student, exam, q1, q2]);
  await admin.query('begin');
  await admin.query('select id from public.cbt_attempts where id=$1 for update', [attempt]);
  const afterDeadline = answer(b, q1, 0, 0, k1); await waitForBlocked();
  await admin.query("select pg_sleep(greatest(0,extract(epoch from (expires_at-clock_timestamp()))+0.1)) from public.cbt_attempts where id=$1", [attempt]);
  await admin.query('commit');
  assert.equal((await afterDeadline).outcome, 'expired', 'a lock wait must not extend answer time');
  const savedAfterDeadline = await admin.query('select candidate_answer_revision,answers_draft from public.cbt_attempts where id=$1', [attempt]);
  assert.equal(Number(savedAfterDeadline.rows[0].candidate_answer_revision), 0);
  assert.deepEqual(savedAfterDeadline.rows[0].answers_draft, {});
  console.log('ok blocked answer rejected after deadline without changing draft');

  await admin.query("update public.cbt_attempts set expires_at=clock_timestamp()-interval '117 seconds' where id=$1", [attempt]);
  await admin.query('begin');
  await admin.query('select id from public.cbt_attempts where id=$1 for update', [attempt]);
  const afterGrace = finish(b, 0, k2); await waitForBlocked();
  await admin.query("select pg_sleep(greatest(0,extract(epoch from (expires_at+interval '120 seconds'-clock_timestamp()))+0.1)) from public.cbt_attempts where id=$1", [attempt]);
  await admin.query('commit');
  await assert.rejects(afterGrace, /expired/i, 'a lock wait must not extend submission grace');
  const afterGraceState = await admin.query('select status from public.cbt_attempts where id=$1', [attempt]);
  assert.notEqual(afterGraceState.rows[0].status, 'submitted');
  console.log('ok blocked submission rejected after 120-second grace');

  // Exercise the additive owner expiry function against a simultaneous
  // candidate finalization using real PostgreSQL row locks, never hosted data.
  await admin.query('delete from public.cbt_attempts where id=$1', [attempt]);
  await admin.query(`insert into public.cbt_attempts(id,user_id,exam_id,status,expires_at,total_questions,question_ids,answers_draft)
    values ($1,$2,$3,'in_progress',clock_timestamp()-interval '60 seconds',2,array[$4::uuid,$5::uuid],'{"1":0}')`, [attempt, student, exam, q1, q2]);
  await a.query('begin');
  assert.equal((await finish(a, 0, k1)).outcome, 'submitted');
  const expiryAfterSubmit = b.query('select public.cbt_expire_owned_attempt($1) as status', [attempt]);
  await waitForBlocked(); await a.query('commit');
  assert.equal((await expiryAfterSubmit).rows[0].status, 'submitted');
  console.log('ok owner expiry waits for finalization and cannot overwrite submitted result');

  await admin.query('delete from public.cbt_attempts where id=$1', [attempt]);
  await admin.query(`insert into public.cbt_attempts(id,user_id,exam_id,status,expires_at,total_questions,question_ids,answers_draft)
    values ($1,$2,$3,'in_progress',clock_timestamp()-interval '121 seconds',2,array[$4::uuid,$5::uuid],'{"1":0}')`, [attempt, student, exam, q1, q2]);
  await a.query('begin');
  assert.equal((await a.query('select public.cbt_expire_owned_attempt($1) as status', [attempt])).rows[0].status, 'expired');
  const finalizeAfterExpiry = finish(b, 0, k2); await waitForBlocked(); await a.query('commit');
  assert.equal((await finalizeAfterExpiry).outcome, 'closed');
  assert.deepEqual((await admin.query('select answers_draft from public.cbt_attempts where id=$1', [attempt])).rows[0].answers_draft, { '1': 0 });
  console.log('ok expiry after grace closes before competing finalize and preserves draft');
  console.log(`Passed in disposable PostgreSQL after ${files.length} synthetic migrations. Candidate and legacy writers are not integrated; hosted systems not tested.`);
} finally {
  await Promise.allSettled(clients.map(c => c.end()));
  if (started) await pg.stop();
  await rm(dir, { recursive: true, force: true });
}
