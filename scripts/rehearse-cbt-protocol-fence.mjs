// Disposable PostgreSQL integration test for the actual protocol-fence migration.
// Run with a clean environment and a separately installed embedded-postgres:
// env -i PATH="$PATH" HOME="$HOME" node scripts/rehearse-cbt-protocol-fence.mjs /tmp/.../embedded-postgres/dist/index.js
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertDisposableDatabase, assertDisposableEnvironment } from './cbt-disposable-safety.mjs';

assertDisposableEnvironment(process.env);
if (!process.argv[2]) throw new Error('Provide the separately installed embedded-postgres module path.');
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = resolve(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'edureach-cbt-fence-'));
if (process.platform !== 'linux' || ((await stat(dir)).mode & 0o077) !== 0) throw new Error('Private Linux socket directory required.');
const pg = new EmbeddedPostgres({ databaseDir: join(dir, 'db'), user: 'postgres', password: randomBytes(24).toString('hex'), port: 5432, persistent: true, autoRehydrateSymlinks: true, postgresFlags: ['-h', '', '-k', dir], onLog: () => {}, onError: () => {} });
const clients = []; let started = false;
try {
  await pg.initialise(); await pg.start(); started = true;
  for (let i = 0; i < 3; i++) {
    const c = pg.getPgClient('postgres', dir); await c.connect(); clients.push(c);
    const identity = (await c.query("select current_setting('data_directory') as data_directory, current_setting('unix_socket_directories') as socket_directories, current_setting('listen_addresses') as listen_addresses, inet_server_addr()::text as server_address, current_database() as database_name")).rows[0];
    assertDisposableDatabase(identity, join(dir, 'db'), dir);
  }
  const [admin, a, b] = clients;
  await admin.query(await readFile(join(root, 'supabase/ci/platform-shims.sql'), 'utf8'));
  const migrationDir = join(root, 'supabase/migrations');
  const fenceFile = '20261107120000_cbt_attempt_protocol_fence.sql';
  const lifecycleFile = '20261107130000_cbt_v2_server_lifecycle.sql';
  const gatewayFile = '20261107140000_cbt_v2_answer_gateway.sql';
  // This is the historical gateway rollback rehearsal, intentionally ending
  // before the lease migration. The separate writing-session harness applies
  // the entire current set and tests the upgraded boundary.
  const files = (await readdir(migrationDir)).filter(f => f.endsWith('.sql') && f <= gatewayFile).sort();
  const fenceIndex = files.indexOf(fenceFile);
  assert.ok(fenceIndex >= 0 && files[fenceIndex + 1] === lifecycleFile && files[fenceIndex + 2] === gatewayFile && files.at(-1) === gatewayFile, 'test must apply the ordered gateway baseline');
  for (const file of files.slice(0, fenceIndex)) await admin.query(await readFile(join(migrationDir, file), 'utf8'));
  const users = ['a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222', 'a3333333-3333-4333-8333-333333333333'];
  const exams = ['c1111111-1111-4111-8111-111111111111', 'c2222222-2222-4222-8222-222222222222', 'c3333333-3333-4333-8333-333333333333'];
  for (let i = 0; i < 3; i++) {
    await admin.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,'{}')", [users[i], `fence-${i}@synthetic.test`]);
    await admin.query("insert into public.cbt_exams(id,title,exam_body,subject,description,duration_minutes,is_active) values ($1,'Synthetic','WAEC','Mathematics','test',30,true)", [exams[i]]);
    for (let position = 1; position <= 6; position++) await admin.query("insert into public.exam_questions(exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values ($1,'Mathematics','Synthetic','A','B','C','D','A',1,$2)", [exams[i], position]);
  }
  const start = (c, exam, count = 5) => c.query("select * from public.start_cbt_attempt_configured($1,array['Mathematics']::text[],$2,null,'practice',null)", [exam, count]).then(r => r.rows[0]);
  const startV2 = (c, exam, count = 5) => c.query("select * from public.cbt_start_attempt_v2($1,array['Mathematics']::text[],$2,null,'practice',null)", [exam, count]).then(r => r.rows[0]);
  await a.query('set role authenticated');
  await a.query("select set_config('request.jwt.claim.sub',$1,false)", [users[0]]);
  const before = await start(a, exams[0]);
  await a.query('reset role');
  const oldRow = (await admin.query('select * from public.cbt_attempts where id=$1', [before.attempt_id])).rows[0];
  await admin.query(await readFile(join(migrationDir, fenceFile), 'utf8'));
  const classified = (await admin.query('select * from public.cbt_attempts where id=$1', [before.attempt_id])).rows[0];
  assert.equal(classified.protocol, 'legacy');
  const { protocol, ...unchanged } = classified; assert.deepEqual(unchanged, oldRow);
  console.log('ok existing attempt classified legacy without changing other data');
  await admin.query(await readFile(join(migrationDir, lifecycleFile), 'utf8'));
  await admin.query(await readFile(join(migrationDir, gatewayFile), 'utf8'));

  // The platform shim does not set BYPASSRLS; test the more privileged
  // service-role case explicitly. The actual hosted role graph is unknown.
  // Grant only this disposable non-superuser login the opt-in client role.
  await admin.query('alter role service_role bypassrls; create role cbt_fence_test_login nologin noinherit; grant authenticated, service_role, cbt_v2_client to cbt_fence_test_login');
  const roleFacts = (await admin.query("select pg_has_role('authenticated','cbt_v2_executor','MEMBER') as a_exec, pg_has_role('service_role','cbt_v2_executor','MEMBER') as s_exec, pg_has_role('cbt_fence_test_login','cbt_v2_executor','MEMBER') as login_exec, has_function_privilege('authenticated','public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text)','execute') as auth_v2, has_function_privilege('service_role','public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text)','execute') as service_v2, has_table_privilege('cbt_v2_client','public.cbt_attempts','update') as v2_table_update")).rows[0];
  assert.deepEqual(roleFacts, { a_exec: false, s_exec: false, login_exec: false, auth_v2: false, service_v2: false, v2_table_update: false });
  const lifecycleGrants = (await admin.query("select has_function_privilege('anon','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as anon_answer, has_function_privilege('authenticated','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as auth_answer, has_function_privilege('service_role','public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)','execute') as service_finish, has_function_privilege('cbt_v2_client','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as client_answer, has_function_privilege('cbt_v2_client','public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)','execute') as client_finish, has_table_privilege('anon','public.cbt_v2_operations','select') as anon_ledger, has_table_privilege('authenticated','public.cbt_v2_operations','select') as auth_ledger, has_table_privilege('cbt_v2_client','public.cbt_v2_operations','select') as client_ledger, has_table_privilege('service_role','public.cbt_v2_operations','select') as service_ledger, (select r.rolname from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid='public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)'::regprocedure and p.prosecdef) as owner")).rows[0];
  assert.deepEqual(lifecycleGrants, { anon_answer: false, auth_answer: false, service_finish: false, client_answer: true, client_finish: true, anon_ledger: false, auth_ledger: false, client_ledger: false, service_ledger: false, owner: 'cbt_v2_executor' });
  const gatewayFacts = (await admin.query("select has_function_privilege('authenticated','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid)','execute') as auth_gateway, has_function_privilege('anon','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid)','execute') as anon_gateway, has_function_privilege('service_role','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid)','execute') as service_gateway, has_function_privilege('cbt_v2_answer_gateway','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as inner_answer, has_function_privilege('cbt_v2_answer_gateway','public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)','execute') as inner_finish, has_function_privilege('cbt_v2_answer_gateway','public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text)','execute') as inner_start, has_function_privilege('cbt_v2_answer_gateway','public.cbt_v2_transition(uuid,text)','execute') as inner_transition, has_table_privilege('cbt_v2_answer_gateway','public.cbt_attempts','select,insert,update,delete') as attempt_table, has_table_privilege('cbt_v2_answer_gateway','public.cbt_v2_operations','select,insert,update,delete') as ledger_table, pg_has_role('authenticated','cbt_v2_answer_gateway','MEMBER') as auth_member, pg_has_role('service_role','cbt_v2_answer_gateway','MEMBER') as service_member, (select not rolcanlogin and not rolinherit from pg_roles where rolname='cbt_v2_answer_gateway') as no_login_inherit, (select p.prosecdef and p.proconfig @> array['search_path=\"\"'] and r.rolname='cbt_v2_answer_gateway' from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid='public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid)'::regprocedure) as wrapper_definer, (select p.prosecdef and p.proconfig @> array['search_path=\"\"'] and r.rolname='cbt_v2_executor' from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid='public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)'::regprocedure) as inner_definer, (select relrowsecurity from pg_class where oid='public.cbt_attempts'::regclass) as attempt_rls, (select relrowsecurity from pg_class where oid='public.cbt_v2_operations'::regclass) as ledger_rls")).rows[0];
  assert.deepEqual(gatewayFacts, { auth_gateway: true, anon_gateway: false, service_gateway: false, inner_answer: true, inner_finish: false, inner_start: false, inner_transition: false, attempt_table: false, ledger_table: false, auth_member: false, service_member: false, no_login_inherit: true, wrapper_definer: true, inner_definer: true, attempt_rls: true, ledger_rls: true });
  for (const c of [a, b]) { await c.query('set session authorization cbt_fence_test_login'); await c.query("set statement_timeout='10s'"); }
  const as = async (c, role, user) => { await c.query('reset role'); await c.query(`set role ${role}`); await c.query("select set_config('request.jwt.claim.sub',$1,false)", [user]); };
  await as(a, 'authenticated', users[0]);
  assert.equal((await start(a, exams[0])).attempt_id, before.attempt_id);
  const describedLegacy = (await a.query("select * from public.cbt_start_attempt_legacy($1,array['Mathematics']::text[],5,null,'practice',null)", [exams[0]])).rows[0];
  assert.equal(describedLegacy.attempt_id, before.attempt_id); assert.equal(describedLegacy.protocol, 'legacy'); assert.equal(describedLegacy.resumed, true);
  await assert.rejects(startV2(a, exams[0]), /permission denied/i);
  await assert.rejects(a.query('set role cbt_v2_executor'), /permission denied/i);
  await as(b, 'cbt_v2_client', users[0]);
  await assert.rejects(b.query('set role cbt_v2_executor'), /permission denied/i);
  await assert.rejects(startV2(b, exams[0]), /protocol mismatch/i);
  for (const action of ['abandon', 'expire', 'delete']) await assert.rejects(b.query('select public.cbt_v2_transition($1,$2)', [before.attempt_id, action]), /protocol mismatch/i);
  assert.equal((await admin.query('select status from public.cbt_attempts where id=$1', [before.attempt_id])).rows[0].status, 'in_progress');
  console.log('ok role graph and v2-to-legacy refusal; ordinary roles cannot create v2');

  // A v1 start and an opt-in v2 start must serialize against one another.
  await as(a, 'authenticated', users[2]); await as(b, 'cbt_v2_client', users[2]);
  const race = await Promise.allSettled([start(a, exams[2]), startV2(b, exams[2])]);
  assert.equal(race.filter(x => x.status === 'fulfilled').length, 1);
  assert.match(race.find(x => x.status === 'rejected').reason.message, /protocol mismatch/i);
  const raceRows = (await admin.query("select protocol,status from public.cbt_attempts where user_id=$1 and exam_id=$2", [users[2], exams[2]])).rows;
  assert.equal(raceRows.length, 1); assert.equal(raceRows[0].status, 'in_progress');
  console.log(`ok simultaneous v1/v2 selection produces one ${raceRows[0].protocol} attempt and refuses the other`);

  await as(a, 'cbt_v2_client', users[1]); await as(b, 'cbt_v2_client', users[1]);
  const v2starts = await Promise.all([startV2(a, exams[1]), startV2(b, exams[1])]);
  assert.equal(v2starts[0].attempt_id, v2starts[1].attempt_id);
  assert.deepEqual(v2starts.map(x => x.resumed).sort(), [false, true]);
  assert.ok(v2starts.every(x => x.protocol === 'v2'));
  const v2 = v2starts[0].attempt_id;
  const originalV2 = (await admin.query('select * from public.cbt_attempts where id=$1', [v2])).rows[0];
  assert.equal(originalV2.protocol, 'v2');
  await as(a, 'cbt_v2_client', users[0]);
  await assert.rejects(a.query("select public.cbt_v2_transition($1,'abandon')", [v2]), /CBT attempt not found/i);
  await as(a, 'cbt_v2_client', users[1]);
  await assert.rejects(a.query("update public.cbt_attempts set status='cancelled' where id=$1", [v2]), /permission denied/i);
  await as(a, 'authenticated', users[1]);
  for (const query of [
    () => start(a, exams[1], 6),
    () => a.query("select * from public.cbt_start_attempt_legacy($1,array['Mathematics']::text[],5,null,'practice',null)", [exams[1]]),
    () => a.query("select * from public.start_cbt_attempt_configured($1,array['Mathematics']::text[],null,null,'mock',null)", [exams[1]]),
    () => a.query('select * from public.start_cbt_attempt($1)', [exams[1]]),
    () => a.query('select * from public.get_cbt_attempt_paper($1)', [v2]),
    () => a.query("select public.save_cbt_attempt_draft($1,'{\"1\":0}'::jsonb,0)", [v2]),
    () => a.query("select * from public.submit_cbt_attempt_configured($1,'{}'::jsonb)", [v2]),
    () => a.query("select * from public.submit_cbt_attempt($1,$2,'{}'::jsonb)", [v2, exams[1]]),
    () => a.query('select public.abandon_cbt_attempt($1)', [v2]),
    () => a.query('select public.cbt_expire_owned_attempt($1)', [v2]),
    () => a.query('select public.delete_cbt_attempt($1)', [v2]),
    () => a.query('select public.delete_cbt_practice_attempt($1)', [v2]),
  ]) await assert.rejects(query(), /protocol mismatch/i);
  await admin.query("select set_config('request.jwt.claim.sub',$1,false)", [users[1]]);
  await assert.rejects(admin.query("select * from public.start_cbt_attempt_for_subjects($1,array['Mathematics']::text[])", [exams[1]]), /protocol mismatch/i);
  await assert.rejects(admin.query("select * from public.submit_cbt_attempt_for_subjects($1,$2,'{}'::jsonb)", [v2, exams[1]]), /protocol mismatch/i);
  // Account deletion cannot silently cascade through an active v2 attempt.
  // This is a known account-deletion integration blocker, not completion.
  await assert.rejects(admin.query('delete from auth.users where id=$1', [users[1]]), /protocol mismatch/i);
  await as(a, 'service_role', users[1]);
  await a.query("select set_config('request.cbt_executor','cbt_v2_executor',false)");
  await assert.rejects(a.query('set role cbt_v2_executor'), /permission denied/i);
  await assert.rejects(a.query("select public.cbt_candidate_answer($1,$2,0,0,$3,$4)", [v2, originalV2.question_ids[0], 'f0000000-0000-4000-8000-000000000001', users[1]]), /permission denied/i);
  await assert.rejects(a.query('select * from public.cbt_v2_operations'), /permission denied/i);
  await assert.rejects(a.query('truncate public.cbt_v2_operations'), /permission denied/i);
  await assert.rejects(a.query("update public.cbt_attempts set status='cancelled' where id=$1", [v2]), /protocol mismatch/i);
  await assert.rejects(a.query("insert into public.cbt_attempts(user_id,exam_id,status,total_questions,protocol) values ($1,$2,'cancelled',5,'v2')", [users[1], exams[1]]), /protocol mismatch/i);
  await assert.rejects(a.query("update public.cbt_attempts set protocol='legacy' where id=$1", [v2]), /immutable/i);
  await assert.rejects(a.query("update public.cbt_attempts set protocol='v2' where id=$1", [before.attempt_id]), /immutable/i);
  const question = originalV2.question_ids[0];
  await assert.rejects(a.query("insert into public.cbt_answers(attempt_id,question_id,selected_option,is_correct) values ($1,$2,'A',true)", [v2, question]), /protocol mismatch/i);
  // Synthetic stored answer fixture inserted as the trusted executor; no v2
  // answer-writing API is implied by this fixture setup.
  await admin.query('set role cbt_v2_executor');
  try { await admin.query("insert into public.cbt_answers(attempt_id,question_id,selected_option,is_correct) values ($1,$2,'A',true)", [v2, question]); }
  finally { await admin.query('reset role'); }
  await assert.rejects(a.query("update public.cbt_answers set selected_option='B' where attempt_id=$1", [v2]), /protocol mismatch/i);
  await assert.rejects(a.query('delete from public.cbt_answers where attempt_id=$1', [v2]), /protocol mismatch/i);
  await assert.rejects(a.query("update public.exam_questions set question_text='changed' where id=$1", [question]), /referenced by a v2/i);
  await assert.rejects(a.query('delete from public.exam_questions where id=$1', [question]), /referenced by a v2/i);
  await assert.rejects(a.query('delete from public.cbt_attempts where id=$1', [v2]), /protocol mismatch/i);
  await assert.rejects(a.query('delete from public.cbt_exams where id=$1', [exams[1]]), /protocol mismatch|referenced by a v2/i);
  for (const table of ['cbt_attempts', 'cbt_answers', 'exam_questions', 'cbt_exams']) {
    await assert.rejects(a.query(`truncate public.${table} cascade`), /Cannot truncate CBT tables|permission denied/i);
  }
  assert.deepEqual((await admin.query('select * from public.cbt_attempts where id=$1', [v2])).rows[0], originalV2);
  console.log('ok concurrent v2 resume, legacy lifecycle and direct service/admin mutations refused without changes');

  // Remove the privileged answer fixture before exercising the real scorer.
  await admin.query('set role cbt_v2_executor');
  try { await admin.query('delete from public.cbt_answers where attempt_id=$1', [v2]); }
  finally { await admin.query('reset role'); }
  await as(a, 'cbt_v2_client', users[0]);
  const key = n => `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const answer = (c, attempt, q, selected, revision, operation, user = users[1]) =>
    c.query('select public.cbt_candidate_answer($1,$2,$3,$4,$5,$6) as r', [attempt, q, selected, revision, operation, user]).then(r => r.rows[0].r);
  const finish = (c, attempt, revision, operation, user = users[1]) =>
    c.query('select public.cbt_candidate_finalize($1,$2,$3,$4) as r', [attempt, revision, operation, user]).then(r => r.rows[0].r);
  const legacyPaper = (await admin.query('select question_ids from public.cbt_attempts where id=$1', [before.attempt_id])).rows[0].question_ids;
  await assert.rejects(answer(a, before.attempt_id, legacyPaper[0], 0, 0, key(1), users[0]), /protocol mismatch/i);
  await assert.rejects(finish(a, before.attempt_id, 0, key(2), users[0]), /protocol mismatch/i);
  await admin.query("select set_config('request.jwt.claim.sub',$1,false)", [users[0]]);
  await assert.rejects(answer(admin, before.attempt_id, legacyPaper[0], 0, 0, key(1), users[0]), /protocol mismatch/i);
  await assert.rejects(finish(admin, before.attempt_id, 0, key(2), users[0]), /protocol mismatch/i);
  await assert.rejects(answer(a, v2, question, 0, 0, key(3), users[0]), /not found/i);
  await as(a, 'cbt_v2_client', users[1]); await as(b, 'cbt_v2_client', users[1]);
  const first = await answer(a, v2, question, 0, 0, key(4));
  assert.equal(first.outcome, 'accepted'); assert.equal(Number(first.revision), 1);
  const duplicate = await answer(b, v2, question, 0, 0, key(4));
  assert.equal(duplicate.outcome, 'replayed'); assert.equal(Number(duplicate.acceptedRevision), 1);
  assert.equal((await answer(b, v2, question, 1, 0, key(5))).outcome, 'conflict');
  await assert.rejects(answer(b, v2, question, 1, 1, key(5)), /operation key.*different/i);
  assert.equal((await answer(a, v2, question, null, 1, key(6))).outcome, 'accepted');
  const competing = await Promise.all([
    answer(a, v2, question, 0, 2, key(7)), answer(b, v2, originalV2.question_ids[1], 0, 2, key(8))
  ]);
  assert.deepEqual(competing.map(x => x.outcome).sort(), ['accepted', 'conflict']);
  assert.ok(competing.every(x => Number(x.revision) === 3));
  const oldReplay = await answer(a, v2, question, 0, 0, key(4));
  assert.equal(oldReplay.outcome, 'replayed'); assert.equal(Number(oldReplay.revision), 3);

  // Hold an accepted answer's row lock while a stale finalizer waits. The
  // finalizer must see the committed revision and never overwrite that answer.
  await a.query('begin');
  assert.equal((await answer(a, v2, question, 1, 3, key(9))).outcome, 'accepted');
  const staleFinal = finish(b, v2, 3, key(10));
  let blocked = false;
  for (let i=0; i<100; i++) {
    if ((await admin.query('select cardinality(pg_blocking_pids($1)) > 0 as blocked', [b.processID])).rows[0].blocked) { blocked=true; break; }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(blocked, 'finalization must wait for the answer row lock');
  await a.query('commit');
  const conflict = await staleFinal; assert.equal(conflict.outcome, 'conflict'); assert.equal(Number(conflict.revision), 4);
  const draft = (await admin.query('select answers_draft from public.cbt_attempts where id=$1', [v2])).rows[0].answers_draft;
  const finalized = await Promise.all([finish(a, v2, 4, key(11)), finish(b, v2, 4, key(11))]);
  assert.deepEqual(finalized.map(x => x.outcome).sort(), ['replayed', 'submitted']);
  const final = finalized.find(x => x.outcome === 'submitted');
  assert.equal(Number(final.result.correct_answers), Object.values(draft).filter(value => value === 0).length);
  assert.equal(Number(final.result.total_questions), 5);
  assert.equal(final.result.breakdown[0].selected, 1);
  assert.equal(final.result.breakdown[0].correct, 0);
  assert.deepEqual(finalized.find(x => x.outcome === 'replayed').result, final.result);
  assert.deepEqual((await finish(a, v2, 4, key(11))).result, final.result);
  assert.equal((await finish(a, v2, 4, key(12))).outcome, 'already_submitted');
  assert.equal((await answer(a, v2, question, 1, 4, key(13))).outcome, 'closed');
  assert.equal((await answer(a, v2, question, 0, 0, key(4))).outcome, 'replayed');
  assert.equal(Number((await admin.query('select count(*) as n from public.cbt_answers where attempt_id=$1', [v2])).rows[0].n), 5);
  console.log('ok actual v2 answers, duplicate/stale/reordered operations, concurrent answers, finalization race, scoring and result replay');

  await as(a, 'authenticated', users[0]);
  await a.query("select public.save_cbt_attempt_draft($1,'{\"1\":0}'::jsonb,0)", [before.attempt_id]);
  const result = (await a.query("select * from public.submit_cbt_attempt_configured($1,'{\"1\":0}'::jsonb)", [before.attempt_id])).rows[0];
  assert.equal(Number(result.correct_answers), 1); assert.equal(Number(result.total_questions), 5);
  assert.deepEqual((await a.query("select * from public.submit_cbt_attempt_configured($1,'{}'::jsonb)", [before.attempt_id])).rows[0], result);
  console.log('ok existing legacy draft, submission, and submitted-result replay');

  await as(b, 'cbt_v2_client', users[1]);
  assert.equal((await b.query("select public.cbt_v2_transition($1,'delete') as state", [v2])).rows[0].state, 'deleted');
  assert.equal(Number((await admin.query('select count(*) as n from public.cbt_v2_operations where attempt_id=$1', [v2])).rows[0].n), 0);
  const grace = await startV2(b, exams[1]);
  const gracePaper = (await admin.query('select question_ids from public.cbt_attempts where id=$1', [grace.attempt_id])).rows[0].question_ids;
  assert.equal((await answer(b, grace.attempt_id, gracePaper[0], 0, 0, key(20))).outcome, 'accepted');
  await admin.query('set role cbt_v2_executor');
  try {
    await assert.rejects(admin.query("update public.cbt_attempts set protocol='legacy' where id=$1", [grace.attempt_id]), /immutable/i);
    await admin.query('begin');
    await admin.query("update public.cbt_attempts set expires_at=clock_timestamp()-interval '60 seconds' where id=$1", [grace.attempt_id]);
    const waitingAnswer = answer(b, grace.attempt_id, gracePaper[1], 0, 1, key(21));
    let blockedAnswer=false;
    for (let i=0; i<100; i++) {
      if ((await admin.query('select cardinality(pg_blocking_pids($1)) > 0 as blocked', [b.processID])).rows[0].blocked) { blockedAnswer=true; break; }
      await new Promise(resolve => setTimeout(resolve,20));
    }
    assert.ok(blockedAnswer, 'answer must wait for the attempt lock');
    await admin.query('commit');
    assert.equal((await waitingAnswer).outcome, 'expired');
  } finally { await admin.query('reset role'); }
  await as(a, 'cbt_v2_client', users[1]);
  await a.query('begin');
  assert.equal((await finish(a, grace.attempt_id, 1, key(22))).outcome, 'submitted');
  const waitingExpiry = b.query("select public.cbt_v2_transition($1,'expire') as state", [grace.attempt_id]);
  let blockedExpiry=false;
  for (let i=0; i<100; i++) {
    if ((await admin.query('select cardinality(pg_blocking_pids($1)) > 0 as blocked', [b.processID])).rows[0].blocked) { blockedExpiry=true; break; }
    await new Promise(resolve => setTimeout(resolve,20));
  }
  assert.ok(blockedExpiry, 'expiry must wait for finalization');
  await a.query('commit');
  assert.equal((await waitingExpiry).rows[0].state, 'submitted');
  await b.query("select public.cbt_v2_transition($1,'delete')", [grace.attempt_id]);
  const corrupt = await startV2(b, exams[1]);
  await admin.query('set role cbt_v2_executor');
  try { await admin.query('update public.cbt_attempts set candidate_answer_revision=1 where id=$1', [corrupt.attempt_id]); }
  finally { await admin.query('reset role'); }
  await assert.rejects(finish(b, corrupt.attempt_id, 1, key(25)), /accepted operation history requires review/i);
  assert.equal((await admin.query('select status from public.cbt_attempts where id=$1', [corrupt.attempt_id])).rows[0].status, 'in_progress');
  await b.query("select public.cbt_v2_transition($1,'delete')", [corrupt.attempt_id]);
  const expiry = await startV2(b, exams[1]);
  assert.equal((await b.query("select public.cbt_v2_transition($1,'expire') as state", [expiry.attempt_id])).rows[0].state, 'in_progress');
  await admin.query('set role cbt_v2_executor');
  try {
    await admin.query('begin');
    await admin.query("update public.cbt_attempts set expires_at=clock_timestamp()-interval '121 seconds' where id=$1", [expiry.attempt_id]);
    const waitingFinal = assert.rejects(finish(b, expiry.attempt_id, 0, key(23)), /expired/i);
    let blockedFinal=false;
    for (let i=0; i<100; i++) {
      if ((await admin.query('select cardinality(pg_blocking_pids($1)) > 0 as blocked', [b.processID])).rows[0].blocked) { blockedFinal=true; break; }
      await new Promise(resolve => setTimeout(resolve,20));
    }
    assert.ok(blockedFinal, 'finalization must wait for the attempt lock');
    await admin.query('commit');
    await waitingFinal;
  } finally { await admin.query('reset role'); }
  assert.equal((await b.query("select public.cbt_v2_transition($1,'expire') as state", [expiry.attempt_id])).rows[0].state, 'expired');
  assert.equal((await b.query("select public.cbt_v2_transition($1,'delete') as state", [expiry.attempt_id])).rows[0].state, 'deleted');
  const next = await startV2(b, exams[1]);
  const nextPaper = (await admin.query('select question_ids from public.cbt_attempts where id=$1', [next.attempt_id])).rows[0].question_ids;
  await a.query('begin');
  assert.equal((await a.query("select public.cbt_v2_transition($1,'abandon') as state", [next.attempt_id])).rows[0].state, 'cancelled');
  const waitingCancelledAnswer = answer(b, next.attempt_id, nextPaper[0], 0, 0, key(27));
  let blockedAbandon=false;
  for (let i=0; i<100; i++) {
    if ((await admin.query('select cardinality(pg_blocking_pids($1)) > 0 as blocked', [b.processID])).rows[0].blocked) { blockedAbandon=true; break; }
    await new Promise(resolve => setTimeout(resolve,20));
  }
  assert.ok(blockedAbandon, 'answer must wait for abandonment');
  await a.query('commit');
  assert.equal((await waitingCancelledAnswer).outcome, 'closed');
  assert.equal((await finish(b, next.attempt_id, 0, key(24))).outcome, 'closed');
  // Raw local Auth-table deletion can bypass a controlled lifecycle for v1.
  // This intentionally demonstrates the existing blocker, not approved erasure.
  const legacyDeletionUser = 'a5555555-5555-4555-8555-555555555555';
  await admin.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,'legacy-deletion@synthetic.test','{}')", [legacyDeletionUser]);
  await as(b, 'authenticated', legacyDeletionUser);
  const legacyDeletionAttempt = await start(b, exams[1]);
  assert.equal((await admin.query('select status from public.cbt_attempts where id=$1', [legacyDeletionAttempt.attempt_id])).rows[0].status, 'in_progress');
  await admin.query('delete from auth.users where id=$1', [legacyDeletionUser]);
  assert.equal(Number((await admin.query('select count(*) as n from public.cbt_attempts where id=$1', [legacyDeletionAttempt.attempt_id])).rows[0].n), 0);
  console.log('observed raw Auth-table delete cascades an active legacy attempt: controlled deletion is NOT implemented');

  const deletionUser = 'a4444444-4444-4444-8444-444444444444';
  await admin.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,'deletion@synthetic.test','{}')", [deletionUser]);
  await as(b, 'cbt_v2_client', deletionUser);
  const deletionAttempt = await startV2(b, exams[1]);
  const deletionPaper = (await admin.query('select question_ids from public.cbt_attempts where id=$1', [deletionAttempt.attempt_id])).rows[0].question_ids;
  assert.equal((await answer(b, deletionAttempt.attempt_id, deletionPaper[0], 0, 0, key(26), deletionUser)).outcome, 'accepted');
  for (let retry = 0; retry < 2; retry++) {
    await assert.rejects(admin.query('delete from auth.users where id=$1', [deletionUser]), /protocol mismatch/i);
    assert.equal(Number((await admin.query('select count(*) as n from auth.users where id=$1', [deletionUser])).rows[0].n), 1);
    assert.equal((await admin.query('select status from public.cbt_attempts where id=$1', [deletionAttempt.attempt_id])).rows[0].status, 'in_progress');
    assert.equal(Number((await admin.query('select count(*) as n from public.cbt_v2_operations where attempt_id=$1', [deletionAttempt.attempt_id])).rows[0].n), 1);
  }
  assert.equal((await b.query("select public.cbt_v2_transition($1,'delete') as state", [deletionAttempt.attempt_id])).rows[0].state, 'deleted');
  assert.equal(Number((await admin.query('select count(*) as n from public.cbt_v2_operations where attempt_id=$1', [deletionAttempt.attempt_id])).rows[0].n), 0);
  await admin.query('delete from auth.users where id=$1', [deletionUser]);
  assert.equal(Number((await admin.query('select count(*) as n from auth.users where id=$1', [deletionUser])).rows[0].n), 0);
  await as(b, 'cbt_v2_client', users[1]);
  console.log('ok v2 expiry/grace, authorized attempt deletion before Auth deletion, abandonment, and protocol immutability');

  // Install the proposed guard only into this disposable database, not into a
  // hosted project or the migration set. Test real cascades under both fences.
  await admin.query(await readFile(join(root, 'supabase/candidates/cbt_active_attempt_auth_deletion_guard.sql'), 'utf8'));
  for (const role of ['anon', 'authenticated', 'service_role', 'cbt_v2_client']) {
    assert.equal((await admin.query("select has_function_privilege($1,'public.cbt_block_auth_delete_with_active_attempt()','execute') as allowed", [role])).rows[0].allowed, false);
  }
  const guardUsers = ['a6666666-6666-4666-8666-666666666666', 'a7777777-7777-4777-8777-777777777777'];
  for (const [index, id] of guardUsers.entries()) {
    await admin.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,'{}')", [id, `guard-${index}@synthetic.test`]);
  }
  await as(a, 'authenticated', guardUsers[0]);
  const guardedLegacy = await start(a, exams[0]);
  await as(b, 'cbt_v2_client', guardUsers[1]);
  const guardedV2 = await startV2(b, exams[1]);
  const guardedPaper = (await admin.query('select question_ids from public.cbt_attempts where id=$1', [guardedV2.attempt_id])).rows[0].question_ids;
  assert.equal((await answer(b, guardedV2.attempt_id, guardedPaper[0], 0, 0, key(30), guardUsers[1])).outcome, 'accepted');
  for (const [index, attempt] of [guardedLegacy, guardedV2].entries()) {
    for (let retry = 0; retry < 2; retry++) {
      await assert.rejects(admin.query('delete from auth.users where id=$1', [guardUsers[index]]), /active CBT attempt requires review/i);
      assert.equal(Number((await admin.query('select count(*) as n from auth.users where id=$1', [guardUsers[index]])).rows[0].n), 1);
      assert.equal((await admin.query('select status from public.cbt_attempts where id=$1', [attempt.attempt_id])).rows[0].status, 'in_progress');
    }
  }
  assert.equal(Number((await admin.query('select count(*) as n from public.cbt_v2_operations where attempt_id=$1', [guardedV2.attempt_id])).rows[0].n), 1);
  await a.query('select public.abandon_cbt_attempt($1)', [guardedLegacy.attempt_id]);
  await admin.query('delete from auth.users where id=$1', [guardUsers[0]]);
  await b.query("select public.cbt_v2_transition($1,'abandon')", [guardedV2.attempt_id]);
  await assert.rejects(admin.query('delete from auth.users where id=$1', [guardUsers[1]]), /protocol mismatch/i);
  await b.query("select public.cbt_v2_transition($1,'delete')", [guardedV2.attempt_id]);
  await admin.query('delete from auth.users where id=$1', [guardUsers[1]]);
  // An Auth delete waiting on a concurrent attempt insert must not miss the
  // newly committed attempt. Only a private-socket monitoring client is added.
  const raceUser = 'a8888888-8888-4888-8888-888888888888';
  await admin.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,'guard-race@synthetic.test','{}')", [raceUser]);
  await as(a, 'authenticated', raceUser);
  await a.query('begin');
  const inserted = await start(a, exams[0]);
  const monitor = pg.getPgClient('postgres', dir); await monitor.connect(); clients.push(monitor);
  const identity = (await monitor.query("select current_setting('data_directory') as data_directory, current_setting('unix_socket_directories') as socket_directories, current_setting('listen_addresses') as listen_addresses, inet_server_addr()::text as server_address, current_database() as database_name")).rows[0];
  assertDisposableDatabase(identity, join(dir, 'db'), dir);
  const waitingDelete = assert.rejects(admin.query('delete from auth.users where id=$1', [raceUser]), /active CBT attempt requires review/i);
  let deleteBlocked = false;
  for (let i = 0; i < 100; i++) {
    if ((await monitor.query('select cardinality(pg_blocking_pids($1)) > 0 as blocked', [admin.processID])).rows[0].blocked) { deleteBlocked = true; break; }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(deleteBlocked, 'Auth delete must wait for the concurrent foreign-key insert');
  await a.query('commit');
  await waitingDelete;
  assert.equal((await monitor.query('select status from public.cbt_attempts where id=$1', [inserted.attempt_id])).rows[0].status, 'in_progress');
  await a.query('select public.abandon_cbt_attempt($1)', [inserted.attempt_id]);
  await admin.query('delete from auth.users where id=$1', [raceUser]);
  await admin.query('drop trigger cbt_block_auth_delete_with_active_attempt on auth.users; drop function public.cbt_block_auth_delete_with_active_attempt()');
  await as(b, 'cbt_v2_client', users[1]);
  console.log('ok proposed Auth guard blocks active legacy and v2 deletion; existing v2 fence remains effective');

  // Safe operational rollback: disable entry with an active v2 attempt,
  // preserve the fence and lifecycle API, drain it, then allow a legacy start.
  const drainV2 = await startV2(b, exams[1]);
  const drainPaper = (await admin.query('select question_ids from public.cbt_attempts where id=$1', [drainV2.attempt_id])).rows[0].question_ids;
  await as(a, 'authenticated', users[1]);
  const gateway = (operation) => a.query('select public.cbt_v2_answer_gateway($1,$2,$3,$4,$5) as r', [drainV2.attempt_id, drainPaper[0], 1, 0, operation]).then(r => r.rows[0].r);
  assert.equal((await gateway(key(31))).outcome, 'accepted');
  const beforeGatewayRollback = {
    attempt: (await admin.query('select * from public.cbt_attempts where id=$1', [drainV2.attempt_id])).rows[0],
    operations: (await admin.query('select * from public.cbt_v2_operations where attempt_id=$1 order by operation_key', [drainV2.attempt_id])).rows,
    legacy: (await admin.query('select * from public.cbt_attempts where id=$1', [before.attempt_id])).rows[0],
  };
  const gatewayRollback = await readFile(join(root, 'supabase/rollbacks/20261107140000_cbt_v2_answer_gateway.sql'), 'utf8');
  await admin.query('grant cbt_v2_answer_gateway to cbt_fence_test_login');
  await assert.rejects(admin.query(gatewayRollback), /answer gateway role has members/i);
  await admin.query('rollback');
  assert.equal((await gateway(key(31))).outcome, 'replayed', 'refused rollback restores the wrapper grant transactionally');
  await admin.query('revoke cbt_v2_answer_gateway from cbt_fence_test_login');
  await admin.query(gatewayRollback);
  assert.equal((await admin.query("select to_regprocedure('public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid)') as fn")).rows[0].fn, null);
  const postRollbackGrants = (await admin.query("select has_function_privilege('authenticated','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as auth_answer, has_function_privilege('service_role','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as service_answer, has_function_privilege('cbt_v2_client','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as restricted_answer, has_function_privilege('cbt_v2_client','public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)','execute') as restricted_finish")).rows[0];
  assert.deepEqual(postRollbackGrants, { auth_answer: false, service_answer: false, restricted_answer: true, restricted_finish: true });
  assert.deepEqual((await admin.query('select * from public.cbt_attempts where id=$1', [drainV2.attempt_id])).rows[0], beforeGatewayRollback.attempt);
  assert.deepEqual((await admin.query('select * from public.cbt_v2_operations where attempt_id=$1 order by operation_key', [drainV2.attempt_id])).rows, beforeGatewayRollback.operations);
  assert.deepEqual((await admin.query('select * from public.cbt_attempts where id=$1', [before.attempt_id])).rows[0], beforeGatewayRollback.legacy);
  await assert.rejects(gateway(key(31)), /does not exist/i);
  await as(a, 'authenticated', users[0]);
  assert.deepEqual((await a.query("select * from public.submit_cbt_attempt_configured($1,'{}'::jsonb)", [before.attempt_id])).rows[0], result);
  await admin.query(await readFile(join(migrationDir, gatewayFile), 'utf8'));
  await as(a, 'authenticated', users[1]);
  assert.equal((await gateway(key(31))).outcome, 'replayed', 'same operation survives rollback and fresh migration application');
  await assert.rejects(admin.query(await readFile(join(migrationDir, gatewayFile), 'utf8')), /answer gateway role already exists/i);
  assert.equal((await gateway(key(31))).outcome, 'replayed', 'duplicate migration refuses without losing existing gateway state');
  assert.deepEqual((await admin.query('select * from public.cbt_attempts where id=$1', [drainV2.attempt_id])).rows[0], beforeGatewayRollback.attempt);
  assert.deepEqual((await admin.query('select * from public.cbt_v2_operations where attempt_id=$1 order by operation_key', [drainV2.attempt_id])).rows, beforeGatewayRollback.operations);
  console.log('ok gateway rollback membership refusal, grants, retained data, legacy replay, reapply and duplicate-install refusal');
  const rollbackSql = await readFile(join(root, 'supabase/rollbacks/20261107120000_cbt_attempt_protocol_fence.sql'), 'utf8');
  const lifecycleRollback = await readFile(join(root, 'supabase/rollbacks/20261107130000_cbt_v2_server_lifecycle.sql'), 'utf8');
  await assert.rejects(admin.query(rollbackSql), /Rollback refused: v2 attempts still exist/i);
  await admin.query('rollback');
  await assert.rejects(admin.query(lifecycleRollback), /Rollback refused: v2 attempts still exist/i);
  await admin.query('rollback');
  await admin.query('revoke execute on function public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text) from cbt_v2_client');
  await assert.rejects(startV2(b, exams[1]), /permission denied/i);
  await as(a, 'authenticated', users[1]);
  await assert.rejects(start(a, exams[1]), /protocol mismatch/i);
  assert.equal((await b.query("select public.cbt_v2_transition($1,'delete') as state", [drainV2.attempt_id])).rows[0].state, 'deleted');
  const rollbackLegacy = await start(a, exams[1]);
  assert.equal((await admin.query('select protocol from public.cbt_attempts where id=$1', [rollbackLegacy.attempt_id])).rows[0].protocol, 'legacy');
  await as(a, 'service_role', users[1]);
  await assert.rejects(a.query("update public.cbt_attempts set protocol='v2' where id=$1", [rollbackLegacy.attempt_id]), /immutable/i);
  console.log('ok operational rollback disables v2 start while preserving legacy and the immutable discriminator');

  // Test the actual destructive rollback only after deliberately deleting all
  // synthetic v2 fixtures and revoking the test role membership. Real v2 data
  // must be retained/drained with separate authorization, never auto-deleted.
  await as(b, 'cbt_v2_client', users[1]);
  assert.equal((await b.query("select public.cbt_v2_transition($1,'delete') as state", [next.attempt_id])).rows[0].state, 'deleted');
  if (raceRows[0].protocol === 'v2') {
    await as(b, 'cbt_v2_client', users[2]);
    const raceId = race.find(x => x.status === 'fulfilled').value.attempt_id;
    await b.query("select public.cbt_v2_transition($1,'delete')", [raceId]);
  }
  await a.query('reset session authorization'); await b.query('reset session authorization');
  await admin.query(await readFile(join(root, 'supabase/rollbacks/20261107140000_cbt_v2_answer_gateway.sql'), 'utf8'));
  await admin.query(lifecycleRollback);
  await assert.rejects(admin.query(rollbackSql), /Rollback refused: protocol roles still have members/i);
  await admin.query('rollback');
  await admin.query('revoke cbt_v2_client from cbt_fence_test_login');
  await admin.query(rollbackSql);
  const column = (await admin.query("select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='cbt_attempts' and column_name='protocol'")).rows[0].n;
  assert.equal(column, 0);
  await a.query('set role authenticated'); await a.query("select set_config('request.jwt.claim.sub',$1,false)", [users[1]]);
  assert.equal((await start(a, exams[1])).attempt_id, rollbackLegacy.attempt_id);
  console.log('ok destructive rollback refused active v2; after synthetic drain it restored legacy schema and resume');
  console.log(`Passed actual protocol and v2 server lifecycle migrations in disposable PostgreSQL after ${files.length} migrations. This does not prove delivery of unregistered offline intents.`);
} finally {
  for (const c of clients) { try { await c.end(); } catch {} }
  if (started) { try { await pg.stop(); } catch {} }
  await rm(dir, { recursive: true, force: true });
}
