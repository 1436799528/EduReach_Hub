// Disposable local PostgreSQL only. Candidate is NOT integrated or deployable.
// node scripts/rehearse-cbt-candidate-races.mjs /tmp/.../embedded-postgres/dist/index.js
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertDisposableDatabase, assertDisposableEnvironment } from './cbt-disposable-safety.mjs';

// Reject ambient connections, credentials, forwarding and preload configuration
// before even importing the supplied local test module.
assertDisposableEnvironment(process.env);
if (!process.argv[2]) throw new Error('Provide the separately installed embedded-postgres module path.');
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = resolve(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'edureach-cbt-race-'));
if (process.platform !== 'linux' || ((await stat(dir)).mode & 0o077) !== 0) throw new Error('Disposable CBT rehearsal requires a private Linux socket directory.');
// The port number names only the Unix socket; TCP listening is disabled.
const pg = new EmbeddedPostgres({ databaseDir: join(dir, 'db'), user: 'postgres', password: randomBytes(24).toString('hex'), port: 5432, persistent: true, autoRehydrateSymlinks: true, postgresFlags: ['-h', '', '-k', dir], onLog: () => {}, onError: () => {} });
const clients = []; let started = false;
try {
  await pg.initialise(); await pg.start(); started = true;
  for (let i = 0; i < 3; i++) {
    const c = pg.getPgClient('postgres', dir);
    await c.connect(); clients.push(c);
    // Verify each connection before applying migrations or writing fixtures.
    const identity = (await c.query("select current_setting('data_directory') as data_directory, current_setting('unix_socket_directories') as socket_directories, current_setting('listen_addresses') as listen_addresses, inet_server_addr()::text as server_address, current_database() as database_name")).rows[0];
    assertDisposableDatabase(identity, join(dir, 'db'), dir);
  }
  const [admin, a, b] = clients;
  await admin.query(await readFile(join(root, 'supabase/ci/platform-shims.sql'), 'utf8'));
  const migrationDir = join(root, 'supabase/migrations');
  // This is the historical globally-revoking candidate, not the real v2
  // migration, which uses the same RPC names. Test the real migration using
  // rehearse-cbt-protocol-fence.mjs instead.
  const files = (await readdir(migrationDir)).filter(file => file.endsWith('.sql') && file < '20261107130000_cbt_v2_server_lifecycle.sql').sort();
  for (const file of files) await admin.query(await readFile(join(migrationDir, file), 'utf8'));

  // Exercise the actual migrated legacy lifecycle before applying the separate
  // candidate. All data below is synthetic, inside the verified private DB.
  // This is baseline evidence only: no v2 protocol marker exists yet.
  const baselineStudent = 'a9999999-9999-4999-8999-999999999999';
  const baselineExam = 'c9999999-9999-4999-8999-999999999999';
  await admin.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,'baseline@synthetic.test','{}')", [baselineStudent]);
  await admin.query("insert into public.cbt_exams(id,title,exam_body,subject,description,duration_minutes,is_active) values ($1,'Synthetic','WAEC','Mathematics','test',30,true)", [baselineExam]);
  for (let position = 1; position <= 6; position++) {
    await admin.query("insert into public.exam_questions(exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values ($1,'Mathematics','Synthetic','A','B','C','D','A',1,$2)", [baselineExam, position]);
  }
  for (const c of [a, b]) {
    await c.query('set role authenticated');
    await c.query("select set_config('request.jwt.claim.sub',$1,false)", [baselineStudent]);
    await c.query("set statement_timeout='10s'");
  }
  const startLegacy = (client, count) => client.query("select * from public.start_cbt_attempt_configured($1,array['Mathematics']::text[],$2,null,'practice',null)", [baselineExam, count]).then(result => result.rows[0]);
  const simultaneous = await Promise.all([startLegacy(a, 5), startLegacy(b, 5)]);
  assert.equal(simultaneous[0].attempt_id, simultaneous[1].attempt_id, 'same-mode concurrent starts should return the same active attempt');
  assert.deepEqual(simultaneous.map(result => result.resumed).sort(), [false, true]);
  const oldStart = (await a.query('select * from public.start_cbt_attempt($1)', [baselineExam])).rows[0];
  assert.equal(oldStart.attempt_id, simultaneous[0].attempt_id, 'old start can return an existing attempt without a mutation');
  const changed = await startLegacy(a, 6);
  assert.notEqual(changed.attempt_id, oldStart.attempt_id, 'different paper configuration creates a replacement');
  const oldRow = (await admin.query('select status from public.cbt_attempts where id=$1', [oldStart.attempt_id])).rows[0];
  assert.equal(oldRow.status, 'cancelled', 'different configuration cancels the previous active attempt');
  console.log('ok baseline: simultaneous matching starts resume one attempt; old start returns it; changed configuration cancels it');
  // A legacy abandon holds the row lock while a draft save waits. On release,
  // the save must observe the cancelled state rather than change the draft.
  await a.query('begin');
  assert.equal((await a.query('select public.abandon_cbt_attempt($1) as abandoned', [changed.attempt_id])).rows[0].abandoned, true);
  const waitingSave = assert.rejects(b.query("select public.save_cbt_attempt_draft($1,'{\"1\":1}'::jsonb,0)", [changed.attempt_id]), /already been submitted/i);
  await waitForBlocked();
  await a.query('commit');
  await waitingSave;
  const cancelled = (await admin.query('select status, answers_draft from public.cbt_attempts where id=$1', [changed.attempt_id])).rows[0];
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(cancelled.answers_draft, {});
  console.log('ok baseline: concurrent abandon wins the lock and waiting legacy save cannot change the draft');

  // Verify real migrated v1 ownership, scoring and existing privileges before
  // the candidate globally revokes the old paths in this disposable cluster.
  const baselineOther = 'a8888888-8888-4888-8888-888888888888';
  await admin.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,'other@synthetic.test','{}')", [baselineOther]);
  const scored = await startLegacy(a, 5);
  await b.query("select set_config('request.jwt.claim.sub',$1,false)", [baselineOther]);
  await assert.rejects(b.query("select public.save_cbt_attempt_draft($1,'{\"1\":1}'::jsonb,0)", [scored.attempt_id]), /CBT attempt not found/i);
  await assert.rejects(b.query('select * from public.get_cbt_attempt_paper($1)', [scored.attempt_id]), /CBT attempt not found/i);
  await assert.rejects(a.query("update public.cbt_attempts set answers_draft='{}' where id=$1", [scored.attempt_id]), /permission denied/i);
  await a.query("select public.save_cbt_attempt_draft($1,'{\"1\":0}'::jsonb,0)", [scored.attempt_id]);
  const scoredRow = (await a.query("select * from public.submit_cbt_attempt_configured($1,'{\"1\":0}'::jsonb)", [scored.attempt_id])).rows[0];
  assert.equal(Number(scoredRow.correct_answers), 1);
  assert.equal(Number(scoredRow.total_questions), 5);
  assert.equal(Number(scoredRow.score), 20);
  const replayedResult = (await a.query("select * from public.submit_cbt_attempt_configured($1,'{}'::jsonb)", [scored.attempt_id])).rows[0];
  assert.deepEqual(replayedResult, scoredRow, 'legacy submitted result replay must not rescore from a later snapshot');
  await assert.rejects(b.query("select * from public.submit_cbt_attempt_configured($1,'{}'::jsonb)", [scored.attempt_id]), /CBT attempt not found/i);
  const grants = (await admin.query("select has_table_privilege('authenticated','public.cbt_attempts','update') as auth_update, has_table_privilege('service_role','public.cbt_attempts','update') as service_update, has_function_privilege('authenticated','public.save_cbt_attempt_draft(uuid,jsonb,integer)','execute') as legacy_save, has_function_privilege('authenticated','public.submit_cbt_attempt_configured(uuid,jsonb)','execute') as legacy_submit")).rows[0];
  assert.deepEqual(grants, { auth_update: false, service_update: true, legacy_save: true, legacy_submit: true });
  console.log('ok baseline: owner isolation, legacy draft and scored submission/replay, and effective v1 grants');
  for (const c of [a, b]) await c.query('reset role');

  // Probe one unresolved privilege property on real PostgreSQL, without
  // pretending this synthetic table or trigger is the deployable CBT fence.
  // Use a non-superuser session authenticator: SET ROLE from the postgres
  // superuser session alone would falsely permit assuming any role.
  await admin.query(`
    create role cbt_probe_authenticator nologin noinherit;
    create role cbt_probe_executor nologin noinherit;
    grant authenticated, service_role to cbt_probe_authenticator;
    create table public.cbt_probe_role_fence(id integer primary key, protocol integer not null, answer integer);
    insert into public.cbt_probe_role_fence values (1,1,0),(2,2,0);
    grant select, update on public.cbt_probe_role_fence to authenticated, service_role, cbt_probe_executor;
    create function public.cbt_probe_guard() returns trigger language plpgsql as $f$
    begin if old.protocol=2 and current_user <> 'cbt_probe_executor' then raise exception 'v2 probe fence refused'; end if; return new; end $f$;
    create trigger cbt_probe_trigger before update on public.cbt_probe_role_fence for each row execute function public.cbt_probe_guard();
    create function public.cbt_probe_legacy(p integer) returns void language plpgsql security definer set search_path='' as $f$
    begin update public.cbt_probe_role_fence set answer=1 where id=p; end $f$;
    create function public.cbt_probe_v2(p integer) returns void language plpgsql security definer set search_path='' as $f$
    begin update public.cbt_probe_role_fence set answer=2 where id=p; end $f$;
    alter function public.cbt_probe_v2(integer) owner to cbt_probe_executor;
  `);
  await b.query('set session authorization cbt_probe_authenticator');
  try {
    for (const role of ['authenticated', 'service_role']) {
      await b.query(`set role ${role}`);
      await b.query('update public.cbt_probe_role_fence set answer=3 where id=1');
      await assert.rejects(b.query('update public.cbt_probe_role_fence set answer=3 where id=2'), /v2 probe fence refused/);
      await assert.rejects(b.query('select public.cbt_probe_legacy(2)'), /v2 probe fence refused/);
      await assert.rejects(b.query('set role cbt_probe_executor'), /permission denied/i);
      await b.query("select set_config('request.cbt_executor','cbt_probe_executor',false)");
      await assert.rejects(b.query('update public.cbt_probe_role_fence set answer=4 where id=2'), /v2 probe fence refused/);
      await b.query('select public.cbt_probe_v2(2)');
      assert.deepEqual((await b.query('select id,answer from public.cbt_probe_role_fence order by id')).rows, [{ id: 1, answer: 3 }, { id: 2, answer: 2 }]);
      await b.query('reset role');
    }
  } finally { await b.query('reset session authorization'); }
  console.log('ok synthetic role probe: direct and legacy v2 writes and role/GUC impersonation refused; authorized definer succeeds');

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
