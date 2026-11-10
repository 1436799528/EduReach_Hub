// Real Express handlers -> local HTTP compatibility gateway -> real migrated
// PostgreSQL. The gateway provides a synthetic Auth/JWT service and a small
// PostgREST-compatible surface, NOT hosted Supabase or real PostgREST.
// All CBT RPC results and privilege decisions come from PostgreSQL, not stubs.
// Run only with a clean environment and a disposable embedded-postgres module:
// env -i PATH="$PATH" HOME="$HOME" node --import tsx scripts/rehearse-cbt-http-boundary.mjs /tmp/.../embedded-postgres/dist/index.js
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { assertDisposableDatabase, assertDisposableEnvironment } from './cbt-disposable-safety.mjs';

assertDisposableEnvironment(process.env);
if (!process.argv[2]) throw new Error('Provide the separately installed embedded-postgres module path.');
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = resolve(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'edureach-cbt-http-'));
if (process.platform !== 'linux' || ((await stat(dir)).mode & 0o077) !== 0) throw new Error('Private Linux socket directory required.');
const pg = new EmbeddedPostgres({ databaseDir: join(dir, 'db'), user: 'postgres', password: randomBytes(24).toString('hex'), port: 5432, persistent: true, autoRehydrateSymlinks: true, postgresFlags: ['-h', '', '-k', dir], onLog: () => {}, onError: () => {} });
const clients = []; let started = false, backendServer, appServer;
const signingKey = randomBytes(32), serviceKey = `sb_secret_synthetic_${randomBytes(16).toString('hex')}`;
const jwt = (sub, role = 'authenticated', exp = Math.floor(Date.now()/1000)+600) => {
  const payload = Buffer.from(JSON.stringify({ sub, role, exp })).toString('base64url');
  const head = Buffer.from(JSON.stringify({ alg:'HS256', typ:'JWT' })).toString('base64url');
  const signature = createHmac('sha256', signingKey).update(`${head}.${payload}`).digest('base64url');
  return `${head}.${payload}.${signature}`;
};
function verifyToken(req) {
  const h = String(req.header('authorization') || '');
  if (!h.startsWith('Bearer ')) return null;
  const value = h.slice(7);
  if (value === serviceKey) return { role: 'service_role', sub: null };
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', signingKey).update(`${parts[0]}.${parts[1]}`).digest();
  let signature, payload;
  try { signature = Buffer.from(parts[2], 'base64url'); payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return null; }
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected) || payload.exp <= Math.floor(Date.now()/1000) ||
      !['authenticated','service_role'].includes(payload.role) || !/^[0-9a-f-]{36}$/i.test(payload.sub || '')) return null;
  return payload;
}
async function dbClient() {
  const c = pg.getPgClient('postgres', dir); await c.connect(); clients.push(c);
  const identity = (await c.query("select current_setting('data_directory') as data_directory, current_setting('unix_socket_directories') as socket_directories, current_setting('listen_addresses') as listen_addresses, inet_server_addr()::text as server_address, current_database() as database_name")).rows[0];
  assertDisposableDatabase(identity, join(dir, 'db'), dir);
  return c;
}
async function scoped(role, user, work) {
  const c = await dbClient();
  try {
    await c.query('set session authorization cbt_http_test_login');
    await c.query('begin');
    await c.query(`set local role ${role}`); // role is an internal allowlisted constant
    await c.query("select set_config('request.jwt.claim.sub',$1,true)", [user || '']);
    const value = await work(c);
    await c.query('commit');
    return value;
  } catch (e) { try { await c.query('rollback'); } catch {} throw e; }
  finally { await c.end(); }
}
const listen = app => new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const close = s => s ? new Promise(resolve => s.close(resolve)) : Promise.resolve();
try {
  await pg.initialise(); await pg.start(); started = true;
  const admin = await dbClient();
  await admin.query(await readFile(join(root,'supabase/ci/platform-shims.sql'),'utf8'));
  const files = (await readdir(join(root,'supabase/migrations'))).filter(f => f.endsWith('.sql')).sort();
  assert.deepEqual(files.slice(-4), [
    '20261107120000_cbt_attempt_protocol_fence.sql',
    '20261107130000_cbt_v2_server_lifecycle.sql',
    '20261107140000_cbt_v2_answer_gateway.sql',
    '20261107150000_cbt_single_writing_session.sql',
  ], 'local rehearsal requires the approved CBT migration order');
  for (const file of files) await admin.query(await readFile(join(root,'supabase/migrations',file),'utf8'));
  await admin.query('alter role service_role bypassrls; create role cbt_http_test_login nologin noinherit; grant anon, authenticated, service_role, cbt_v2_client, cbt_v2_executor to cbt_http_test_login');
  // Syntax-check the runbook's read-only catalog/ledger recipes on this local
  // disposable schema. This synthetic empty ledger is NOT target history.
  await admin.query('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text,name text)');
  const releaseDoc=await readFile(join(root,'docs/operations/CBT_MIGRATION_FIRST_RELEASE.md'),'utf8');
  const sqlBlocks=[...releaseDoc.matchAll(/```sql\n([\s\S]*?)```/g)].map(match=>match[1]);
  assert.equal(sqlBlocks.length,3,'review changes to the release SQL recipes and this rehearsal together');
  await admin.query(sqlBlocks[0]); await admin.query(sqlBlocks[1]);
  const releaseResults=await admin.query(sqlBlocks[2]);
  assert.ok(Array.isArray(releaseResults),'runbook SQL should return separate catalog reports');
  const privilegeReport=releaseResults.find(r=>r.rows.length && Object.hasOwn(r.rows[0],'pass'));
  const obsoleteReport=releaseResults.find(r=>r.rows.length && Object.hasOwn(r.rows[0],'obsolete_gateway_absent'));
  assert.ok(privilegeReport && privilegeReport.rows.every(row=>row.pass===true),'release privilege expectations must match the migrated fixture');
  assert.equal(obsoleteReport?.rows[0].obsolete_gateway_absent,true);
  assert.equal(releaseResults.at(-1).rowCount,0,'PUBLIC must not execute v2 candidate functions');
  const users = ['a1111111-1111-4111-8111-111111111111','a2222222-2222-4222-8222-222222222222','a3333333-3333-4333-8333-333333333333','a4444444-4444-4444-8444-444444444444'];
  const exam = 'c1111111-1111-4111-8111-111111111111';
  for (let i=0; i<users.length; i++) await admin.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,'{}')", [users[i],`http-${i}@synthetic.test`]);
  await admin.query("insert into public.cbt_exams(id,title,exam_body,subject,description,duration_minutes,is_active) values ($1,'Synthetic','WAEC','Mathematics','test',30,true)", [exam]);
  for (let i=1; i<=6; i++) await admin.query("insert into public.exam_questions(exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values ($1,'Mathematics','Synthetic','A','B','C','D','A',1,$2)", [exam,i]);
  const startV2 = user => scoped('cbt_v2_client',user, c => c.query("select * from public.cbt_start_attempt_v2($1,array['Mathematics']::text[],5,null,'practice',null)",[exam]).then(r=>r.rows[0]));
  const v2 = await startV2(users[0]);
  const legacy = await scoped('authenticated',users[2], c => c.query("select * from public.start_cbt_attempt_configured($1,array['Mathematics']::text[],5,null,'practice',null)",[exam]).then(r=>r.rows[0]));
  const paper = (await admin.query('select question_ids from public.cbt_attempts where id=$1',[v2.attempt_id])).rows[0].question_ids;
  const grants = (await admin.query("select has_function_privilege('authenticated','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)','execute') as wrapper_auth, has_function_privilege('anon','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)','execute') as wrapper_anon, has_function_privilege('service_role','public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)','execute') as wrapper_service, has_function_privilege('authenticated','public.cbt_candidate_answer(uuid,uuid,integer,bigint,uuid,uuid)','execute') as inner_auth, has_function_privilege('cbt_v2_answer_gateway','public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)','execute') as gateway_finalize, has_table_privilege('cbt_v2_answer_gateway','public.cbt_attempts','update') as gateway_update, (select rolname from pg_roles r join pg_proc p on p.proowner=r.oid where p.oid='public.cbt_v2_answer_gateway(uuid,uuid,integer,bigint,uuid,uuid,bigint)'::regprocedure) as owner")).rows[0];
  assert.deepEqual(grants,{wrapper_auth:true,wrapper_anon:false,wrapper_service:false,inner_auth:false,gateway_finalize:false,gateway_update:false,owner:'cbt_v2_answer_gateway'});
  const separation = (await admin.query("select has_function_privilege('cbt_v2_answer_gateway','public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text)','execute') as can_start, has_function_privilege('cbt_v2_answer_gateway','public.cbt_v2_transition(uuid,text)','execute') as can_transition, has_table_privilege('cbt_v2_answer_gateway','public.cbt_v2_operations','select') as can_read_ledger, rolcanlogin, rolinherit from pg_roles where rolname='cbt_v2_answer_gateway'")).rows[0];
  assert.deepEqual(separation,{can_start:false,can_transition:false,can_read_ledger:false,rolcanlogin:false,rolinherit:false});

  // This compatibility gateway deliberately implements only routes needed by
  // the actual app and executes every database call against the real DB under
  // non-superuser roles. JWT verification and Auth are synthetic local shims.
  const backend = express(); backend.use(express.json());
  backend.get('/auth/v1/user', async (req,res) => {
    const auth = verifyToken(req); if (!auth || auth.role !== 'authenticated') return res.status(401).json({ message:'Invalid token' });
    const row = (await admin.query('select id,email,raw_user_meta_data from auth.users where id=$1',[auth.sub])).rows[0];
    return row ? res.json({ id:row.id,email:row.email,aud:'authenticated',user_metadata:row.raw_user_meta_data }) : res.status(401).json({message:'Invalid token'});
  });
  backend.get('/rest/v1/profiles', async (req,res) => {
    const auth=verifyToken(req); if (!auth || auth.role !== 'service_role') return res.status(401).json({message:'Invalid token'});
    const id=String(req.query.id || '').replace(/^eq\./,'');
    try { const row = await scoped('service_role',null, c=>c.query('select role,full_name from public.profiles where id=$1',[id]).then(r=>r.rows[0] || null)); return res.json(row); }
    catch (e) { return res.status(500).json({code:e.code,message:e.message}); }
  });
  backend.get('/rest/v1/cbt_attempts', async (req,res) => {
    const auth=verifyToken(req); if (!auth || auth.role !== 'service_role') return res.status(401).json({message:'Invalid token'});
    const id=String(req.query.id||'').replace(/^eq\./,''), user=String(req.query.user_id||'').replace(/^eq\./,'');
    try { const row=await scoped('service_role',null,c=>c.query(`select a.*, json_build_object('title',e.title,'exam_body',e.exam_body,'subject',e.subject) as cbt_exams from public.cbt_attempts a join public.cbt_exams e on e.id=a.exam_id where a.id=$1 and a.user_id=$2`,[id,user]).then(r=>r.rows[0]||null)); return res.json(row); }
    catch (e) { return res.status(500).json({code:e.code,message:e.message}); }
  });
  backend.get('/rest/v1/cbt_exams', async (req,res) => {
    const auth=verifyToken(req); if (!auth || auth.role !== 'service_role') return res.status(401).json({message:'Invalid token'});
    if (req.query.select !== 'id,title,exam_body,duration_minutes,subject,is_active' || req.query.is_active !== 'eq.true') return res.status(400).json({message:'Unexpected exam query'});
    const examId=String(req.query.id||'').replace(/^eq\./,'');
    try { return res.json(await scoped('service_role',null,c=>c.query('select id,title,exam_body,duration_minutes,subject,is_active from public.cbt_exams where id=$1 and is_active=true',[examId]).then(r=>r.rows[0]||null))); }
    catch (e) { return res.status(500).json({code:e.code,message:e.message}); }
  });
  backend.get('/rest/v1/exam_questions', async (req,res) => {
    const auth=verifyToken(req); if (!auth || auth.role !== 'service_role') return res.status(401).json({message:'Invalid token'});
    const examId=String(req.query.exam_id||'').replace(/^eq\./,''), raw=String(req.query.id||'');
    const frozen='id,subject,question_text,option_a,option_b,option_c,option_d';
    const guestPaper='position,subject,question_text,option_a,option_b,option_c,option_d';
    const guestScore='id,position,subject,question_text,option_a,option_b,option_c,option_d,correct_option,explanation';
    if (req.query.review_status !== 'neq.rejected') return res.status(400).json({message:'Unexpected question filter'});
    try {
      if (req.query.select === frozen && /^in\.\([0-9a-f,-]+\)$/i.test(raw)) {
        const ids=raw.slice(4,-1).split(',');
        const rows=await scoped('service_role',null,c=>c.query("select id,subject,question_text,option_a,option_b,option_c,option_d from public.exam_questions where exam_id=$1 and id=any($2::uuid[]) and review_status<>'rejected'",[examId,ids]).then(r=>r.rows));
        return res.json(rows);
      }
      if ([guestPaper,guestScore].includes(req.query.select) && !raw && req.query.order === 'position.asc' && String(req.query.offset||'0') === '0' && String(req.query.limit||'1000') === '1000') {
        // Explicit allowlist: never interpolate caller-provided field names.
        const columns=req.query.select === guestPaper ? guestPaper : guestScore;
        const rows=await scoped('service_role',null,c=>c.query(`select ${columns} from public.exam_questions where exam_id=$1 and review_status<>'rejected' order by position limit 1000`,[examId]).then(r=>r.rows));
        return res.json(rows);
      }
      return res.status(400).json({message:'Unexpected question fields or filters'});
    } catch (e) { return res.status(500).json({code:e.code,message:e.message}); }
  });
  const functions = {
    check_rate_limit: { sql:'select public.check_rate_limit($1,$2,$3) as result', keys:['p_bucket','p_limit','p_window_seconds'] },
    get_cbt_attempt_paper: { sql:'select * from public.get_cbt_attempt_paper($1)', keys:['p_attempt_id'], many:true },
    cbt_v2_answer_gateway: { sql:'select public.cbt_v2_answer_gateway($1,$2,$3,$4,$5,$6,$7) as result', keys:['p_attempt','p_question','p_selected','p_expected_revision','p_operation_key','p_session','p_generation'] },
    cbt_v2_session_gateway: { sql:'select public.cbt_v2_session_gateway($1,$2,$3) as result', keys:['p_attempt','p_request_key','p_takeover'] },
    cbt_candidate_answer: { sql:'select public.cbt_candidate_answer($1,$2,$3,$4,$5,$6) as result', keys:['p_attempt','p_question','p_selected','p_expected_revision','p_operation_key','p_expected_user'] },
    cbt_candidate_finalize: { sql:'select public.cbt_candidate_finalize($1,$2,$3,$4) as result', keys:['p_attempt','p_expected_revision','p_operation_key','p_expected_user'] },
    save_cbt_attempt_draft: { sql:'select public.save_cbt_attempt_draft($1,$2,$3) as result', keys:['p_attempt_id','p_answers','p_question_index'] },
  };
  backend.post('/rest/v1/rpc/:fn', async (req,res) => {
    const auth=verifyToken(req), fn=functions[req.params.fn];
    if (!auth) return res.status(401).json({message:'Invalid token'});
    if (!fn || Object.keys(req.body || {}).some(k=>!fn.keys.includes(k)) || fn.keys.some(k=>!(k in (req.body||{})))) return res.status(404).json({code:'PGRST202',message:'Function not found'});
    try {
      const result=await scoped(auth.role,auth.sub,c=>c.query(fn.sql,fn.keys.map(k=>req.body[k])).then(r=>fn.many ? r.rows : r.rows[0].result));
      return res.json(result);
    } catch (e) { return res.status(e.code==='42501' ? 403 : 400).json({code:e.code || 'XX000',message:e.message}); }
  });
  backendServer=await listen(backend);
  process.env.NODE_ENV='test'; process.env.CBT_V2_LOCAL_REHEARSAL='1'; process.env.CBT_V2_TEST_IMPORT='1';
  process.env.VITE_SUPABASE_URL=`http://127.0.0.1:${backendServer.address().port}`;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='synthetic-publishable-key'; process.env.SUPABASE_SECRET_KEY=serviceKey;
  const { app }=await import(pathToFileURL(join(root,'server.ts')).href);
  if (process.env.CBT_HTTP_BROWSER === '1') {
    // Serve the real built SPA on the same origin as the real Express handlers.
    // The browser Auth token is synthetic; CBT endpoints are not intercepted
    // except for explicitly simulated network failure/uncertainty scenarios.
    app.use(express.static(join(root,'dist')));
    app.get('*', (_req,res) => res.sendFile(join(root,'dist/index.html')));
  }
  appServer=await listen(app);
  const base=`http://127.0.0.1:${appServer.address().port}`;
  const token=jwt(users[0]), other=jwt(users[1]), legacyToken=jwt(users[2]);
  if (process.env.CBT_HTTP_BROWSER === '1') {
    const browserAttempt=await startV2(users[3]);
    const { rehearsePage }=await import('./cbt-http-page-rehearsal.mjs');
    await rehearsePage({ base, attempt:browserAttempt.attempt_id, account:users[3], token:jwt(users[3]), legacyAttempt:legacy.attempt_id, legacyAccount:users[2], legacyToken, admin });
  }
  const endpoint=`/api/cbt/v2/attempts/${v2.attempt_id}/answer`;
  const post=async (path,credential,body,method='PATCH') => {
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(credential ? {Authorization:`Bearer ${credential}`} : {})},body:JSON.stringify(body)});
    return {status:r.status, body:await r.json()};
  };
  const direct=async (fn,credential,body) => {
    const r=await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:'POST',headers:{'Content-Type':'application/json',...(credential ? {Authorization:`Bearer ${credential}`} : {})},body:JSON.stringify(body)});
    return {status:r.status,body:await r.json()};
  };
  const get=async (path,credential) => { const r=await fetch(base+path,{headers:credential ? {Authorization:`Bearer ${credential}`} : {}}); return {status:r.status,body:await r.json()}; };
  const pagePath=`/api/cbt/attempts/${v2.attempt_id}/paper`;
  const v2Paper=await get(pagePath,token);
  assert.equal(v2Paper.status,200); assert.deepEqual(v2Paper.body.protocol,{version:2,scope:'local-rehearsal'});
  assert.deepEqual(v2Paper.body.questions.map(q=>q.id),paper); assert.equal(v2Paper.body.questions.length,5);
  assert.ok(v2Paper.body.questions.every((q,i)=>q.position===i+1 && q.subject==='Mathematics' &&
    JSON.stringify(Object.keys(q).sort())===JSON.stringify(['id','options','position','subject','text'])));
  assert.equal((await get(pagePath,other)).status,404);
  assert.equal((await get(`/api/cbt/attempts/${randomUUID()}/paper`,token)).status,404);
  assert.equal((await get('/api/cbt/attempts/not-a-uuid/paper',token)).status,400);
  assert.equal((await get(pagePath,null)).status,401);
  // Public guest scoring uses the same DB bank, with no Auth, owner, v2
  // session or attempt-state check. A wrong choice is still an attempted
  // answer and receives the correction. Use only this synthetic bank.
  const guestSheet=await get(`/api/cbt/exams/${exam}/guest-questions`,null);
  assert.equal(guestSheet.status,200); assert.equal(guestSheet.body.questions.length,6);
  assert.ok(guestSheet.body.questions.every(q=>!('correct_option' in q) && !('explanation' in q)));
  const emptyGuest=await post('/api/cbt/guest-submit',null,{examId:exam,answers:{}},'POST');
  assert.equal(emptyGuest.status,200); assert.ok(emptyGuest.body.questions.every(q=>q.correct_option===null));
  const arbitrary=await post('/api/cbt/guest-submit',null,{examId:exam,answers:{[paper[0]]:1}},'POST');
  assert.equal(arbitrary.status,200); assert.ok(arbitrary.body.questions.every(q=>q.correct_option===null),'question UUIDs are not answer positions');
  const protectedAttempt=(await admin.query('select status,protocol from public.cbt_attempts where id=$1',[v2.attempt_id])).rows[0];
  assert.deepEqual(protectedAttempt,{status:'in_progress',protocol:'v2'});
  const guestBefore=await post('/api/cbt/guest-submit',null,{examId:exam,answers:Object.fromEntries(guestSheet.body.questions.map(q=>[String(q.id),1]))},'POST');
  assert.equal(guestBefore.status,200); assert.equal(guestBefore.body.score,0,'wrong but valid choices count as attempted');
  const revealed=new Map(guestBefore.body.questions.map(q=>[q.id,q.correct_option]));
  assert.ok(paper.every(id=>revealed.get(id)==='A'),'unauthenticated guest learns keys for an active protected v2 paper');
  // This future attempt is created after those keys were already returned.
  const expiredAttempt=await startV2(users[1]);
  const laterPaper=(await admin.query('select question_ids from public.cbt_attempts where id=$1',[expiredAttempt.attempt_id])).rows[0].question_ids;
  assert.ok(laterPaper.every(id=>revealed.get(id)==='A'),'guest learned keys before a future v2 attempt started');
  const guestDuring=await post('/api/cbt/guest-submit',null,{examId:exam,answers:{'1':1}},'POST');
  assert.equal(guestDuring.status,200); assert.equal(guestDuring.body.questions[0].correct_option,'A');
  assert.ok(guestDuring.body.questions.slice(1).every(q=>q.correct_option===null));
  // Frozen papers remain resumable after bank deactivation, matching the
  // legacy frozen reader; neither path replans or substitutes questions.
  await admin.query('update public.cbt_exams set is_active=false where id=$1',[exam]);
  const inactivePaper=await get(pagePath,token);
  assert.equal(inactivePaper.status,200); assert.deepEqual(inactivePaper.body.questions.map(q=>q.id),paper);
  const inactiveLegacy=await get(`/api/cbt/attempts/${legacy.attempt_id}/paper`,legacyToken);
  assert.equal(inactiveLegacy.status,200);
  assert.equal((await get(`/api/cbt/exams/${exam}/guest-questions`,null)).status,404, 'deactivated banks are not offered to guests');
  assert.equal((await post('/api/cbt/guest-submit',null,{examId:exam,answers:{'1':1}},'POST')).status,404, 'deactivated banks are not guest scored');
  await admin.query('update public.cbt_exams set is_active=true where id=$1',[exam]);
  const rejectedQuestion=randomUUID();
  await admin.query("insert into public.exam_questions(id,exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position,review_status) values ($1,$2,'Mathematics','Rejected fixture','A','B','C','D','A',1,7,'rejected')",[rejectedQuestion,exam]);
  const fixture = async (status,ids) => {
    const id=randomUUID(); await admin.query('set role cbt_v2_executor');
    try { await admin.query('insert into public.cbt_attempts(id,user_id,exam_id,status,total_questions,protocol,question_ids,expires_at) values ($1,$2,$3,$4,$5,\'v2\',$6::uuid[],now()-interval \'5 minutes\')',[id,users[0],exam,status,ids.length,ids]); }
    finally { await admin.query('reset role'); }
    return `/api/cbt/attempts/${id}/paper`;
  };
  const rejectedPath=await fixture('expired',[rejectedQuestion]);
  const missingPath=await fixture('expired',[randomUUID()]);
  assert.equal((await get(rejectedPath,token)).status,409,'rejected question is never disclosed');
  assert.equal((await get(missingPath,token)).status,409,'missing frozen question is not substituted');
  assert.equal((await get(await fixture('cancelled',[paper[0]]),token)).status,409);
  assert.equal((await get(await fixture('submitted',[paper[0]]),token)).status,409);
  assert.equal((await get(await fixture('expired',[paper[0]]),token)).status,200,'expired paper is readable for local recovery');
  const legacyPaper=await get(`/api/cbt/attempts/${legacy.attempt_id}/paper`,legacyToken);
  assert.equal(legacyPaper.status,200); assert.deepEqual(legacyPaper.body.protocol,{version:1});
  assert.equal(legacyPaper.body.questions.length,5);
  process.env.CBT_V2_LOCAL_REHEARSAL='';
  assert.equal((await get('/api/cbt/attempts/not-a-uuid/paper',token)).status,400);
  assert.equal((await get(pagePath,token)).status,503,'v2 is unavailable outside local rehearsal and must never fall back to a legacy paper');
  process.env.CBT_V2_LOCAL_REHEARSAL='1';
  const sessionPath=`/api/cbt/v2/attempts/${v2.attempt_id}/session`;
  const acquired=await post(sessionPath,token,{protocol:2,requestKey:randomUUID(),takeover:false},'POST');
  assert.equal(acquired.status,200); assert.equal(acquired.body.outcome,'created');
  const key=randomUUID(), body={protocol:2,expectedRevision:0,operationKey:key,questionId:paper[0],selected:1,sessionId:acquired.body.sessionId,sessionGeneration:acquired.body.generation};
  const statePath=`/api/cbt/v2/attempts/${v2.attempt_id}/state`;
  const state=await fetch(base+statePath,{headers:{Authorization:`Bearer ${token}`}});
  assert.equal(state.status,200); const stateBody=await state.json();
  assert.equal(stateBody.protocol,2); assert.equal(stateBody.revision,0); assert.deepEqual(stateBody.questionIds,paper);
  assert.equal((await fetch(base+statePath,{headers:{Authorization:`Bearer ${other}`}})).status,404);
  assert.equal((await post(endpoint,null,body)).status,401);
  assert.equal((await post(endpoint,'invalid',body)).status,401);
  const pieces=token.split('.');
  const forgedPayload=Buffer.from(JSON.stringify({sub:users[1],role:'authenticated',exp:Math.floor(Date.now()/1000)+600})).toString('base64url');
  assert.equal((await post(endpoint,`${pieces[0]}.${forgedPayload}.${pieces[2]}`,body)).status,401);
  assert.equal((await post(endpoint,jwt(users[0],'authenticated',1),body)).status,401);
  assert.equal((await post(endpoint,other,body)).status,404);
  assert.equal((await post(`/api/cbt/v2/attempts/${legacy.attempt_id}/answer`,legacyToken,body)).status,409);
  assert.equal((await post(`/api/cbt/attempts/${v2.attempt_id}/draft`,token,{answers:{'1':0},questionIndex:0})).status,409);
  const first=await post(endpoint,token,{...body,userId:users[1],p_expected_user:users[1]});
  assert.equal(first.status,200); assert.equal(first.body.outcome,'accepted'); assert.equal(Number(first.body.revision),1); assert.equal(Number(first.body.acceptedRevision),1);
  assert.equal(first.body.status,'in_progress'); assert.deepEqual(first.body.answers,{'1':1});
  const replay=await post(endpoint,token,body); assert.equal(replay.body.outcome,'replayed'); assert.equal(Number(replay.body.revision),1);
  const stale=await post(endpoint,token,{...body,operationKey:randomUUID(),questionId:paper[1]}); assert.equal(stale.status,409); assert.equal(stale.body.outcome,'conflict'); assert.equal(Number(stale.body.revision),1); assert.deepEqual(stale.body.answers,{'1':1});
  const expiredPaper=(await admin.query('select question_ids from public.cbt_attempts where id=$1',[expiredAttempt.attempt_id])).rows[0].question_ids;
  const expiredSession=await post(`/api/cbt/v2/attempts/${expiredAttempt.attempt_id}/session`,other,{protocol:2,requestKey:randomUUID(),takeover:false},'POST');
  assert.equal(expiredSession.status,200);
  await admin.query('set role cbt_v2_executor');
  try { await admin.query("update public.cbt_attempts set expires_at=clock_timestamp()-interval '1 second' where id=$1",[expiredAttempt.attempt_id]); }
  finally { await admin.query('reset role'); }
  const expired=await post(`/api/cbt/v2/attempts/${expiredAttempt.attempt_id}/answer`,other,{...body,questionId:expiredPaper[0],operationKey:randomUUID(),sessionId:expiredSession.body.sessionId,sessionGeneration:expiredSession.body.generation});
  assert.equal(expired.status,409); assert.equal(expired.body.outcome,'expired');
  const takeover=await post(sessionPath,token,{protocol:2,requestKey:randomUUID(),takeover:true},'POST');
  assert.equal(takeover.status,200); assert.equal(takeover.body.outcome,'taken_over');
  const revoked=await post(endpoint,token,{...body,expectedRevision:1,operationKey:randomUUID()});
  assert.equal(revoked.status,409); assert.equal(revoked.body.outcome,'session_revoked');
  body.sessionId=takeover.body.sessionId; body.sessionGeneration=takeover.body.generation;
  const args={p_attempt:v2.attempt_id,p_question:paper[0],p_selected:1,p_expected_revision:0,p_operation_key:key,p_expected_user:users[0]};
  assert.equal((await direct('cbt_candidate_answer',token,args)).status,403);
  assert.equal((await direct('cbt_candidate_answer',jwt(users[0],'service_role'),args)).status,403);
  const gatewayArgs={p_attempt:v2.attempt_id,p_question:paper[0],p_selected:0,p_expected_revision:1,p_operation_key:randomUUID(),p_session:body.sessionId,p_generation:body.sessionGeneration};
  assert.equal((await direct('cbt_v2_answer_gateway',null,gatewayArgs)).status,401);
  assert.equal((await direct('cbt_v2_answer_gateway',jwt(users[0],'service_role'),gatewayArgs)).status,403);
  await assert.rejects(scoped('anon',null,c=>c.query('select public.cbt_v2_answer_gateway($1,$2,$3,$4,$5,$6,$7)',[v2.attempt_id,paper[0],0,1,randomUUID(),body.sessionId,body.sessionGeneration])), /permission denied/i);
  await assert.rejects(scoped('authenticated',users[1],c=>c.query('select public.cbt_v2_answer_gateway($1,$2,$3,$4,$5,$6)',[v2.attempt_id,paper[0],0,1,randomUUID(),users[0]])), /does not exist/i);
  await assert.rejects(scoped('authenticated',users[1],c=>c.query('select public.cbt_v2_answer_gateway($1,$2,$3,$4,$5,$6,$7)',[v2.attempt_id,paper[0],0,1,randomUUID(),body.sessionId,body.sessionGeneration])), /CBT attempt not found/i);
  await assert.rejects(scoped('service_role',users[0], c=>c.query("update public.cbt_attempts set status='cancelled' where id=$1",[v2.attempt_id])), /protocol mismatch/i);
  await assert.rejects(scoped('authenticated',users[0], c=>c.query('set role cbt_v2_answer_gateway')), /permission denied/i);
  assert.equal((await direct('cbt_candidate_finalize',token,{p_attempt:v2.attempt_id,p_expected_revision:1,p_operation_key:randomUUID(),p_expected_user:users[0]})).status,403);
  assert.equal((await direct('cbt_v2_answer_gateway',other,{...gatewayArgs,p_expected_user:users[0]})).status,404);
  const wrongDirect=await direct('cbt_v2_answer_gateway',other,{...gatewayArgs,p_operation_key:randomUUID()});
  assert.equal(wrongDirect.status,400); assert.match(wrongDirect.body.message,/CBT attempt not found/);
  const finish=`/api/cbt/v2/attempts/${v2.attempt_id}/finalize`;
  assert.equal((await post(finish,token,{protocol:2,expectedRevision:1,operationKey:randomUUID(),recovery_complete:true},'POST')).status,503);
  assert.equal((await admin.query('select status from public.cbt_attempts where id=$1',[v2.attempt_id])).rows[0].status,'in_progress');
  // Real answer/finalize race: the only finalizer is the deliberately privileged
  // DB test role. Hold its transaction to prove the answer waits then closes.
  const racing = await dbClient();
  await racing.query('set session authorization cbt_http_test_login'); await racing.query('begin'); await racing.query('set local role cbt_v2_executor');
  await racing.query("select set_config('request.jwt.claim.sub',$1,true)",[users[0]]);
  const finalized=(await racing.query('select public.cbt_candidate_finalize_leased($1,$2,$3,$4,$5,$6) as result',[v2.attempt_id,1,randomUUID(),body.sessionId,body.sessionGeneration,users[0]])).rows[0].result;
  assert.equal(finalized.outcome,'submitted');
  const answerPromise=post(endpoint,token,{...body,expectedRevision:1,operationKey:randomUUID(),questionId:paper[1]});
  // Confirm an actual SQL waiter rather than timing alone.
  let blocked=false;
  for(let i=0;i<100;i++) {
    if ((await admin.query("select exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and cardinality(pg_blocking_pids(pid))>0 and query like '%cbt_v2_answer_gateway%') as blocked")).rows[0].blocked) { blocked=true; break; }
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.ok(blocked,'HTTP answer must wait on the finalized attempt lock');
  await racing.query('commit');
  const after=await answerPromise; assert.equal(after.status,409); assert.equal(after.body.outcome,'closed');
  assert.equal((await admin.query('select status from public.cbt_attempts where id=$1',[v2.attempt_id])).rows[0].status,'submitted');
  console.log(`Passed actual Express HTTP -> local compatibility gateway -> migrated PostgreSQL after ${files.length} migrations: synthetic auth, owner/protocol, session acquisition/takeover/revocation, role grants, duplicate/stale, impersonation, blocked HTTP finalization and answer/finalize race.`);
  console.log('Auth/JWT and PostgREST are local synthetic compatibility services; hosted Supabase/PostgREST behavior is NOT verified.');
} finally {
  await close(appServer); await close(backendServer);
  for (const c of clients) { try { await c.end(); } catch {} }
  if (started) { try { await pg.stop(); } catch {} }
  await rm(dir,{recursive:true,force:true});
}
