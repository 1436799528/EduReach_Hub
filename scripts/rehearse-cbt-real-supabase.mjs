// Real Auth + PostgREST + PostgreSQL only. Destructive on a dedicated,
// empty, quiesced disposable project: see docs/operations/CBT_REAL_SUPABASE_CHECKLIST.md.
// Never reads .env, creates synthetic claims, installs migrations automatically,
// grants application role membership, or falls back to a compatibility server.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { realSupabaseConfig } from './cbt-real-supabase-safety.mjs';

let stage = 'preflight';
let cfg, db, service, probeCreated = false, examCreated = false, rollbackMayHaveRun = false;
let failure, cleanupFailed = false;
const users = [];
const runId = randomUUID();
const exam = randomUUID(), question = randomUUID(), attempt = randomUUID(), legacy = randomUUID();
const probe = `cbt_test_uid_${runId.replaceAll('-', '')}`;
const op = randomUUID();
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rollbackPath = join(root, 'supabase/rollbacks/20261107150000_cbt_single_writing_session.sql');
const migrationPath = join(root, 'supabase/migrations/20261107150000_cbt_single_writing_session.sql');
const log = text => console.log(`ok ${text}`);
function check(value, message) { if (!value) throw new Error(message); }
function authClient(key) { return createClient(cfg.api, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) }) } }); }
async function request(path, token, body, key = cfg.anonKey) {
  const response = await fetch(`${cfg.api}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return { status: response.status, data };
}
async function rpc(name, token, body) { return request(`/rest/v1/rpc/${name}`, token, body); }
function denied(r) { return (r.status === 401 || r.status === 403 || (r.status === 404 && r.data?.code === 'PGRST202')); }
async function reload() { await db.query("notify pgrst, 'reload schema'"); }
async function awaitRpc(name, token, body, expected) {
  const until = Date.now() + 15000;
  let r;
  do {
    r = await rpc(name, token, body);
    if (expected(r)) return r;
    await new Promise(resolve => setTimeout(resolve, 500));
  } while (Date.now() < until);
  throw new Error(`PostgREST schema cache did not reach expected state for ${name}.`);
}
async function state() {
  return (await db.query(`select
    (select row_to_json(a) from public.cbt_attempts a where id=$1) as attempt,
    (select coalesce(jsonb_agg(to_jsonb(o) order by operation_key),'[]'::jsonb) from public.cbt_v2_operations o where attempt_id=$1) as operations,
    (select row_to_json(a) from public.cbt_attempts a where id=$2) as legacy`, [attempt, legacy])).rows[0];
}
async function checkExclusive(expectedUsers, expectedAttempts) {
  const r = (await db.query(`select
    (select count(*)::int from auth.users) as users,
    (select count(*)::int from public.cbt_attempts) as attempts,
    (select count(*)::int from public.cbt_v2_operations where attempt_id<>$1) as foreign_operations`, [attempt])).rows[0];
  check(r.users === expectedUsers && r.attempts === expectedAttempts && r.foreign_operations === 0, 'database is not an empty, exclusive disposable environment.');
}

try {
  cfg = realSupabaseConfig(process.env);
  stage = 'load PostgreSQL driver';
  const pg = await import(pathToFileURL(cfg.pgModule).href);
  const Client = pg.Client || pg.default?.Client;
  check(typeof Client === 'function', 'pg Client not found in the supplied module.');
  stage = 'database identity and migration preflight';
  db = new Client({ connectionString: cfg.databaseUrl, connectionTimeoutMillis: 10000, statement_timeout: 15000, application_name: 'edureach_cbt_real_disposable_rehearsal' });
  await db.connect();
  const identity = (await db.query("select current_database() as database, system_identifier::text as system_id from pg_control_system()" )).rows[0];
  check(identity.database === 'postgres' && identity.system_id === cfg.systemId, 'database name or independently recorded system identifier does not match.');
  const migrationFiles = (await readdir(join(root, 'supabase/migrations'))).filter(name => name.endsWith('.sql'));
  check(migrationFiles.length > 0 && migrationFiles.every(name => /^\d+_.+\.sql$/.test(name)) && ['20261107120000_cbt_attempt_protocol_fence.sql', '20261107130000_cbt_v2_server_lifecycle.sql', '20261107140000_cbt_v2_answer_gateway.sql', '20261107150000_cbt_single_writing_session.sql'].every(name => migrationFiles.includes(name)), 'local migration filenames cannot be reconciled.');
  const versions = [...new Set(migrationFiles.map(name => name.split('_', 1)[0]))];
  const ledger = (await db.query('select version from supabase_migrations.schema_migrations where version = any($1::text[])', [versions])).rows.map(row => row.version);
  check(new Set(ledger).size === versions.length, 'required migration version missing from the Supabase migration ledger.');
  const grants = (await db.query(`select
    has_function_privilege('authenticated','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)','execute') as wrapper_auth,
    has_function_privilege('anon','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)','execute') as wrapper_anon,
    has_function_privilege('service_role','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)','execute') as wrapper_service,
    has_function_privilege('authenticated','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as answer_auth,
    has_function_privilege('anon','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as answer_anon,
    has_function_privilege('service_role','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as answer_service,
    has_function_privilege('authenticated','public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)','execute') as finish_auth,
    has_function_privilege('anon','public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)','execute') as finish_anon,
    has_function_privilege('service_role','public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)','execute') as finish_service,
    has_function_privilege('cbt_v2_client','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as restricted_answer,
    has_function_privilege('cbt_v2_client','public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)','execute') as restricted_finish,
    has_function_privilege('authenticated','public.cbt_v2_session_gateway(uuid,uuid,boolean)','execute') as session_auth,
    has_function_privilege('anon','public.cbt_v2_session_gateway(uuid,uuid,boolean)','execute') as session_anon,
    has_function_privilege('authenticated','public.cbt_candidate_answer_leased(uuid,uuid,integer,bigint,uuid,uuid,bigint,uuid)','execute') as leased_auth,
    has_function_privilege('authenticated','public.cbt_candidate_finalize_leased(uuid,bigint,uuid,uuid,bigint,uuid)','execute') as final_auth,
    has_function_privilege('service_role','public.cbt_candidate_finalize_leased(uuid,bigint,uuid,uuid,bigint,uuid)','execute') as final_service,
    has_function_privilege('cbt_v2_answer_gateway','public.cbt_candidate_finalize_leased(uuid,bigint,uuid,uuid,bigint,uuid)','execute') as final_gateway,
    (select count(*)::int from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname in ('cbt_v2_client','cbt_v2_executor','cbt_v2_answer_gateway')) as members,
    (select p.prosecdef and p.proconfig @> array['search_path=""'] and r.rolname='cbt_v2_answer_gateway' from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid='public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)'::regprocedure) as definer`)).rows[0];
  assert.deepEqual(grants, { wrapper_auth: true, wrapper_anon: false, wrapper_service: false, answer_auth: false, answer_anon: false, answer_service: false, finish_auth: false, finish_anon: false, finish_service: false, restricted_answer: true, restricted_finish: true, session_auth: true, session_anon: false, leased_auth: false, final_auth: false, final_service: false, final_gateway: false, members: 0, definer: true });
  await checkExclusive(0, 0);
  // SET ROLE is needed for the fixture and cleanup. It must not involve any
  // permanent membership grant; the operator's disposable admin must qualify.
  await db.query('begin');
  try { await db.query('set local role cbt_v2_executor'); await db.query('rollback'); }
  catch (e) { await db.query('rollback'); throw e; }
  log('database identity, migration ledger, grants and empty-project checks');

  stage = 'Auth and PostgREST availability';
  const health = await request('/auth/v1/health', cfg.anonKey);
  const schema = await request('/rest/v1/', cfg.anonKey);
  check(health.status === 200 && schema.status === 200 && (schema.data?.swagger || schema.data?.openapi), 'real Auth health or PostgREST OpenAPI endpoint unavailable.');
  service = authClient(cfg.serviceKey);
  log('Auth health and PostgREST OpenAPI available');

  stage = 'real signup, confirmation and login';
  for (let i = 0; i < 2; i++) {
    const client = authClient(cfg.anonKey);
    const email = `cbt-real-${runId}-${i}@example.invalid`;
    const password = randomBytes(32).toString('base64url');
    const signup = await client.auth.signUp({ email, password });
    check(!signup.error && signup.data.user?.id, 'Auth signup failed (configure safe disposable email handling).');
    const id = signup.data.user.id;
    users.push({ id, email, client });
    const linked = (await db.query('select email from auth.users where id=$1', [id])).rows[0];
    check(linked?.email?.toLowerCase() === email, 'Auth signup user is absent from the identified database; API and DB do not match.');
    const confirmed = await service.auth.admin.updateUserById(id, { email_confirm: true });
    check(!confirmed.error && confirmed.data.user?.id === id, 'service key cannot confirm disposable Auth user.');
    const login = await client.auth.signInWithPassword({ email, password });
    check(!login.error && login.data.user?.id === id && login.data.session?.access_token, 'real Auth login failed.');
    users[i].token = login.data.session.access_token;
    const verified = await client.auth.getUser(users[i].token);
    check(!verified.error && verified.data.user?.id === id, 'Auth did not verify issued JWT.');
  }
  const jwtParts = users[0].token.split('.');
  check(jwtParts.length === 3 && jwtParts[2].length > 2, 'Auth did not issue a signed JWT.');
  jwtParts[2] = (jwtParts[2][0] === 'A' ? 'B' : 'A') + jwtParts[2].slice(1);
  const forged = jwtParts.join('.');
  const forgedAuth = await users[0].client.auth.getUser(forged);
  check(!!forgedAuth.error, 'Auth accepted a tampered JWT.');
  const forgedRest = await request('/rest/v1/cbt_attempts?select=id&limit=1', forged);
  check(forgedRest.status === 401, 'PostgREST did not reject a tampered JWT with 401.');
  log('real signup, DB-linked identities, sign-in and JWT tamper rejection');

  stage = 'PostgREST auth.uid and fixture setup';
  // A temporary observer only; it does not replace or emulate an application RPC.
  await db.query('begin');
  try {
    await db.query(`create function public.${probe}() returns jsonb language sql stable security invoker set search_path='' as $$ select jsonb_build_object('uid',auth.uid(),'role',current_user) $$`);
    await db.query(`revoke all on function public.${probe}() from public, anon, authenticated, service_role`);
    await db.query(`grant execute on function public.${probe}() to authenticated, service_role`);
    await db.query('commit'); probeCreated = true;
  } catch (e) { await db.query('rollback'); throw e; }
  await reload();
  for (const user of users) {
    const uid = await awaitRpc(probe, user.token, {}, r => r.status === 200);
    check(uid.data?.uid === user.id && uid.data?.role === 'authenticated', 'PostgREST JWT identity does not match Auth and PostgreSQL.');
  }
  const serviceIdentity = await request(`/rest/v1/rpc/${probe}`, cfg.serviceKey, {}, cfg.serviceKey);
  check(serviceIdentity.status === 200 && serviceIdentity.data?.role === 'service_role', 'service key does not produce the PostgREST service_role.');
  const noToken = await rpc(probe, cfg.anonKey, {});
  check(denied(noToken), 'anonymous caller could execute the identity observer.');
  await db.query("insert into public.cbt_exams(id,title,exam_body,subject,description,duration_minutes,is_active) values ($1,'Disposable CBT fixture','WAEC','Mathematics','temporary integration fixture',30,true)", [exam]);
  examCreated = true;
  await db.query("insert into public.exam_questions(id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values ($1,$2,'Mathematics','Disposable fixture','A','B','C','D','A',1,1)", [question, exam]);
  await db.query('begin');
  try {
    await db.query('set local role cbt_v2_executor');
    await db.query("insert into public.cbt_attempts(id,user_id,exam_id,status,total_questions,protocol,question_ids,expires_at) values ($1,$2,$3,'in_progress',1,'v2',array[$4]::uuid[],clock_timestamp()+interval '30 minutes')", [attempt, users[0].id, exam, question]);
    await db.query('commit');
  } catch (e) { await db.query('rollback'); throw e; }
  await db.query("insert into public.cbt_attempts(id,user_id,exam_id,status,total_questions,protocol,question_ids,expires_at) values ($1,$2,$3,'in_progress',1,'legacy',array[$4]::uuid[],clock_timestamp()+interval '30 minutes')", [legacy, users[1].id, exam, question]);
  log('actual PostgREST auth.uid equals each real authenticated user');

  stage = 'real session acquisition and answer gateway';
  const sessionKey = randomUUID();
  const initialSession = await rpc('cbt_v2_session_gateway', users[0].token, { p_attempt: attempt, p_request_key: sessionKey, p_takeover: false });
  check(initialSession.status === 200 && initialSession.data?.outcome === 'created' && typeof initialSession.data?.sessionId === 'string' && initialSession.data?.generation === 1, 'real session acquisition failed.');
  const sessionReplay = await rpc('cbt_v2_session_gateway', users[0].token, { p_attempt: attempt, p_request_key: sessionKey, p_takeover: false });
  check(sessionReplay.status === 200 && sessionReplay.data?.outcome === 'resumed' && sessionReplay.data?.sessionId === initialSession.data.sessionId, 'real session retry failed.');
  const requiresTakeover = await rpc('cbt_v2_session_gateway', users[0].token, { p_attempt: attempt, p_request_key: randomUUID(), p_takeover: false });
  check(requiresTakeover.status === 200 && requiresTakeover.data?.outcome === 'takeover_required', 'a second session was not blocked.');
  const crossSession = await rpc('cbt_v2_session_gateway', users[1].token, { p_attempt: attempt, p_request_key: randomUUID(), p_takeover: true });
  check(crossSession.status >= 400 && crossSession.data?.message === 'CBT attempt not found.', 'cross-user takeover was not rejected.');
  const args = { p_attempt: attempt, p_question: question, p_selected: 1, p_expected_revision: 0, p_operation_key: op, p_session: initialSession.data.sessionId, p_generation: initialSession.data.generation };
  const answer = await rpc('cbt_v2_answer_gateway', users[0].token, args);
  check(answer.status === 200 && answer.data?.outcome === 'accepted' && answer.data?.revision === 1 && answer.data?.answers?.['1'] === 1, 'gateway failed to accept the owned answer.');
  const replay = await rpc('cbt_v2_answer_gateway', users[0].token, args);
  check(replay.status === 200 && replay.data?.outcome === 'replayed' && replay.data?.revision === 1, 'duplicate answer did not replay.');
  const takeover = await rpc('cbt_v2_session_gateway', users[0].token, { p_attempt: attempt, p_request_key: randomUUID(), p_takeover: true });
  check(takeover.status === 200 && takeover.data?.outcome === 'taken_over' && takeover.data?.generation === 2 && takeover.data?.sessionId !== initialSession.data.sessionId, 'real session takeover failed.');
  const oldSession = await rpc('cbt_v2_session_gateway', users[0].token, { p_attempt: attempt, p_request_key: sessionKey, p_takeover: false });
  check(oldSession.status === 200 && oldSession.data?.outcome === 'revoked' && oldSession.data?.sessionId === initialSession.data.sessionId, 'revoked session resumed.');
  const revoked = await rpc('cbt_v2_answer_gateway', users[0].token, { ...args, p_expected_revision: 1, p_operation_key: randomUUID() });
  check(revoked.status >= 400 && revoked.data?.message === 'CBT writing session is no longer active.', 'revoked session could write.');
  const stale = await rpc('cbt_v2_answer_gateway', users[0].token, { ...args, p_session: takeover.data.sessionId, p_generation: takeover.data.generation, p_selected: 2, p_operation_key: randomUUID() });
  check(stale.status === 200 && stale.data?.outcome === 'conflict' && stale.data?.revision === 1 && stale.data?.answers?.['1'] === 1, 'stale revision was not rejected.');
  const legacySave = await rpc('save_cbt_attempt_draft', users[1].token, { p_attempt_id: legacy, p_answers: { '1': 0 } });
  check(legacySave.status === 200, 'legacy draft save failed.');
  const legacyOnV2 = await rpc('save_cbt_attempt_draft', users[0].token, { p_attempt_id: attempt, p_answers: { '1': 0 } });
  check(legacyOnV2.status >= 400 && legacyOnV2.data?.message === 'CBT protocol mismatch.', 'legacy writer was not rejected for v2.');
  const beforeDenials = await state();
  check(beforeDenials.attempt?.status === 'in_progress' && beforeDenials.operations.length === 2, 'unexpected attempt or ledger state.');
  const cross = await rpc('cbt_v2_answer_gateway', users[1].token, { ...args, p_expected_revision: 1, p_operation_key: randomUUID() });
  check(cross.status >= 400 && cross.data?.message === 'CBT attempt not found.', 'cross-user access was not rejected by ownership check.');
  const spoof = await rpc('cbt_v2_answer_gateway', users[1].token, { ...args, p_expected_revision: 1, p_operation_key: randomUUID(), p_expected_user: users[0].id });
  check(spoof.status === 404 && spoof.data?.code === 'PGRST202', 'caller-supplied owner was not rejected at the gateway signature.');
  const anon = await rpc('cbt_v2_answer_gateway', cfg.anonKey, args);
  check(denied(anon), 'anonymous caller could invoke the answer gateway.');
  const serviceGateway = await request('/rest/v1/rpc/cbt_v2_answer_gateway', cfg.serviceKey, args, cfg.serviceKey);
  check(denied(serviceGateway), 'service role could invoke the answer gateway.');
  for (const [name, body] of [
    ['cbt_candidate_answer', { p_attempt: attempt, p_question: question, p_selected: 1, p_expected_revision: 1, p_operation_key: randomUUID(), p_expected_user: users[0].id }],
    ['cbt_candidate_answer_leased', { ...args, p_expected_user: users[0].id }],
    ['cbt_candidate_answer_core', { p_attempt: attempt, p_question: question, p_selected: 1, p_expected_revision: 1, p_operation_key: randomUUID(), p_expected_user: users[0].id }],
    ['cbt_candidate_finalize', { p_attempt: attempt, p_expected_revision: 1, p_operation_key: randomUUID(), p_expected_user: users[0].id }],
    ['cbt_candidate_finalize_leased', { p_attempt: attempt, p_expected_revision: 1, p_operation_key: randomUUID(), p_session: takeover.data.sessionId, p_generation: takeover.data.generation, p_expected_user: users[0].id }],
    ['cbt_candidate_finalize_core', { p_attempt: attempt, p_expected_revision: 1, p_operation_key: randomUUID(), p_expected_user: users[0].id }],
  ]) {
    const result = await rpc(name, users[0].token, body);
    check(denied(result), `authenticated caller could invoke internal ${name}.`);
    const serviceResult = await request(`/rest/v1/rpc/${name}`, cfg.serviceKey, body, cfg.serviceKey);
    check(denied(serviceResult), `service role could invoke internal ${name}.`);
  }
  assert.deepEqual(await state(), beforeDenials);
  log('gateway ownership, spoofing, replay, stale revision and internal finalization denial');

  stage = 'writing-session rollback refusal';
  await checkExclusive(2, 2);
  const beforeRollback = await state();
  // The actual rollback must reject session history and preserve all rows.
  // Never fall through to destructive rollback if it unexpectedly succeeds.
  check(Number((await db.query('select count(*) from public.cbt_v2_writing_sessions where attempt_id=$1', [attempt])).rows[0].count) > 0, 'writing-session rollback precondition missing.');
  let refused = false;
  rollbackMayHaveRun = true;
  try { await db.query(await readFile(rollbackPath, 'utf8')); }
  catch (error) { refused = /session history still exists/i.test(String(error?.message || '')); }
  await db.query('rollback');
  check(refused, 'writing-session rollback did not safely refuse existing history.');
  rollbackMayHaveRun = false;
  assert.deepEqual(await state(), beforeRollback);
  log('writing-session rollback refuses existing session history; rows preserved');
} catch (error) {
  failure = error;
} finally {
  // Never dump SDK/network/database error objects: they can contain secrets.
  if (db && cfg) {
    if (rollbackMayHaveRun) {
      try {
        await db.query('rollback');
        const present = (await db.query("select to_regprocedure('public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)') as f")).rows[0].f;
        if (!present) await db.query(await readFile(migrationPath, 'utf8'));
        await reload();
        console.error('Recovery: session migration restoration attempted; independently verify schema and grants before allowing traffic.');
      } catch { cleanupFailed = true; console.error('CRITICAL: session migration restoration failed or is uncertain. Keep traffic stopped and restore from the verified backup.'); }
    }
    if (probeCreated) {
      try { await db.query(`drop function if exists public.${probe}()`); await reload(); }
      catch { cleanupFailed = true; console.error(`Cleanup failed: temporary observer ${probe} may remain.`); }
    }
    if (users.length) {
      try {
        await db.query('begin');
        await db.query('set local role cbt_v2_executor');
        await db.query('delete from public.cbt_attempts where id=$1 and user_id=$2', [attempt, users[0].id]);
        await db.query('commit');
        await db.query("delete from public.cbt_attempts where id=$1 and protocol='legacy' and user_id=$2", [legacy, users[1]?.id || users[0].id]);
        if (examCreated) await db.query('delete from public.cbt_exams where id=$1', [exam]);
        const remaining = (await db.query('select (select count(*)::int from public.cbt_attempts where id=any($1::uuid[])) as attempts, (select count(*)::int from public.cbt_exams where id=$2) as exams', [[attempt, legacy], exam])).rows[0];
        if (remaining.attempts !== 0 || (examCreated && remaining.exams !== 0)) throw new Error('fixtures still present');
      } catch { cleanupFailed = true; try { await db.query('rollback'); } catch {} console.error('Cleanup failed: fixture rows may remain; do not reopen traffic.'); }
      for (const user of users) {
        try {
          // Only delete the exact users returned by this run, after confirming
          // their identity in the DB; if DB linkage failed, do not delete them.
          const linked = (await db.query('select email from auth.users where id=$1', [user.id])).rows[0];
          if (linked?.email?.toLowerCase() !== user.email) throw new Error('identity mismatch');
          const result = await service.auth.admin.deleteUser(user.id);
          if (result.error) throw result.error;
          const remaining = await db.query('select 1 from auth.users where id=$1', [user.id]);
          if (remaining.rowCount !== 0) throw new Error('user still present');
        } catch { cleanupFailed = true; console.error(`Cleanup failed: disposable Auth user ${user.id} requires operator review.`); }
      }
    }
    try { await db.end(); } catch { cleanupFailed = true; }
  }
}
if (failure || cleanupFailed) {
  const message = failure?.message || 'cleanup failed';
  // Only locally generated, controlled assertion messages are shown. Driver
  // and SDK/network errors can embed connection strings or response secrets.
  const safe = failure?.name === 'AssertionError' ? 'unexpected database state or grants' :
    (/^(Real Supabase preflight refused:|database name or independently|local migration filenames|required migration version|database is not an empty|pg Client not found|real Auth health|Auth signup failed|Auth signup user|service key cannot|service key does not|service role could|real Auth login|Auth did not|PostgREST did not|PostgREST JWT identity|anonymous caller|gateway failed|duplicate answer|stale revision|legacy draft save|legacy writer|unexpected attempt|cross-user access|caller-supplied owner|authenticated caller|gateway still present|PostgREST schema cache|restored gateway)/.test(message) ? message : 'service, database, permission or transport error; inspect the environment securely.');
  console.error(`FAILED at ${stage}: ${safe}`);
  console.error(`Disposable fixture run ID: ${runId}; exam: ${exam}; v2 attempt: ${attempt}; legacy attempt: ${legacy}.`);
  process.exitCode = 1;
} else {
  console.log('PASS: real Auth, PostgREST and PostgreSQL integration rehearsal completed and fixture cleanup succeeded.');
}
