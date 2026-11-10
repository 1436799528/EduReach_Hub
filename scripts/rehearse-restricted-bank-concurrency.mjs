// Local-only, private Unix-socket PostgreSQL rehearsal. The candidates remain
// incomplete and non-deployable. Run with a separately installed embedded DB:
// env -i PATH="$PATH" HOME="$HOME" node scripts/rehearse-restricted-bank-concurrency.mjs /tmp/.../embedded-postgres/dist/index.js
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { assertDisposableDatabase, assertDisposableEnvironment } from './cbt-disposable-safety.mjs';

assertDisposableEnvironment(process.env);
if (!process.argv[2]) throw new Error('Supply an embedded-postgres module path.');
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = resolve(import.meta.dirname, '..');
const dir = await mkdtemp(join(tmpdir(), 'edureach-restricted-test-'));
if (process.platform !== 'linux' || ((await stat(dir)).mode & 0o077) !== 0) throw new Error('Private Linux socket directory required.');
const pg = new EmbeddedPostgres({ databaseDir:join(dir,'db'), user:'postgres', password:randomBytes(24).toString('hex'), port:5432, persistent:true, autoRehydrateSymlinks:true, postgresFlags:['-h','','-k',dir], onLog:()=>{}, onError:()=>{} });
const clients=[]; let started=false, backendServer, appServer;
const listen = app => new Promise(resolve => { const server=app.listen(0,'127.0.0.1',()=>resolve(server)); });
const close = server => server ? new Promise(resolve=>server.close(resolve)) : Promise.resolve();
try {
  await pg.initialise(); await pg.start(); started=true;
  for (let i=0;i<3;i++) {
    const c=pg.getPgClient('postgres',dir); await c.connect(); clients.push(c);
    const identity=(await c.query("select current_setting('data_directory') as data_directory,current_setting('unix_socket_directories') as socket_directories,current_setting('listen_addresses') as listen_addresses,inet_server_addr()::text as server_address,current_database() as database_name")).rows[0];
    assertDisposableDatabase(identity,join(dir,'db'),dir);
  }
  const [admin,a,b]=clients;
  await admin.query(await readFile(join(root,'supabase/ci/platform-shims.sql'),'utf8'));
  const migrationDir=join(root,'supabase/migrations');
  for (const name of (await readdir(migrationDir)).filter(f=>f.endsWith('.sql')).sort()) await admin.query(await readFile(join(migrationDir,name),'utf8'));
  for (const name of ['restricted_bank_policy_foundation.sql','restricted_bank_readers_candidate.sql','restricted_bank_results_candidate.sql'])
    await admin.query(await readFile(join(root,'supabase/candidates',name),'utf8'));
  await admin.query('create role restricted_test_login nologin noinherit; grant authenticated to restricted_test_login');
  const user='a5000000-0000-4000-8000-000000000001', staff='a5000000-0000-4000-8000-000000000002', exam='b5000000-0000-4000-8000-000000000001';
  await admin.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,'student@synthetic.test','{}'),($2,'staff@synthetic.test','{}')",[user,staff]);
  await admin.query("update public.profiles set role='super_admin' where id=$1",[staff]);
  await admin.query("insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values ($1,'Synthetic','WAEC','Math',30,true)",[exam]);
  await admin.query("insert into public.exam_questions(exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) select $1,'Math','Synthetic '||n,'A','B','C','D','A',1,n from generate_series(1,5) n",[exam]);
  await admin.query("select set_config('request.jwt.claim.sub',$1,false)",[staff]);
  await admin.query("select public.cbt_bank_classify($1,'restricted',now()+interval '1 day')",[exam]);
  await admin.query('select public.cbt_bank_assign($1,$2,true)',[exam,user]);
  for (const c of [a,b]) { await c.query('set session authorization restricted_test_login'); await c.query('set role authenticated'); await c.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); }
  const attempt=(await a.query("select * from public.start_cbt_attempt_configured($1,array['Math'],5,null,'practice',null)",[exam])).rows[0].attempt_id;
  const [first,second]=await Promise.all([
    a.query('select * from public.submit_cbt_attempt_configured($1,$2::jsonb)',[attempt,JSON.stringify({'1':0,'2':0,'3':0,'4':0,'5':0})]),
    b.query('select * from public.submit_cbt_attempt_configured($1,$2::jsonb)',[attempt,JSON.stringify({'1':1,'2':0,'3':0,'4':0,'5':0})]),
  ]);
  for (const r of [first,second]) { assert.equal(r.rows[0].score,null); assert.equal(r.rows[0].correct_answers,null); assert.deepEqual(r.rows[0].breakdown,[]); }
  assert.equal((await a.query('select score from public.cbt_attempts where id=$1',[attempt])).rowCount,0);
  assert.equal((await b.query('select * from public.get_cbt_result($1)',[attempt])).rowCount,0);
  const stored=(await admin.query('select status,score from public.cbt_attempts where id=$1',[attempt])).rows[0];
  assert.equal(stored.status,'submitted'); assert.ok([80,100].includes(Number(stored.score)));
  console.log('PASS concurrent altered submissions: both responses embargoed; one authoritative stored result');
  await admin.query('select public.cbt_bank_assign($1,$2,false)',[exam,user]);
  await assert.rejects(a.query('select * from public.get_cbt_attempt_paper($1)',[attempt]),/not found/i);
  await assert.rejects(b.query("select * from public.submit_cbt_attempt_configured($1,'{}'::jsonb)",[attempt]),/not found/i);
  console.log('PASS post-commit revocation denies stale paper and retry');

  // Restricted v2 writing under real roles: assigned candidate may write, the
  // response contains no score/correctness, and revocation stops the next call.
  await admin.query('select public.cbt_bank_assign($1,$2,true)',[exam,user]);
  const v2ids=(await admin.query('select id from public.exam_questions where exam_id=$1 order by position',[exam])).rows.map(row=>row.id);
  await admin.query('set role cbt_v2_executor');
  const v2Attempt=(await admin.query("insert into public.cbt_attempts(user_id,exam_id,status,expires_at,total_questions,question_ids,protocol) values($1,$2,'in_progress',now()+interval '20 minutes',5,$3,'v2') returning id",[user,exam,v2ids])).rows[0].id;
  await admin.query('reset role');
  const v2key='c3000000-0000-4000-8000-000000000001';
  const v2session=(await a.query('select public.cbt_v2_session_gateway($1,$2,false) as result',[v2Attempt,v2key])).rows[0].result;
  assert.equal(v2session.outcome,'created');
  const v2answer=(await a.query('select public.cbt_v2_answer_gateway($1,$2,0,0,$3,$4,$5) as result',[v2Attempt,v2ids[0],'c3000000-0000-4000-8000-000000000002',v2session.sessionId,v2session.generation])).rows[0].result;
  assert.equal(v2answer.outcome,'accepted');
  assert.doesNotMatch(JSON.stringify(v2answer),/score|correct|explanation/i);
  assert.equal((await b.query('select score,correct_answers from public.cbt_attempts where id=$1',[v2Attempt])).rowCount,0);
  // `other`-style unassigned access: use a second candidate.
  const outsider='a5000000-0000-4000-8000-000000000003';
  await admin.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,'other@synthetic.test','{}')",[outsider]);
  const c=pg.getPgClient('postgres',dir); await c.connect(); clients.push(c);
  const cIdentity=(await c.query("select current_setting('data_directory') as data_directory,current_setting('unix_socket_directories') as socket_directories,current_setting('listen_addresses') as listen_addresses,inet_server_addr()::text as server_address,current_database() as database_name")).rows[0];
  assertDisposableDatabase(cIdentity,join(dir,'db'),dir);
  await c.query('set session authorization restricted_test_login; set role authenticated');
  await c.query("select set_config('request.jwt.claim.sub',$1,false)",[outsider]);
  await assert.rejects(c.query('select public.cbt_v2_session_gateway($1,$2,true)',[v2Attempt,'c3000000-0000-4000-8000-000000000003']),/not found/i);
  await assert.rejects(c.query('select public.cbt_v2_answer_gateway($1,$2,1,1,$3,$4,1)',[v2Attempt,v2ids[1],'c3000000-0000-4000-8000-000000000004',v2session.sessionId]),/not found/i);
  await c.query('reset role');
  await admin.query('select public.cbt_bank_assign($1,$2,false)',[exam,user]);
  await assert.rejects(a.query('select public.cbt_v2_session_gateway($1,$2,true)',[v2Attempt,'c3000000-0000-4000-8000-000000000005']),/not found/i);
  await assert.rejects(a.query('select public.cbt_v2_answer_gateway($1,$2,1,1,$3,$4,1)',[v2Attempt,v2ids[1],'c3000000-0000-4000-8000-000000000006',v2session.sessionId]),/not found/i);
  const finalizeAllowed=(await a.query("select has_function_privilege('authenticated','public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)','execute') as allowed")).rows[0].allowed;
  assert.equal(finalizeAllowed,false);
  await admin.query('select public.cbt_bank_assign($1,$2,true)',[exam,user]);
  await admin.query('select public.cbt_bank_assign($1,$2,true)',[exam,outsider]);
  console.log('PASS restricted v2: assigned candidate writes without score; unassigned and revoked sessions denied; finalizer unreachable');

  // Real Express guest endpoints through a minimal local PostgREST adapter.
  // SQL and service-role privileges are real; Auth/PostgREST are not hosted.
  const publicExam='b5000000-0000-4000-8000-000000000002', unknownExam='b5000000-0000-4000-8000-000000000003';
  await admin.query("insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values ($1,'Public','WAEC','Math',30,true),($2,'Unclassified','WAEC','Math',30,true)",[publicExam,unknownExam]);
  for (const id of [publicExam,unknownExam]) await admin.query("insert into public.exam_questions(exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values($1,'Math','Synthetic','A','B','C','D','A',1,1)",[id]);
  await admin.query("select public.cbt_bank_classify($1,'public',null)",[publicExam]);
  await admin.query('alter role service_role bypassrls; grant service_role to restricted_test_login');
  const service=pg.getPgClient('postgres',dir); await service.connect(); clients.push(service);
  const serviceIdentity=(await service.query("select current_setting('data_directory') as data_directory,current_setting('unix_socket_directories') as socket_directories,current_setting('listen_addresses') as listen_addresses,inet_server_addr()::text as server_address,current_database() as database_name")).rows[0];
  assertDisposableDatabase(serviceIdentity,join(dir,'db'),dir);
  await service.query('set session authorization restricted_test_login; set role service_role');
  let questionReads=0;
  const gateway=express(); gateway.use(express.json());
  gateway.get('/rest/v1/cbt_exams', async (req,res) => {
    const id=String(req.query.id||'').replace(/^eq\./,'');
    try { const result=await service.query('select id,title,exam_body,duration_minutes,subject,is_active from public.cbt_exams where id=$1 and is_active=true',[id]); res.json(result.rows); }
    catch { res.status(500).json({error:'local adapter error'}); }
  });
  gateway.get('/rest/v1/cbt_bank_security', async (req,res) => {
    const id=String(req.query.exam_id||'').replace(/^eq\./,'');
    try { const result=await service.query('select visibility from public.cbt_bank_security where exam_id=$1',[id]); res.json(result.rows); }
    catch { res.status(500).json({error:'local adapter error'}); }
  });
  gateway.get('/rest/v1/exam_questions', async (req,res) => {
    const id=String(req.query.exam_id||'').replace(/^eq\./,''); questionReads++;
    try { const result=await service.query("select id,position,subject,question_text,option_a,option_b,option_c,option_d,correct_option,explanation from public.exam_questions where exam_id=$1 and review_status<>'rejected' order by position",[id]); res.json(result.rows); }
    catch { res.status(500).json({error:'local adapter error'}); }
  });
  gateway.post('/rest/v1/rpc/check_rate_limit',(_req,res)=>res.json(true));
  backendServer=await listen(gateway);
  Object.assign(process.env,{ NETLIFY:'true', NODE_ENV:'production',VITE_SUPABASE_URL:`http://127.0.0.1:${backendServer.address().port}`,SUPABASE_SERVICE_ROLE_KEY:'sb_secret_synthetic_restricted_rehearsal',SUPABASE_SECRET_KEY:'' });
  const {app}=await import('../server.ts'); appServer=await listen(app); const base=`http://127.0.0.1:${appServer.address().port}`;
  const paper=id=>fetch(`${base}/api/cbt/exams/${id}/guest-questions`);
  const submit=id=>fetch(`${base}/api/cbt/guest-submit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({examId:id,answers:{'1':0}})});
  const openPaper=await paper(publicExam), openResult=await submit(publicExam);
  assert.equal(openPaper.status,200); assert.equal(openResult.status,200);
  assert.equal((await openResult.json()).questions[0].correct_option,'A');
  for (const id of [exam,unknownExam]) {
    const count=questionReads; assert.equal((await paper(id)).status,404); assert.equal((await submit(id)).status,404); assert.equal(questionReads,count);
    // Anonymous restricted/unclassified setup metadata must not be revealed.
    assert.equal((await fetch(`${base}/api/cbt/exams/${id}/subjects`)).status,404);
  }
  console.log('PASS real Express -> local synthetic adapter -> service-role PostgreSQL: public guest corrections work; restricted/unclassified deny before question reads');
  console.log('NOT TESTED: operations overlapping revocation/release commit; hosted Auth/PostgREST; v2 finalization (no gateway)');
} finally {
  await close(appServer); await close(backendServer);
  for (const c of clients) try { await c.end(); } catch {}
  if (started) await pg.stop();
  await rm(dir,{recursive:true,force:true});
}
