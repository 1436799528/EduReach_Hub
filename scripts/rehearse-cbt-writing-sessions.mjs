// Actual PostgreSQL + actual migrations, disposable private socket only.
// Auth identities/claims here are synthetic SQL test fixtures, NOT real
// Supabase Auth or PostgREST verification.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertDisposableDatabase, assertDisposableEnvironment } from './cbt-disposable-safety.mjs';

assertDisposableEnvironment(process.env);
if (!process.argv[2]) throw new Error('Provide the separately installed embedded-postgres module path.');
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = resolve(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'edureach-cbt-sessions-'));
if (process.platform !== 'linux' || ((await stat(dir)).mode & 0o077) !== 0) throw new Error('Private Linux socket directory required.');
const pg = new EmbeddedPostgres({ databaseDir: join(dir, 'db'), user: 'postgres', password: randomBytes(24).toString('hex'), port: 5432, persistent: true, autoRehydrateSymlinks: true, postgresFlags: ['-h', '', '-k', dir], onLog: () => {}, onError: () => {} });
const clients = []; let started = false;
try {
  await pg.initialise(); await pg.start(); started = true;
  for (let i = 0; i < 4; i++) {
    const c = pg.getPgClient('postgres', dir); await c.connect(); clients.push(c);
    const identity = (await c.query("select current_setting('data_directory') as data_directory, current_setting('unix_socket_directories') as socket_directories, current_setting('listen_addresses') as listen_addresses, inet_server_addr()::text as server_address, current_database() as database_name")).rows[0];
    assertDisposableDatabase(identity, join(dir, 'db'), dir);
  }
  const [admin, a, b, other] = clients;
  await admin.query(await readFile(join(root, 'supabase/ci/platform-shims.sql'), 'utf8'));
  const migrationDir = join(root, 'supabase/migrations');
  const sessionFile = '20261107150000_cbt_single_writing_session.sql';
  const files = (await readdir(migrationDir)).filter(f => f.endsWith('.sql')).sort();
  assert.equal(files.at(-1), sessionFile, 'rehearsal must apply all current migrations');
  for (const file of files) await admin.query(await readFile(join(migrationDir, file), 'utf8'));
  const user = randomUUID(), stranger = randomUUID(), exam = randomUUID(), question = randomUUID(), attempt = randomUUID(), legacy = randomUUID();
  for (const id of [user, stranger]) await admin.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,'{}')", [id, `${id}@synthetic.test`]);
  await admin.query("insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values ($1,'SQL fixture','WAEC','Mathematics',30,true)", [exam]);
  await admin.query("insert into public.exam_questions(id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values ($1,$2,'Mathematics','SQL fixture','A','B','C','D','A',1,1)", [question, exam]);
  await admin.query('set role cbt_v2_executor');
  try { await admin.query("insert into public.cbt_attempts(id,user_id,exam_id,status,total_questions,protocol,question_ids,expires_at) values ($1,$2,$3,'in_progress',1,'v2',array[$4]::uuid[],now()+interval '30 minutes')", [attempt, user, exam, question]); }
  finally { await admin.query('reset role'); }
  await admin.query("insert into public.cbt_attempts(id,user_id,exam_id,status,total_questions,protocol,question_ids,expires_at) values ($1,$2,$3,'in_progress',1,'legacy',array[$4]::uuid[],now()+interval '30 minutes')", [legacy, stranger, exam, question]);
  for (const [c, id] of [[a, user], [b, user], [other, stranger]]) {
    await c.query('set role authenticated');
    await c.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  }
  const session = (c, id, key, takeover) => c.query('select public.cbt_v2_session_gateway($1,$2,$3) as r', [id, key, takeover]).then(x => x.rows[0].r);
  const answer = (c, sessionId, generation, expected, op, selected = 1) => c.query('select public.cbt_v2_answer_gateway($1,$2,$3,$4,$5,$6,$7) as r', [attempt, question, selected, expected, op, sessionId, generation]).then(x => x.rows[0].r);
  const firstKey = randomUUID(), first = await session(a, attempt, firstKey, false);
  assert.equal(first.outcome, 'created'); assert.equal(first.generation, 1);
  assert.equal((await session(a, attempt, firstKey, false)).sessionId, first.sessionId);
  assert.equal((await session(b, attempt, randomUUID(), false)).outcome, 'takeover_required');
  await assert.rejects(session(other, attempt, randomUUID(), true), /attempt not found/i);
  await assert.rejects(session(other, legacy, randomUUID(), true), /protocol mismatch/i);
  const op = randomUUID();
  assert.equal((await answer(a, first.sessionId, first.generation, 0, op)).outcome, 'accepted');
  assert.equal((await answer(a, first.sessionId, first.generation, 0, op)).outcome, 'replayed');
  await assert.rejects(answer(a, first.sessionId, 2, 1, randomUUID()), /no longer active/i);
  await assert.rejects(other.query('select * from public.cbt_v2_writing_sessions'), /permission denied/i);
  await assert.rejects(a.query('select public.cbt_candidate_answer_core($1,$2,1,1,$3,$4)', [attempt, question, randomUUID(), user]), /permission denied/i);
  await assert.rejects(a.query('select public.cbt_candidate_answer_leased($1,$2,1,1,$3,$4,1,$5)', [attempt, question, randomUUID(), first.sessionId, user]), /permission denied/i);
  await assert.rejects(a.query('select public.cbt_candidate_finalize_core($1,1,$2,$3)', [attempt, randomUUID(), user]), /permission denied/i);
  await assert.rejects(a.query('select public.cbt_candidate_finalize_leased($1,1,$2,$3,1,$4)', [attempt, randomUUID(), first.sessionId, user]), /permission denied/i);
  await assert.rejects(a.query('select public.cbt_candidate_answer($1,$2,1,1,$3,$4)', [attempt, question, randomUUID(), user]), /permission denied/i);
  assert.equal((await admin.query("select to_regprocedure('public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid)') as f")).rows[0].f, null);
  const grants = (await admin.query("select has_function_privilege('cbt_v2_client','public.cbt_candidate_answer_core(uuid,uuid,integer,bigint,uuid,uuid)','execute') as client_core, has_function_privilege('cbt_v2_answer_gateway','public.cbt_candidate_answer_core(uuid,uuid,integer,bigint,uuid,uuid)','execute') as gateway_core, has_function_privilege('service_role','public.cbt_candidate_finalize_core(uuid,bigint,uuid,uuid)','execute') as service_finalize, has_function_privilege('authenticated','public.cbt_v2_session_gateway(uuid,uuid,boolean)','execute') as session_auth, has_function_privilege('anon','public.cbt_v2_session_gateway(uuid,uuid,boolean)','execute') as session_anon, (select relrowsecurity from pg_class where oid='public.cbt_v2_writing_sessions'::regclass) as rls")).rows[0];
  assert.deepEqual(grants, { client_core: false, gateway_core: false, service_finalize: false, session_auth: true, session_anon: false, rls: true });
  await admin.query('set role cbt_v2_client');
  try {
    await assert.rejects(admin.query('select public.cbt_candidate_answer($1,$2,1,1,$3,$4)', [attempt, question, randomUUID(), user]), /writing session required/i);
    await assert.rejects(admin.query('select public.cbt_candidate_finalize($1,1,$2,$3)', [attempt, randomUUID(), user]), /finalization unavailable/i);
  } finally { await admin.query('reset role'); }
  console.log('ok ownership, protocol, creation/replay, lease validation and direct privilege denial');

  const keys = [randomUUID(), randomUUID()];
  const taken = await Promise.all([session(a, attempt, keys[0], true), session(b, attempt, keys[1], true)]);
  assert.ok(taken.every(x => x.outcome === 'taken_over'));
  const sessions = (await admin.query("select id,generation,status from public.cbt_v2_writing_sessions where attempt_id=$1 order by generation", [attempt])).rows;
  assert.equal(sessions.length, 3); assert.equal(sessions.filter(s => s.status === 'active').length, 1);
  let winner = taken.find(x => x.sessionId === sessions[2].id);
  const loser = taken.find(x => x.sessionId !== sessions[2].id);
  assert.ok(winner && loser); assert.equal(winner.generation, 3);
  await assert.rejects(answer(a, first.sessionId, first.generation, 1, randomUUID()), /no longer active/i);
  await assert.rejects(answer(b, loser.sessionId, loser.generation, 1, randomUUID()), /no longer active/i);
  assert.equal((await session(a, attempt, firstKey, true)).outcome, 'revoked');
  assert.equal((await answer(a, winner.sessionId, winner.generation, 1, randomUUID(), 2)).outcome, 'accepted');
  const race = await Promise.all([
    answer(a, winner.sessionId, winner.generation, 2, randomUUID(), 0),
    answer(b, winner.sessionId, winner.generation, 2, randomUUID(), 3),
  ]);
  assert.deepEqual(race.map(x => x.outcome).sort(), ['accepted', 'conflict']);
  const saved = (await admin.query('select candidate_answer_revision,answers_draft from public.cbt_attempts where id=$1', [attempt])).rows[0];
  assert.equal(saved.candidate_answer_revision, '3');
  const oldWinner = winner;
  const [takeoverRace, oldWriteRace] = await Promise.allSettled([
    session(b, attempt, randomUUID(), true), answer(a, oldWinner.sessionId, oldWinner.generation, 3, randomUUID(), 2),
  ]);
  assert.equal(takeoverRace.status, 'fulfilled');
  winner = takeoverRace.value; assert.equal(winner.outcome, 'taken_over');
  if (oldWriteRace.status === 'fulfilled') assert.equal(oldWriteRace.value.outcome, 'accepted');
  else assert.match(oldWriteRace.reason.message, /no longer active/i);
  await assert.rejects(answer(a, oldWinner.sessionId, oldWinner.generation, 3, randomUUID()), /no longer active/i);
  const currentRevision = Number((await admin.query('select candidate_answer_revision from public.cbt_attempts where id=$1', [attempt])).rows[0].candidate_answer_revision);
  assert.equal(currentRevision, oldWriteRace.status === 'fulfilled' ? 4 : 3);
  console.log('ok concurrent takeovers and takeover/write race, old-session rejection, idempotency and concurrent revision race');

  // The leased finalizer is not granted to any runtime role. Exercise its SQL
  // serialization under the executor solely as a disposable DB test.
  await other.query('set role cbt_v2_executor');
  await other.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  const finalize = (key, revision, sessionId = winner.sessionId, generation = winner.generation) =>
    other.query('select public.cbt_candidate_finalize_leased($1,$2,$3,$4,$5,$6) as r', [attempt, revision, key, sessionId, generation, user]).then(x => x.rows[0].r);
  await assert.rejects(finalize(randomUUID(), currentRevision, first.sessionId, first.generation), /no longer active/i);
  const firstFinalizeKey = randomUUID();
  const [answerResult, finalizeResult] = await Promise.allSettled([
    answer(a, winner.sessionId, winner.generation, currentRevision, randomUUID(), 0),
    finalize(firstFinalizeKey, currentRevision),
  ]);
  assert.equal(finalizeResult.status, 'fulfilled');
  let finalKey = firstFinalizeKey, finalRevision = currentRevision, finished = finalizeResult.value;
  if (finished.outcome === 'conflict') {
    assert.equal(answerResult.status, 'fulfilled'); assert.equal(answerResult.value.outcome, 'accepted');
    finalKey = randomUUID(); finalRevision = currentRevision + 1;
    finished = await finalize(finalKey, finalRevision);
  } else {
    assert.equal(finished.outcome, 'submitted');
    assert.equal(answerResult.status, 'rejected'); assert.match(answerResult.reason.message, /not active/i);
  }
  assert.equal(finished.outcome, 'submitted');
  const repeat = await finalize(finalKey, finalRevision);
  assert.equal(repeat.outcome, 'replayed');
  assert.deepEqual(repeat.result, finished.result);
  const duplicate = await finalize(randomUUID(), finalRevision);
  assert.equal(duplicate.outcome, 'already_submitted'); assert.deepEqual(duplicate.result, finished.result);
  await assert.rejects(answer(a, winner.sessionId, winner.generation, finalRevision, randomUUID()), /not active/i);
  await other.query('reset role');
  // The v2 fence still blocks an Auth-row cascade in this local database; the
  // full hosted Auth/Storage account lifecycle is a separate unresolved gate.
  await assert.rejects(admin.query('delete from auth.users where id=$1', [user]), /protocol mismatch/i);
  assert.equal(Number((await admin.query('select count(*) as n from public.cbt_v2_writing_sessions where attempt_id=$1', [attempt])).rows[0].n), 4);
  console.log('ok internal-only leased finalization race, post-submit rejection, result replay and SQL Auth-cascade fence');

  // No deadline or grace rule is changed by the lease migration.
  const deadlineExam = randomUUID(), deadlineQuestion = randomUUID(), deadlineAttempt = randomUUID();
  await admin.query("insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values ($1,'Deadline fixture','WAEC','Mathematics',30,true)", [deadlineExam]);
  await admin.query("insert into public.exam_questions(id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values ($1,$2,'Mathematics','SQL fixture','A','B','C','D','A',1,1)", [deadlineQuestion, deadlineExam]);
  await admin.query('set role cbt_v2_executor');
  try { await admin.query("insert into public.cbt_attempts(id,user_id,exam_id,status,total_questions,protocol,question_ids,expires_at) values ($1,$2,$3,'in_progress',1,'v2',array[$4]::uuid[],now()+interval '30 minutes')", [deadlineAttempt, user, deadlineExam, deadlineQuestion]); }
  finally { await admin.query('reset role'); }
  const deadlineSession = await session(a, deadlineAttempt, randomUUID(), false);
  await admin.query('set role cbt_v2_executor');
  try { await admin.query("update public.cbt_attempts set expires_at=clock_timestamp()-interval '1 second' where id=$1", [deadlineAttempt]); }
  finally { await admin.query('reset role'); }
  const expiredAnswer = (await a.query('select public.cbt_v2_answer_gateway($1,$2,0,0,$3,$4,$5) as r', [deadlineAttempt, deadlineQuestion, randomUUID(), deadlineSession.sessionId, deadlineSession.generation])).rows[0].r;
  assert.equal(expiredAnswer.outcome, 'expired');
  await other.query('set role cbt_v2_executor');
  const graceResult = (await other.query('select public.cbt_candidate_finalize_leased($1,0,$2,$3,$4,$5) as r', [deadlineAttempt, randomUUID(), deadlineSession.sessionId, deadlineSession.generation, user])).rows[0].r;
  assert.equal(graceResult.outcome, 'submitted');
  await other.query('reset role');
  await admin.query('set role cbt_v2_executor');
  try { await admin.query('delete from public.cbt_attempts where id=$1', [deadlineAttempt]); } finally { await admin.query('reset role'); }
  const overdueAttempt = randomUUID();
  await admin.query('set role cbt_v2_executor');
  try { await admin.query("insert into public.cbt_attempts(id,user_id,exam_id,status,total_questions,protocol,question_ids,expires_at) values ($1,$2,$3,'in_progress',1,'v2',array[$4]::uuid[],now()+interval '30 minutes')", [overdueAttempt, user, deadlineExam, deadlineQuestion]); }
  finally { await admin.query('reset role'); }
  const overdueSession = await session(a, overdueAttempt, randomUUID(), false);
  await admin.query('set role cbt_v2_executor');
  try { await admin.query("update public.cbt_attempts set expires_at=clock_timestamp()-interval '121 seconds' where id=$1", [overdueAttempt]); }
  finally { await admin.query('reset role'); }
  await other.query('set role cbt_v2_executor');
  await assert.rejects(other.query('select public.cbt_candidate_finalize_leased($1,0,$2,$3,$4,$5)', [overdueAttempt, randomUUID(), overdueSession.sessionId, overdueSession.generation, user]), /expired/i);
  await other.query('reset role');
  assert.equal((await session(a, overdueAttempt, randomUUID(), true)).outcome, 'expired');
  assert.equal((await admin.query('select status from public.cbt_v2_writing_sessions where id=$1', [overdueSession.sessionId])).rows[0].status, 'expired');
  await admin.query('set role cbt_v2_executor');
  try { await admin.query('delete from public.cbt_attempts where id=$1', [overdueAttempt]); } finally { await admin.query('reset role'); }
  await admin.query('delete from public.cbt_exams where id=$1', [deadlineExam]);
  console.log('ok strict answer deadline, unchanged 120-second finalization grace, expired-session status');

  const rollback = await readFile(join(root, 'supabase/rollbacks/20261107150000_cbt_single_writing_session.sql'), 'utf8');
  await assert.rejects(admin.query(rollback), /session history still exists/i);
  await admin.query('rollback');
  assert.ok((await admin.query("select to_regprocedure('public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)') as f")).rows[0].f);
  await admin.query('set role cbt_v2_executor');
  try { await admin.query('delete from public.cbt_attempts where id=$1', [attempt]); } finally { await admin.query('reset role'); }
  await admin.query(rollback);
  assert.ok((await admin.query("select to_regprocedure('public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid)') as f")).rows[0].f);
  assert.equal((await admin.query('select protocol from public.cbt_attempts where id=$1', [legacy])).rows[0].protocol, 'legacy');
  await admin.query(await readFile(join(migrationDir, sessionFile), 'utf8'));
  assert.ok((await admin.query("select to_regprocedure('public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)') as f")).rows[0].f);
  console.log(`ok refusal, rollback and restoration after ${files.length} actual migrations; legacy row preserved`);
  console.log('PASS: real disposable PostgreSQL session rehearsal (synthetic SQL claims; no Auth/PostgREST).');
} finally {
  for (const c of clients) await c.end().catch(() => {});
  if (started) await pg.stop();
  await rm(dir, { recursive: true, force: true });
}
