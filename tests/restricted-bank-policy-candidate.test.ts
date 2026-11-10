import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// This tests ONLY the non-deployable policy foundation, not end-to-end bank
// secrecy. Existing readers, scoring and service-role routes remain unguarded.
const admin = 'a1000000-0000-4000-8000-000000000001';
const student = 'a1000000-0000-4000-8000-000000000002';
const other = 'a1000000-0000-4000-8000-000000000003';
const serviceAdmin = 'a1000000-0000-4000-8000-000000000004';
const unclassified = 'b1000000-0000-4000-8000-000000000001';
const publicBank = 'b1000000-0000-4000-8000-000000000002';
const restricted = 'b1000000-0000-4000-8000-000000000003';
let db: PGlite;

async function role(roleName: 'anon' | 'authenticated', user?: string) {
  await db.exec('reset role');
  await db.exec(`set role ${roleName}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']);
}
async function access(exam: string) {
  const result = await db.query<{ access: boolean; released: boolean }>(
    'select public.cbt_bank_candidate_access($1) as access, public.cbt_bank_corrections_released($1) as released', [exam],
  );
  return result.rows[0];
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  await db.exec(readFileSync('supabase/candidates/restricted_bank_policy_foundation.sql', 'utf8'));
  await db.exec(readFileSync('supabase/candidates/restricted_bank_readers_candidate.sql', 'utf8'));
  await db.exec(readFileSync('supabase/candidates/restricted_bank_results_candidate.sql', 'utf8'));
  await db.exec(readFileSync('supabase/candidates/restricted_bank_admin_candidate.sql', 'utf8'));
  await db.exec(`
    insert into auth.users(id,email,raw_user_meta_data) values
      ('${admin}','admin@synthetic.test','{}'),('${student}','student@synthetic.test','{}'),
      ('${other}','other@synthetic.test','{}'),('${serviceAdmin}','service@synthetic.test','{}');
    update public.profiles set role='content_editor' where id='${admin}';
    update public.profiles set role='service_admin' where id='${serviceAdmin}';
    insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values
      ('${unclassified}','Unclassified','WAEC','Mathematics',30,true),
      ('${publicBank}','Public','WAEC','Mathematics',30,true),
      ('${restricted}','Restricted','WAEC','Mathematics',30,true);
    insert into public.exam_questions(exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position)
      select e.id,'Mathematics','Synthetic '||n,'A','B','C','D','A',1,n
      from public.cbt_exams e cross join generate_series(1,5) n where e.id in ('${unclassified}','${publicBank}','${restricted}');
  `);
  // Provenance is applied last, like a reviewed change against a live database:
  // it never backfills or reclassifies the rows that already exist.
  await db.exec(readFileSync('supabase/candidates/restricted_question_provenance_candidate.sql', 'utf8'));
});
after(async () => { if (db) await db.close(); });

test('policy tables and admin operations are denied to anon, student, and service-only administrator', async () => {
  await role('anon');
  await assert.rejects(db.query('select * from public.cbt_bank_security'), /permission denied/i);
  await assert.rejects(db.query("select public.cbt_bank_classify($1,'public',null)", [publicBank]), /permission denied/i);
  assert.deepEqual(await access(unclassified), { access: false, released: false });
  for (const user of [student, serviceAdmin]) {
    await role('authenticated', user);
    await assert.rejects(db.query('select * from public.cbt_bank_candidate_assignments'), /permission denied/i);
    await assert.rejects(db.query("select public.cbt_bank_classify($1,'public',null)", [publicBank]), /permission denied/i);
    await assert.rejects(db.query('select * from public.cbt_bank_inventory()'), /permission denied/i);
    await assert.rejects(db.query('select public.cbt_bank_assign($1,$2,true)', [restricted, user]), /permission denied/i);
    await assert.rejects(db.query("select public.cbt_bank_set_release($1,now()+interval '1 day')", [restricted]), /permission denied/i);
  }
});

test('candidate prevents local service administrator profile-role escalation while preserving a profile update', async () => {
  await role('authenticated', serviceAdmin);
  await assert.rejects(db.query("update public.profiles set role='super_admin' where id=$1", [serviceAdmin]), /permission denied/i);
  await assert.rejects(db.query("select public.admin_bootstrap_first_admin($1,$2)", [serviceAdmin,'service@synthetic.test']), /permission denied/i);
  await assert.rejects(db.query("select public.cbt_bank_classify($1,'public',null)", [publicBank]), /permission denied/i);
  await role('authenticated', student);
  const update = await db.query<{full_name:string}>("update public.profiles set full_name='Synthetic student' where id=$1 returning full_name", [student]);
  assert.equal(update.rows[0]?.full_name,'Synthetic student');
});

test('staff inventory is explicit; classification and assignments are administrator actions', async () => {
  await role('authenticated', admin);
  const rows = await db.query<{ exam_id: string; visibility: string | null; question_count: string }>('select * from public.cbt_bank_inventory()');
  assert.equal(rows.rows.find(row => row.exam_id === unclassified)?.visibility, null);
  assert.equal(Number(rows.rows.find(row => row.exam_id === unclassified)?.question_count), 5);
  await assert.rejects(db.query("select public.cbt_bank_classify($1,'restricted',null)", [restricted]), /future/i);
  await db.query("select public.cbt_bank_classify($1,'public',null)", [publicBank]);
  await db.query("select public.cbt_bank_classify($1,'restricted',now()+interval '2 days')", [restricted]);
  await assert.rejects(db.query("select public.cbt_bank_classify($1,'public',null)", [restricted]), /already classified/i);
  await assert.rejects(db.query("select public.cbt_bank_set_release($1,now()-interval '1 second')", [restricted]), /future/i);
  await db.query("select public.cbt_bank_set_release($1,now()+interval '1 day')", [restricted]);
  await db.query('select public.cbt_bank_assign($1,$2,true)', [restricted, student]);
  await assert.rejects(db.query('select public.cbt_bank_assign($1,$2,true)', [publicBank, student]), /restricted bank not found/i);
});

test('database refuses moving question rows between banks', async () => {
  await db.exec('reset role');
  await assert.rejects(db.query('update public.exam_questions set exam_id=$1 where exam_id=$2',[publicBank,restricted]), /security review/i);
});

test('v2 candidate gateway preserves public rehearsal and blocks restricted fallback', async () => {
  await db.exec('reset role');
  const ids = await db.query<{exam_id:string;id:string}>('select exam_id,id from public.exam_questions where exam_id in ($1,$2) order by position',[publicBank,restricted]);
  const publicIds = ids.rows.filter(q => q.exam_id === publicBank).map(q => q.id);
  const restrictedIds = ids.rows.filter(q => q.exam_id === restricted).map(q => q.id);
  await db.exec('set role cbt_v2_executor');
  const create = async (exam:string,owner:string,questions:string[]) => (await db.query<{id:string}>(
    "insert into public.cbt_attempts(user_id,exam_id,status,expires_at,total_questions,question_ids,protocol) values($1,$2,'in_progress',now()+interval '20 minutes',5,$3,'v2') returning id",
    [owner,exam,questions])).rows[0].id;
  const publicAttempt = await create(publicBank,other,publicIds);
  // `other` is not assigned to the restricted bank, so no v2 entry point exists.
  const restrictedAttempt = await create(restricted,other,restrictedIds);
  const key='c1000000-0000-4000-8000-000000000001';
  await role('authenticated', student);
  await assert.rejects(db.query('select public.cbt_v2_session_gateway($1,$2,false)',[restrictedAttempt,key]), /not found/i);
  await assert.rejects(db.query('select public.cbt_v2_answer_gateway($1,$2,0,0,$3,$4,1)',[restrictedAttempt,restrictedIds[0],key,key]), /not found/i);
  await role('authenticated', other);
  const session = await db.query<{result:{sessionId:string;generation:number;outcome:string}}>('select public.cbt_v2_session_gateway($1,$2,false) as result',[publicAttempt,key]);
  assert.equal(session.rows[0].result.outcome,'created');
  const answer = await db.query<{result:{outcome:string}}>('select public.cbt_v2_answer_gateway($1,$2,0,0,$3,$4,$5) as result',
    [publicAttempt,publicIds[0],'c1000000-0000-4000-8000-000000000002',session.rows[0].result.sessionId,session.rows[0].result.generation]);
  assert.equal(answer.rows[0].result.outcome,'accepted');
  await db.exec('reset role; set role cbt_v2_executor');
  await db.query("update public.cbt_attempts set status='expired' where id in ($1,$2)",[publicAttempt,restrictedAttempt]);
  await db.exec('reset role');
});

test('assigned restricted v2 writes a draft without score, correctness or key, and revocation stops it', async () => {
  await db.exec('reset role');
  const ids = await db.query<{id:string}>('select id from public.exam_questions where exam_id=$1 order by position', [restricted]);
  const questionIds = ids.rows.map(row => row.id);
  await db.exec('set role cbt_v2_executor');
  const create = async (exam:string, owner:string, questions:string[]) => (await db.query<{id:string}>(
    "insert into public.cbt_attempts(user_id,exam_id,status,expires_at,total_questions,question_ids,protocol) values($1,$2,'in_progress',now()+interval '20 minutes',5,$3,'v2') returning id",
    [owner,exam,questions])).rows[0].id;
  await db.query("update public.cbt_attempts set status='expired' where status='in_progress' and user_id=$1",[student]);
  const attempt = await create(restricted, student, questionIds);
  const unclassifiedAttempt = await create(unclassified, student, questionIds);
  const key = 'c2000000-0000-4000-8000-000000000001';
  await role('authenticated', student);
  const open = await db.query<{result:{outcome:string;sessionId:string;generation:number}}>('select public.cbt_v2_session_gateway($1,$2,false) as result',[attempt,key]);
  assert.equal(open.rows[0].result.outcome,'created');
  const answer = await db.query<{result:Record<string,unknown>}>('select public.cbt_v2_answer_gateway($1,$2,0,0,$3,$4,$5) as result',
    [attempt,questionIds[0],'c2000000-0000-4000-8000-000000000002',open.rows[0].result.sessionId,open.rows[0].result.generation]);
  assert.equal(answer.rows[0].result.outcome,'accepted');
  assert.deepEqual(answer.rows[0].result.answers,{'1':0});
  assert.doesNotMatch(JSON.stringify(answer.rows[0].result),/score|correct|explanation/i);
  assert.equal((await db.query('select score,correct_answers from public.cbt_attempts where id=$1',[attempt])).rows.length,0);
  await assert.rejects(db.query('select public.cbt_v2_session_gateway($1,$2,false)',[unclassifiedAttempt,key]), /not found/i);
  // Revocation is read live by the predicate on the very next operation.
  await role('authenticated', student);
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  await db.query('select public.cbt_bank_assign($1,$2,false)',[restricted,student]);
  await role('authenticated', student);
  await assert.rejects(db.query('select public.cbt_v2_session_gateway($1,$2,true)',[attempt,'c2000000-0000-4000-8000-000000000003']), /not found/i);
  await assert.rejects(db.query('select public.cbt_v2_answer_gateway($1,$2,1,1,$3,$4,1)',[attempt,questionIds[0],'c2000000-0000-4000-8000-000000000004',open.rows[0].result.sessionId]), /not found/i);
  // The scorer has no authenticated gateway, so finalization cannot leak a score.
  const finalize = await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','public.cbt_candidate_finalize(uuid,bigint,uuid,uuid)','execute') as allowed");
  assert.equal(finalize.rows[0].allowed,false);
  await assert.rejects(db.query('select public.cbt_unchecked_v2_answer_candidate($1,$2,0,0,$3,$4,1)',
    [attempt,questionIds[0],'c2000000-0000-4000-8000-000000000005',open.rows[0].result.sessionId]), /permission denied/i);
  await role('authenticated', admin);
  await db.query('select public.cbt_bank_assign($1,$2,true)',[restricted,student]);
  await db.exec('reset role; set role cbt_v2_executor');
  await db.query("update public.cbt_attempts set status='expired' where id in ($1,$2)",[attempt,unclassifiedAttempt]);
  await db.exec('reset role');
});

test('candidate reader and start guards allow public and assigned users while denying other calls', async () => {
  await role('authenticated', other);
  assert.equal((await db.query('select * from public.get_cbt_questions($1)', [unclassified])).rows.length, 0);
  assert.equal((await db.query('select * from public.get_cbt_questions_for_subjects($1,array[$2])', [restricted, 'Mathematics'])).rows.length, 0);
  assert.equal((await db.query('select * from public.get_cbt_questions($1)', [publicBank])).rows.length, 5);
  await assert.rejects(db.query("select * from public.start_cbt_attempt_configured($1,array['Mathematics'],5,null,'practice',null)", [restricted]), /not available/i);
  await assert.rejects(db.query('select * from public.start_cbt_attempt($1)', [unclassified]), /not available/i);
  await assert.rejects(db.query('select * from public.cbt_unchecked_questions_candidate($1)', [restricted]), /permission denied/i);
  await assert.rejects(db.query("select public.plan_cbt_paper($1,array['Mathematics'],5,'{}')", [restricted]), /permission denied/i);
  const v2 = await db.query<{enabled:boolean}>("select has_function_privilege('authenticated','public.cbt_start_attempt_v2(uuid,text[],integer,integer,text,text)','execute') as enabled");
  assert.equal(v2.rows[0].enabled,false);
  await role('authenticated', student);
  assert.equal((await db.query('select * from public.get_cbt_questions_for_subjects($1,array[$2])', [restricted, 'Mathematics'])).rows.length, 5);
  const result = await db.query<{attempt_id:string}>("select * from public.start_cbt_attempt_configured($1,array['Mathematics'],5,null,'practice',null)", [restricted]);
  const attempt = result.rows[0].attempt_id;
  assert.equal((await db.query('select * from public.get_cbt_attempt_paper($1)', [attempt])).rows.length, 5);
  await role('authenticated', other);
  await assert.rejects(db.query('select * from public.get_cbt_attempt_paper($1)', [attempt]), /not found/i);
});

test('classified public practice retains its score, corrections and owner-scoped table access', async () => {
  await role('authenticated', other);
  const attempt = (await db.query<{attempt_id:string}>("select * from public.start_cbt_attempt_configured($1,array['Mathematics'],5,null,'practice',null)", [publicBank])).rows[0].attempt_id;
  const submitted = (await db.query<{score:string|number;breakdown:Array<{correct:number}>}>(
    'select * from public.submit_cbt_attempt_configured($1,$2::jsonb)', [attempt, JSON.stringify({'1':0,'2':0,'3':0,'4':0,'5':0})])).rows[0];
  assert.equal(Number(submitted.score),100);
  assert.equal(submitted.breakdown.length,5);
  assert.equal(submitted.breakdown[0].correct,0);
  assert.equal((await db.query('select score from public.cbt_attempts where id=$1',[attempt])).rows.length,1);
  assert.equal((await db.query('select * from public.get_cbt_result($1)',[attempt])).rows.length,5);
  const oldAttempt = (await db.query<{attempt_id:string}>('select * from public.start_cbt_attempt($1)',[publicBank])).rows[0].attempt_id;
  const legacy = (await db.query<{score:string|number;breakdown:unknown[]}>('select * from public.submit_cbt_attempt($1,$2,$3::jsonb)', [oldAttempt,publicBank,JSON.stringify({'1':0})])).rows[0];
  assert.equal(Number(legacy.score),20);
  assert.equal(legacy.breakdown.length,5);
  await role('authenticated', student);
  assert.equal((await db.query('select score from public.cbt_attempts where id=$1',[attempt])).rows.length,0);
});

test('candidate embargo hides scores, keys and direct attempt rows across repeated legacy submissions', async () => {
  await role('authenticated', student);
  const start = async () => (await db.query<{attempt_id:string}>("select * from public.start_cbt_attempt_configured($1,array['Mathematics'],5,null,'practice',null)", [restricted])).rows[0].attempt_id;
  const firstId = await start();
  await assert.rejects(db.query("select * from public.submit_cbt_attempt($1,$2,'{}'::jsonb)", [firstId,restricted]), /legacy submission is unavailable/i);
  const first = (await db.query<{score:number|null; correct_answers:number|null; breakdown:unknown[]}>(
    'select * from public.submit_cbt_attempt_configured($1,$2::jsonb)', [firstId, JSON.stringify({'1':0,'2':0,'3':0,'4':0,'5':0})])).rows[0];
  assert.deepEqual({score:first.score, correct:first.correct_answers, breakdown:first.breakdown}, {score:null,correct:null,breakdown:[]});
  const secondId = await start();
  const second = (await db.query<{score:number|null; correct_answers:number|null; breakdown:unknown[]}>(
    'select * from public.submit_cbt_attempt_configured($1,$2::jsonb)', [secondId, JSON.stringify({'1':1,'2':0,'3':0,'4':0,'5':0})])).rows[0];
  assert.deepEqual({score:second.score, correct:second.correct_answers, breakdown:second.breakdown}, {score:null,correct:null,breakdown:[]});
  assert.equal((await db.query('select score,correct_answers from public.cbt_attempts where id=$1', [firstId])).rows.length, 0);
  assert.equal((await db.query('select * from public.get_cbt_result($1)', [firstId])).rows.length, 0);
  const history = await db.query<{score:null;correct_answers:null;answered:null}>("select score,correct_answers,answered from public.get_cbt_attempt_history(20) where status='submitted'");
  assert.equal(history.rows.length, 2);
  assert.ok(history.rows.every(row => row.score === null && row.correct_answers === null && row.answered === null));
  await assert.rejects(db.query("select * from public.cbt_unchecked_submit_configured_candidate($1,'{}')", [firstId]), /permission denied/i);
  const retry = (await db.query<{score:null;breakdown:unknown[]}>('select * from public.submit_cbt_attempt_configured($1,$2::jsonb)', [firstId,'{}'])).rows[0];
  assert.equal(retry.score,null); assert.deepEqual(retry.breakdown,[]);
  await role('authenticated', other);
  assert.equal((await db.query('select * from public.get_cbt_result($1)', [firstId])).rows.length, 0);
  await assert.rejects(db.query('select public.cbt_public_score_average()'), /permission denied/i);
  await db.exec('reset role; set role service_role');
  const avg = await db.query<{value:number|string}>('select public.cbt_public_score_average() as value');
  assert.equal(Number(avg.rows[0].value),60, 'restricted 100 and 80 do not enter the public average');
});

test('release predicate uses an inclusive exact timestamp boundary', async () => {
  await db.exec('reset role');
  await db.exec('begin');
  try {
    for (const [delta, released] of [["interval '1 microsecond'",false],["interval '0 seconds'",true],["interval '-1 microsecond'",true]] as const) {
      await db.exec('reset role');
      await db.query(`update public.cbt_bank_security set correction_release_at=transaction_timestamp()+${delta} where exam_id=$1`, [restricted]);
      await db.exec('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[student]);
      assert.equal((await access(restricted)).released,released);
    }
  } finally { await db.exec('rollback'); }
});

test('policy predicates distinguish unclassified, public, assigned, unassigned and released states', async () => {
  await role('anon');
  assert.deepEqual(await access(unclassified), { access: false, released: false });
  assert.deepEqual(await access(publicBank), { access: true, released: true });
  assert.deepEqual(await access(restricted), { access: false, released: false });
  await role('authenticated', other);
  assert.deepEqual(await access(restricted), { access: false, released: false });
  await role('authenticated', student);
  assert.deepEqual(await access(restricted), { access: true, released: false });
  // Simulate passage of the release time in synthetic data with the disposable
  // owner role; application roles cannot directly update this table.
  await db.exec('reset role');
  await db.query("update public.cbt_bank_security set correction_release_at=now()-interval '1 second' where exam_id=$1", [restricted]);
  await role('authenticated', student);
  assert.deepEqual(await access(restricted), { access: true, released: true });
  const visible = await db.query<{id:string;score:string|number}>("select id,score from public.cbt_attempts where exam_id=$1 and status='submitted' order by score desc", [restricted]);
  assert.deepEqual(visible.rows.map(row => Number(row.score)), [100,80]);
  const result = await db.query<{correct_option:string}>('select correct_option from public.get_cbt_result($1)', [visible.rows[0].id]);
  assert.equal(result.rows.length,5);
  assert.ok(result.rows.every(row => row.correct_option === 'A'));
  await role('authenticated', other);
  assert.equal((await db.query('select * from public.get_cbt_result($1)', [visible.rows[0].id])).rows.length,0);
  assert.deepEqual(await access(restricted), { access: false, released: false });
  await role('authenticated', admin);
  await assert.rejects(db.query("select public.cbt_bank_set_release($1,now()+interval '1 day')", [restricted]), /cannot be undone/i);
  await db.query('select public.cbt_bank_assign($1,$2,false)', [restricted, student]);
  await db.query('select public.cbt_bank_assign($1,$2,true)', [restricted, other]);
  await role('authenticated', student);
  assert.deepEqual(await access(restricted), { access: false, released: false });
  assert.equal((await db.query('select * from public.get_cbt_questions($1)',[restricted])).rows.length,0);
  assert.equal((await db.query('select * from public.get_cbt_result($1)',[visible.rows[0].id])).rows.length,0);
  await assert.rejects(db.query('select * from public.get_cbt_attempt_paper($1)',[visible.rows[0].id]), /not found/i);
  await assert.rejects(db.query("select * from public.submit_cbt_attempt_configured($1,'{}')",[visible.rows[0].id]), /not found/i);
  await role('authenticated', other);
  assert.deepEqual(await access(restricted), { access: true, released: true });
  assert.equal((await db.query('select * from public.get_cbt_result($1)',[visible.rows[0].id])).rows.length,0);
});

// --- In-flight release and revocation guarantees ---------------------------
// These tests use one connection, so they prove the committed-state semantics
// (what a revoked or un-released caller can see and write). The true in-flight
// interleaving is proven against real concurrent sessions in
// scripts/rehearse-restricted-bank-concurrency.mjs.

async function resetRestricted(exam: string, release: string) {
  await db.exec('reset role');
  await db.query(`update public.cbt_bank_security set correction_release_at=${release} where exam_id=$1`, [exam]);
  await db.exec("update public.cbt_attempts set status='expired' where status='in_progress'");
}

test('revocation blocks every protected operation on an attempt opened while assigned', async () => {
  await resetRestricted(restricted, "now()+interval '1 day'");
  await role('authenticated', admin);
  await db.query('select public.cbt_bank_assign($1,$2,true)', [restricted, student]);
  await role('authenticated', student);
  const attempt = (await db.query<{attempt_id:string}>(
    "select * from public.start_cbt_attempt_configured($1,array['Mathematics'],5,null,'practice',null)", [restricted])).rows[0].attempt_id;
  await db.query('select public.save_cbt_attempt_draft($1,$2::jsonb,2)', [attempt, JSON.stringify({'1':0,'2':0})]);
  assert.equal((await db.query('select * from public.get_cbt_attempt_paper($1)',[attempt])).rows.length, 5);
  // Revoke while the attempt is still open, then repeat every protected call.
  await role('authenticated', admin);
  await db.query('select public.cbt_bank_assign($1,$2,false)', [restricted, student]);
  await role('authenticated', student);
  await assert.rejects(db.query('select * from public.get_cbt_attempt_paper($1)',[attempt]), /not found/i);
  await assert.rejects(db.query('select public.save_cbt_attempt_draft($1,$2::jsonb,2)',[attempt,'{}']), /not found/i);
  await assert.rejects(db.query("select * from public.submit_cbt_attempt_configured($1,'{}'::jsonb)",[attempt]), /not found/i);
  await assert.rejects(db.query("select * from public.submit_cbt_attempt($1,$2,'{}'::jsonb)",[attempt,restricted]), /not found/i);
  assert.equal((await db.query('select * from public.get_cbt_result($1)',[attempt])).rows.length, 0);
  assert.equal((await db.query('select * from public.get_cbt_attempt_history(50)')).rows.length, 0);
  assert.equal((await db.query('select id from public.cbt_attempts where id=$1',[attempt])).rows.length, 0);
  assert.equal((await db.query('select * from public.get_cbt_questions($1)',[restricted])).rows.length, 0);
  // The attempt was not silently submitted by any refused call.
  await db.exec('reset role');
  assert.equal((await db.query<{status:string}>('select status from public.cbt_attempts where id=$1',[attempt])).rows[0].status, 'in_progress');
});

test('released corrections stay assignment-scoped and never follow a new assignment', async () => {
  // Release time is in the past: only assignment remains as the gate.
  await resetRestricted(restricted, "now()-interval '1 second'");
  await role('authenticated', admin);
  await db.query('select public.cbt_bank_assign($1,$2,true)', [restricted, student]);
  await db.query('select public.cbt_bank_assign($1,$2,false)', [restricted, other]);
  await role('authenticated', student);
  const attempt = (await db.query<{attempt_id:string}>(
    "select * from public.start_cbt_attempt_configured($1,array['Mathematics'],5,null,'practice',null)", [restricted])).rows[0].attempt_id;
  // The scorer is reached through the guarded wrapper only.
  await db.query("select * from public.submit_cbt_attempt_configured($1,$2::jsonb)", [attempt, JSON.stringify({'1':0,'2':0,'3':0,'4':0,'5':0})]);
  assert.equal((await db.query('select * from public.get_cbt_result($1)',[attempt])).rows.length, 5);
  const history = await db.query<{score:number|null}>('select score from public.get_cbt_attempt_history(50)');
  assert.ok(history.rows.some(row => row.score !== null));
  // Revoking after release removes the ability to obtain the corrections.
  await role('authenticated', admin);
  await db.query('select public.cbt_bank_assign($1,$2,false)', [restricted, student]);
  await role('authenticated', student);
  assert.deepEqual(await access(restricted), { access: false, released: false });
  assert.equal((await db.query('select * from public.get_cbt_result($1)',[attempt])).rows.length, 0);
  assert.equal((await db.query('select * from public.get_cbt_attempt_history(50)')).rows.length, 0);
  assert.equal((await db.query('select id from public.cbt_attempts where id=$1',[attempt])).rows.length, 0);
  // A different candidate who is assigned now does not inherit that attempt.
  await role('authenticated', admin);
  await db.query('select public.cbt_bank_assign($1,$2,true)', [restricted, other]);
  await role('authenticated', other);
  assert.deepEqual(await access(restricted), { access: true, released: true });
  assert.equal((await db.query('select * from public.get_cbt_result($1)',[attempt])).rows.length, 0);
  await assert.rejects(db.query('select * from public.get_cbt_attempt_paper($1)',[attempt]), /not found/i);
  const otherHistory = await db.query('select attempt_id from public.get_cbt_attempt_history(50)');
  assert.ok(!otherHistory.rows.some((row) => (row as {attempt_id:string}).attempt_id === attempt));
  await role('authenticated', admin);
  await db.query('select public.cbt_bank_assign($1,$2,false)', [restricted, other]);
});

test('pre-release responses are identical for correct and incorrect answers, across repeats and history', async () => {
  await resetRestricted(restricted, "now()+interval '1 day'");
  await role('authenticated', admin);
  await db.query('select public.cbt_bank_assign($1,$2,true)', [restricted, student]);
  await role('authenticated', student);
  const start = async () => (await db.query<{attempt_id:string}>(
    "select * from public.start_cbt_attempt_configured($1,array['Mathematics'],5,null,'practice',null)", [restricted])).rows[0].attempt_id;
  const right = JSON.stringify({'1':0,'2':0,'3':0,'4':0,'5':0});
  const wrong = JSON.stringify({'1':3,'2':3,'3':3,'4':3,'5':3});
  const best = (await db.query<Record<string, unknown>>('select * from public.submit_cbt_attempt_configured($1,$2::jsonb)', [await start(), right])).rows[0];
  const worst = (await db.query<Record<string, unknown>>('select * from public.submit_cbt_attempt_configured($1,$2::jsonb)', [await start(), wrong])).rows[0];
  const repeat = (await db.query<Record<string, unknown>>('select * from public.submit_cbt_attempt_configured($1,$2::jsonb)', [best.attempt_id as string, wrong])).rows[0];
  const shape = (row: Record<string, unknown>) => ({ score: row.score, correct_answers: row.correct_answers, total_questions: row.total_questions, breakdown: row.breakdown });
  // A correct and an incorrect submission are indistinguishable before release.
  assert.deepEqual(shape(best), shape(worst));
  assert.deepEqual(shape(best), { score: null, correct_answers: null, total_questions: 5, breakdown: [] });
  // Re-submitting with different answers does not change or reveal anything.
  assert.deepEqual(shape(repeat), shape(best));
  // No alternate channel exposes correctness or the key.
  assert.equal((await db.query('select * from public.get_cbt_result($1)',[best.attempt_id])).rows.length, 0);
  assert.equal((await db.query('select * from public.get_cbt_result($1)',[worst.attempt_id])).rows.length, 0);
  const history = await db.query<Record<string, unknown>>(
    'select attempt_id,score,correct_answers,answered from public.get_cbt_attempt_history(50) where attempt_id=any($1)',
    [[best.attempt_id, worst.attempt_id]]);
  assert.equal(history.rows.length, 2, 'both attempts are listed as submitted');
  assert.ok(history.rows.every(row => row.score === null && row.correct_answers === null && row.answered === null));
  assert.equal((await db.query('select id,score,correct_answers from public.cbt_attempts where id=any($1)',[[best.attempt_id,worst.attempt_id]])).rows.length, 0);
  await assert.rejects(db.query('select * from public.cbt_answers limit 1'), /permission denied/i);
  await assert.rejects(db.query('select public.cbt_public_score_average()'), /permission denied/i);
  const questions = await db.query<Record<string, unknown>>('select * from public.get_cbt_questions($1)',[restricted]);
  assert.equal(questions.rows.length, 5);
  assert.deepEqual(Object.keys(questions.rows[0]).sort(), ['option_a','option_b','option_c','option_d','position','question_text']);
  await role('authenticated', other);
  assert.equal((await db.query('select * from public.get_cbt_result($1)',[best.attempt_id])).rows.length, 0);
  assert.equal((await db.query('select * from public.get_cbt_questions($1)',[restricted])).rows.length, 0);
  await role('authenticated', admin);
  await db.query('select public.cbt_bank_assign($1,$2,false)', [restricted, student]);
});

test('release boundary is decided by the database clock at the response level', async () => {
  await db.exec('reset role');
  await db.exec('begin');
  try {
    await db.exec("update public.cbt_attempts set status='expired' where status='in_progress'");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
    await db.query('select public.cbt_bank_assign($1,$2,true)', [restricted, student]);
    const submit = async (answers: string) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[student]);
      await db.exec('set role authenticated');
      const id = (await db.query<{attempt_id:string}>(
        "select * from public.start_cbt_attempt_configured($1,array['Mathematics'],5,null,'practice',null)", [restricted])).rows[0].attempt_id;
      return (await db.query<Record<string, unknown>>('select * from public.submit_cbt_attempt_configured($1,$2::jsonb)', [id, answers])).rows[0];
    };
    const answers = JSON.stringify({'1':0,'2':0,'3':0,'4':0,'5':0});
    // Immediately before release (one microsecond out).
    await db.exec('reset role');
    await db.query("update public.cbt_bank_security set correction_release_at=transaction_timestamp()+interval '1 microsecond' where exam_id=$1",[restricted]);
    const before = await submit(answers);
    assert.equal(before.score, null);
    assert.deepEqual(before.breakdown, []);
    // Exactly at release: the boundary is inclusive and the score is released.
    await db.exec('reset role');
    await db.query("update public.cbt_bank_security set correction_release_at=transaction_timestamp() where exam_id=$1",[restricted]);
    const at = await submit(answers);
    assert.equal(Number(at.score), 100);
    assert.equal((at.breakdown as unknown[]).length, 5);
    // Immediately after release.
    await db.exec('reset role');
    await db.query("update public.cbt_bank_security set correction_release_at=transaction_timestamp()-interval '1 microsecond' where exam_id=$1",[restricted]);
    const after = await submit(answers);
    assert.equal(Number(after.score), 100);
    // The release decision never depended on a client clock: the same request
    // body changes result only when the database state changes.
    assert.equal(before.total_questions, after.total_questions);
  } finally {
    await db.exec('rollback');
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
    await db.query('select public.cbt_bank_assign($1,$2,false)', [restricted, student]);
    await db.query("update public.cbt_bank_security set correction_release_at=now()+interval '1 day' where exam_id=$1",[restricted]);
    await db.exec('reset role');
  }
});

// --- Bank administration, audit and publication ---------------------------
const adminUnclassified = 'b1000000-0000-4000-8000-000000000004';
const adminRestricted = 'b1000000-0000-4000-8000-000000000005';
const importPublic = 'b1000000-0000-4000-8000-000000000006';
const importRestricted = 'b1000000-0000-4000-8000-000000000007';
const pendingUnclassified = 'b1000000-0000-4000-8000-00000000000a';

async function seedBanks() {
  await db.exec('reset role');
  await db.query(`insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values
      ($1,'Admin unclassified','WAEC','Mathematics',30,true),
      ($2,'Admin restricted','WAEC','Mathematics',30,true),
      ($3,'Import public','WAEC','Mathematics',30,true),
      ($4,'Import restricted','WAEC','Mathematics',30,true)`,
    [adminUnclassified, adminRestricted, importPublic, importRestricted]);
  await db.query(`insert into public.exam_questions(exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position)
    select e.id,'Mathematics','Seeded '||e.title,'A','B','C','D','A',1,1
    from public.cbt_exams e where e.id in ($1,$2,$3,$4)`,
    [adminUnclassified, adminRestricted, importPublic, importRestricted]);
}
async function auditRows(exam: string) {
  await db.exec('reset role');
  return (await db.query<{action: string; admin_user_id: string; metadata: Record<string, unknown>}>(
    "select action, admin_user_id, metadata from public.admin_audit_logs where entity_type='cbt_bank' and entity_id=$1 order by created_at",
    [exam])).rows;
}
async function importBatch(exam: string, rows: Array<{ text: string; correct: string | null }>, storage: string) {
  await db.exec('reset role');
  const importId = (await db.query<{id: string}>(`insert into public.question_imports
      (exam_id,exam_body,subject,paper_year,original_filename,mime_type,file_bytes,checksum,storage_path,status,item_count,approved_count)
      values ($1,'WAEC','Mathematics',2024,'synthetic.pdf','application/pdf',1024,$2,$3,'extracted',$4,$4) returning id`,
    [exam, 'a'.repeat(63) + String(rows.length % 10), storage, rows.length])).rows[0].id;
  for (const [index, row] of rows.entries()) {
    await db.query(`insert into public.question_import_items(import_id,source_index,question_text,option_a,option_b,option_c,option_d,correct_option,review_status)
      values ($1,$2,$3,'Alpha','Bravo','Charlie','Delta',$4,'approved')`,
      [importId, index + 1, row.text, row.correct]);
  }
  return importId;
}

test('bank inventory and classification are administrator-only, explicit and audited', async () => {
  await seedBanks();
  await role('authenticated', student);
  await assert.rejects(db.query('select * from public.cbt_bank_admin_inventory()'), /permission denied/i);
  await assert.rejects(db.query("select public.cbt_bank_classify($1,'public',null)", [adminUnclassified]), /permission denied/i);
  await assert.rejects(db.query('select public.cbt_bank_admin_assign($1,$2,true)', [adminRestricted, student]), /permission denied/i);
  await assert.rejects(db.query('select * from public.cbt_bank_admin_history($1,10)', [adminRestricted]), /permission denied/i);
  await role('authenticated', serviceAdmin);
  await assert.rejects(db.query('select * from public.cbt_bank_admin_inventory()'), /permission denied/i);
  await assert.rejects(db.query("select public.cbt_bank_classify($1,'public',null)", [adminUnclassified]), /permission denied/i);
  await assert.rejects(db.query("update public.profiles set role='super_admin' where id=$1", [serviceAdmin]), /permission denied/i);

  await role('authenticated', admin);
  const inventory = await db.query<{exam_id: string; visibility: string | null; question_count: string; released: boolean}>('select * from public.cbt_bank_admin_inventory()');
  const unclassifiedRow = inventory.rows.find((row) => row.exam_id === adminUnclassified)!;
  assert.equal(unclassifiedRow.visibility, null, 'an unclassified bank is never reported as public');
  assert.equal(Number(unclassifiedRow.question_count), 1);
  assert.equal(unclassifiedRow.released, false);
  // Public/restricted classification requires a future release time.
  await assert.rejects(db.query("select public.cbt_bank_classify($1,'restricted',null)", [adminRestricted]), /future/i);
  await db.query("select public.cbt_bank_classify($1,'restricted',now()+interval '3 days')", [adminRestricted]);
  await db.query("select public.cbt_bank_classify($1,'public',null)", [adminUnclassified]);
  await assert.rejects(db.query("select public.cbt_bank_classify($1,'public',null)", [adminUnclassified]), /already classified/i);
  const classified = await auditRows(adminUnclassified);
  assert.equal(classified.length, 1);
  assert.equal(classified[0].action, 'bank_classified');
  assert.equal(classified[0].admin_user_id, admin);
  assert.deepEqual(Object.keys(classified[0].metadata).sort(), ['correction_release_at', 'visibility']);
  assert.doesNotMatch(JSON.stringify(classified), /correct_option|explanation|answer/i);
});

test('assignment, revocation and reassignment are recorded and administrator-only', async () => {
  await role('authenticated', admin);
  await assert.rejects(db.query('select public.cbt_bank_admin_assign($1,$2,true)', [adminRestricted, 'a1000000-0000-4000-8000-0000000000ff']), /candidate account not found/i);
  await db.query('select public.cbt_bank_admin_assign($1,$2,true)', [adminRestricted, student]);
  await db.query('select public.cbt_bank_admin_assign($1,$2,true)', [adminRestricted, other]);
  const active = await db.query<{user_id: string; status: string}>('select user_id,status from public.cbt_bank_admin_candidates($1)', [adminRestricted]);
  assert.equal(active.rows.length, 2);
  assert.ok(active.rows.every((row) => row.status === 'active'));
  await db.query('select public.cbt_bank_admin_assign($1,$2,false)', [adminRestricted, other]);
  const list = await db.query<{user_id: string; status: string; revoked_at: string | null}>('select user_id,status,revoked_at from public.cbt_bank_admin_candidates($1)', [adminRestricted]);
  const otherRow = list.rows.find((row) => row.user_id === other)!;
  assert.equal(otherRow.status, 'revoked');
  assert.ok(otherRow.revoked_at);
  // A revoked candidate really loses access, and reassignment restores it.
  await role('authenticated', other);
  assert.equal((await db.query('select * from public.get_cbt_questions($1)', [adminRestricted])).rows.length, 0);
  await role('authenticated', admin);
  await db.query('select public.cbt_bank_admin_assign($1,$2,true)', [adminRestricted, other]);
  await role('authenticated', other);
  assert.equal((await db.query('select * from public.get_cbt_questions($1)', [adminRestricted])).rows.length, 1);
  const history = await auditRows(adminRestricted);
  const actions = history.map((row) => row.action);
  assert.ok(actions.includes('bank_candidate_assigned'));
  assert.ok(actions.includes('bank_candidate_revoked'));
  assert.ok(actions.includes('bank_candidate_reassigned'));
  assert.doesNotMatch(JSON.stringify(history), /correct_option|explanation|selected/i);
  await role('authenticated', admin);
  const staff = await db.query<{assigned_count: string; revoked_count: string}>(
    "select assigned_count,revoked_count from public.cbt_bank_admin_inventory() where exam_id=$1", [adminRestricted]);
  assert.equal(Number(staff.rows[0].assigned_count), 2);
  assert.equal(Number(staff.rows[0].revoked_count), 0);
});

test('correction release changes are administrator-only, future-only and audited', async () => {
  await role('authenticated', student);
  await assert.rejects(db.query("select public.cbt_bank_set_release($1,now()+interval '1 day')", [adminRestricted]), /permission denied/i);
  await role('authenticated', admin);
  await assert.rejects(db.query("select public.cbt_bank_set_release($1,now()-interval '1 minute')", [adminRestricted]), /future/i);
  await db.query("select public.cbt_bank_set_release($1,now()+interval '4 days')", [adminRestricted]);
  const history = await auditRows(adminRestricted);
  const release = history.filter((row) => row.action === 'bank_release_changed');
  assert.equal(release.length, 1);
  assert.equal(release[0].admin_user_id, admin);
  assert.deepEqual(Object.keys(release[0].metadata).sort(), ['from', 'to', 'visibility']);
  // An administrator cannot expose corrections early by moving the date back.
  await db.exec('reset role');
  await db.query("update public.cbt_bank_security set correction_release_at=now()-interval '1 second' where exam_id=$1", [adminRestricted]);
  await role('authenticated', admin);
  await assert.rejects(db.query("select public.cbt_bank_set_release($1,now()+interval '1 day')", [adminRestricted]), /cannot be undone/i);
});

test('publication into an unclassified bank is refused, audited and leaves nothing behind', async () => {
  // A bank that was never classified stays unclassified even when the rest of
  // the suite has classified the neighbouring fixture banks.
  await db.exec('reset role');
  await db.query("insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values ($1,'Never classified','WAEC','Mathematics',30,true)", [pendingUnclassified]);
  await db.query("insert into public.exam_questions(exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position) values ($1,'Mathematics','Pre-existing','A','B','C','D','A',1,1)", [pendingUnclassified]);
  const importId = await importBatch(pendingUnclassified, [{ text: 'What is the capital of France?', correct: 'A' }], 'synthetic/unclassified.pdf');
  await db.exec('set role service_role');
  await assert.rejects(
    db.query('select public.commit_question_import($1,$2)', [importId, admin]),
    /has not been classified/i,
  );
  await db.exec('reset role');
  const count = await db.query<{count: string}>('select count(*) from public.exam_questions where exam_id=$1', [pendingUnclassified]);
  assert.equal(Number(count.rows[0].count), 1, 'no question was published into the unclassified bank');
  const item = await db.query<{review_status: string}>('select review_status from public.question_import_items where import_id=$1', [importId]);
  assert.equal(item.rows[0].review_status, 'approved');
  const refusedPublication = await auditRows(pendingUnclassified);
  assert.equal(refusedPublication.filter((row) => row.action === 'bank_questions_published').length, 0,
    'a refused publication records no success audit');
  // The direct (renamed) publisher is not reachable by any application role.
  for (const r of ['anon', 'authenticated'] as const) {
    await db.exec(`reset role; set role ${r}`);
    await assert.rejects(db.query('select public.cbt_unchecked_commit_question_import($1)', [importId]), /permission denied/i);
  }
  await role('authenticated', student);
  await assert.rejects(db.query('select public.commit_question_import($1,$2)', [importId, student]), /permission denied/i);
});

test('publication checks the administrator, inherits the bank classification and publishes atomically', async () => {
  // An unknown import is never published.
  await db.exec('reset role; set role service_role');
  await assert.rejects(db.query('select public.commit_question_import($1,$2)', ['00000000-0000-4000-8000-000000000000', admin]), /import not found/i);
  await db.exec('reset role');

  // Publish into an explicitly public bank.
  await role('authenticated', admin);
  await db.query("select public.cbt_bank_classify($1,'public',null)", [importPublic]);
  await db.exec('reset role');
  const good = await importBatch(importPublic, [
    { text: 'Which gas do plants absorb during photosynthesis?', correct: 'A' },
    { text: 'What is the chemical symbol for sodium?', correct: 'B' },
  ], 'synthetic/public.pdf');
  // A signed-in non-administrator is never accepted as the approving actor,
  // even when the publisher calls with the service role.
  await db.exec('set role service_role');
  await assert.rejects(db.query('select public.commit_question_import($1,$2)', [good, student]), /permission denied/i);
  await assert.rejects(db.query('select public.commit_question_import($1,$2)', [good, serviceAdmin]), /permission denied/i);
  const published = await db.query<{result: {inserted: number; remaining: number}}>('select public.commit_question_import($1,$2) as result', [good, admin]);
  assert.equal(Number(published.rows[0].result.inserted), 2);
  await db.exec('reset role');
  const publishedRows = await db.query('select id from public.exam_questions where exam_id=$1', [importPublic]);
  assert.equal(publishedRows.rows.length, 3);
  const audit = await auditRows(importPublic);
  const publication = audit.find((row) => row.action === 'bank_questions_published')!;
  assert.equal(publication.admin_user_id, admin);
  assert.equal(publication.metadata.visibility, 'public');
  assert.doesNotMatch(JSON.stringify(audit), /Alpha|Bravo|Charlie|correct_option|explanation/);

  // The same batch shape publishes into a restricted bank without exposing keys.
  await role('authenticated', admin);
  await db.query("select public.cbt_bank_classify($1,'restricted',now()+interval '2 days')", [importRestricted]);
  await db.exec('reset role');
  const restrictedImport = await importBatch(importRestricted, [{ text: 'Confidential question text one?', correct: 'C' }], 'synthetic/restricted.pdf');
  await db.exec('set role service_role');
  const restrictedResult = await db.query<{result: {inserted: number}}>('select public.commit_question_import($1,$2) as result', [restrictedImport, admin]);
  assert.equal(Number(restrictedResult.rows[0].result.inserted), 1);
  await db.exec('reset role');
  const restrictedAudit = await auditRows(importRestricted);
  assert.ok(restrictedAudit.some((row) => row.action === 'bank_questions_published' && row.metadata.visibility === 'restricted'));
});

test('an invalid approved batch publishes nothing', async () => {
  await db.exec('reset role');
  const bank = 'b1000000-0000-4000-8000-000000000008';
  await db.query("insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values ($1,'Atomic import','WAEC','Mathematics',30,true)", [bank]);
  await role('authenticated', admin);
  await db.query("select public.cbt_bank_classify($1,'public',null)", [bank]);
  await db.exec('reset role');
  const importId = await importBatch(bank, [
    { text: 'A valid question that must not publish alone?', correct: 'A' },
    { text: 'short', correct: null },
  ], 'synthetic/atomic.pdf');
  await db.exec('set role service_role');
  await assert.rejects(db.query('select public.commit_question_import($1,$2)', [importId, admin]), /invalid or incomplete/i);
  await db.exec('reset role');
  assert.equal((await db.query('select id from public.exam_questions where exam_id=$1', [bank])).rows.length, 0, 'the batch rolled back completely');
  const status = await db.query<{status: string; imported_count: number}>('select status,imported_count from public.question_imports where id=$1', [importId]);
  assert.equal(status.rows[0].status, 'extracted');
  assert.equal(Number(status.rows[0].imported_count), 0);
});

test('a reviewed import cannot be repointed between differently classified banks', async () => {
  await db.exec('reset role');
  const movePublic = 'b1000000-0000-4000-8000-00000000000b';
  const moveRestricted = 'b1000000-0000-4000-8000-00000000000c';
  await db.query(`insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values
      ($1,'Move public','WAEC','Mathematics',30,true),
      ($2,'Move restricted','WAEC','Mathematics',30,true)`, [movePublic, moveRestricted]);
  await role('authenticated', admin);
  await db.query("select public.cbt_bank_classify($1,'public',null)", [movePublic]);
  await db.query("select public.cbt_bank_classify($1,'restricted',now()+interval '2 days')", [moveRestricted]);
  await db.exec('reset role');
  const restrictedImport = await importBatch(moveRestricted, [{ text: 'Move attempt question text here?', correct: 'A' }], 'synthetic/move.pdf');
  // Restricted -> public and public -> restricted are both refused.
  await assert.rejects(db.query('update public.question_imports set exam_id=$1 where id=$2', [movePublic, restrictedImport]), /differently classified banks/i);
  await assert.rejects(db.query('update public.question_imports set exam_id=$1 where id=$2', [moveRestricted, await importBatch(movePublic, [], 'synthetic/move-back.pdf')]), /differently classified banks/i);
  assert.equal((await db.query<{exam_id: string}>('select exam_id from public.question_imports where id=$1', [restrictedImport])).rows[0].exam_id, moveRestricted);
  // Re-pointing between two still-unclassified banks stays allowed before publication.
  const firstUnclassified = 'b1000000-0000-4000-8000-00000000000d';
  const secondUnclassified = 'b1000000-0000-4000-8000-00000000000e';
  await db.query(`insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values
      ($1,'First unclassified','WAEC','Mathematics',30,true),
      ($2,'Second unclassified','WAEC','Mathematics',30,true)`, [firstUnclassified, secondUnclassified]);
  const pending = await importBatch(firstUnclassified, [], 'synthetic/pending.pdf');
  await db.query('update public.question_imports set exam_id=$1 where id=$2', [secondUnclassified, pending]);
  assert.equal((await db.query<{exam_id: string}>('select exam_id from public.question_imports where id=$1', [pending])).rows[0].exam_id, secondUnclassified);
  assert.equal((await auditRows(movePublic)).filter((row) => row.action === 'bank_questions_published').length, 0,
    'a refused move publishes nothing');
});

test('public practice and guest access are unaffected by bank administration', async () => {
  // The candidate reader is granted to signed-in users; anonymous practice is
  // served by the guest HTTP handlers and is covered by the guest-http suite.
  await role('authenticated', other);
  assert.equal((await db.query('select * from public.get_cbt_questions($1)', [publicBank])).rows.length, 5);
  assert.deepEqual(await access(publicBank), { access: true, released: true });
  // `other` holds an active assignment on adminRestricted from the assignment
  // test, so use banks that account was never assigned to.
  assert.equal((await db.query('select * from public.get_cbt_questions($1)', [restricted])).rows.length, 0);
  assert.equal((await db.query('select * from public.get_cbt_questions($1)', [importRestricted])).rows.length, 0);
  // Anonymous callers keep the public predicates and lose the restricted ones.
  await role('anon');
  assert.deepEqual(await access(publicBank), { access: true, released: true });
  assert.deepEqual(await access(importRestricted), { access: false, released: false });
  assert.deepEqual(await access(pendingUnclassified), { access: false, released: false });
  await db.exec('reset role');
});

// --- Question provenance ---------------------------------------------------
// Classification alone cannot stop restricted material being re-typed,
// re-imported or duplicated into a public bank.
const provenanceRestricted = 'b1000000-0000-4000-8000-00000000000f';
const provenancePublic = 'b1000000-0000-4000-8000-000000000010';
const provenanceUnclassified = 'b1000000-0000-4000-8000-000000000011';
const seedQuestion = `insert into public.exam_questions(exam_id,subject,question_text,option_a,option_b,option_c,option_d,correct_option,marks,position)
  values ($1,'Mathematics',$2,'A','B','C','D','A',1,$3)`;

test('the provenance fingerprint matches the application normalisation', async () => {
  const { questionFingerprint } = await import('../src/server/question-import/validate');
  const samples = [
    'What is the capital of France?',
    '  WHAT   is the capital   of France  ',
    'Which gas do plants absorb \u201cduring\u201d photosynthesis?',
    "Newton's second law, F = ma.",
    'Option-A vs option_a vs Option A',
    '',
  ];
  for (const sample of samples) {
    const database = (await db.query<{ value: string }>('select public.cbt_question_text_fingerprint($1) as value', [sample])).rows[0].value;
    assert.equal(database, questionFingerprint(sample), JSON.stringify(sample));
  }
  const readiness = await db.query<{ ready: boolean }>('select public.cbt_question_provenance_ready() as ready');
  assert.equal(readiness.rows[0].ready, true);
  await role('authenticated', admin);
  await assert.rejects(db.query('select public.cbt_question_provenance_ready()'), /permission denied/i);
  await db.exec('reset role');
});

test('restricted question text cannot be created in a public or unclassified bank', async () => {
  await db.exec('reset role');
  await db.query(`insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values
      ($1,'Provenance restricted','WAEC','Mathematics',30,true),
      ($2,'Provenance public','WAEC','Mathematics',30,true),
      ($3,'Provenance unclassified','WAEC','Mathematics',30,true)`,
    [provenanceRestricted, provenancePublic, provenanceUnclassified]);
  await role('authenticated', admin);
  await db.query("select public.cbt_bank_classify($1,'restricted',now()+interval '3 days')", [provenanceRestricted]);
  await db.query("select public.cbt_bank_classify($1,'public',null)", [provenancePublic]);
  await db.exec('reset role');

  const confidential = 'Confidential 2026 mock: which ion carries the charge in solution?';
  await db.query(seedQuestion, [provenanceRestricted, confidential, 1]);

  // Creation (manual composer, import publication or a duplicate action) into a
  // non-restricted bank is refused, including when only punctuation or case
  // differs.
  for (const [bank, variant] of [
    [provenancePublic, confidential],
    [provenanceUnclassified, '  confidential 2026 MOCK which ion carries the charge in solution '],
    [provenancePublic, 'Confidential 2026 mock \u2014 which ion carries the charge in solution?'],
  ] as const) {
    await assert.rejects(db.query(seedQuestion, [bank, variant, 1]), (error: Error & { code?: string; detail?: string }) => {
      assert.match(error.message, /already exists in a restricted bank/i);
      assert.equal(error.code, '42501');
      // The server classifies on this DETAIL marker, not on 42501 alone.
      assert.equal(error.detail, 'cbt_question_provenance_guard');
      // The refusal must never echo the protected text, its bank or its key.
      assert.doesNotMatch(error.message, /Confidential|ion carries|restricted bank \w{8}-/i);
      return true;
    });
  }
  assert.equal((await db.query('select id from public.exam_questions where exam_id=$1', [provenancePublic])).rows.length, 0);
  assert.equal((await db.query('select id from public.exam_questions where exam_id=$1', [provenanceUnclassified])).rows.length, 0);

  // Containment still works: unrelated text is fine, and public material may be
  // copied *into* a restricted bank.
  await db.query(seedQuestion, [provenancePublic, 'Which gas do plants absorb during photosynthesis?', 1]);
  await db.query(seedQuestion, [provenanceRestricted, 'Which gas do plants absorb during photosynthesis?', 2]);
  assert.equal((await db.query('select id from public.exam_questions where exam_id=$1', [provenancePublic])).rows.length, 1);
  assert.equal((await db.query('select id from public.exam_questions where exam_id=$1', [provenanceRestricted])).rows.length, 2);
});

test('editing a public question cannot introduce restricted text', async () => {
  await db.exec('reset role');
  const row = (await db.query<{ id: string }>('select id from public.exam_questions where exam_id=$1', [provenancePublic])).rows[0];
  await assert.rejects(
    db.query("update public.exam_questions set question_text=$1 where id=$2", ['Confidential 2026 mock: which ion carries the charge in solution?', row.id]),
    /already exists in a restricted bank/i,
  );
  const after = await db.query<{ question_text: string }>('select question_text from public.exam_questions where id=$1', [row.id]);
  assert.equal(after.rows[0].question_text, 'Which gas do plants absorb during photosynthesis?');
  // A refusal is not a classification change, and no provenance is invented.
  const policy = await db.query<{ exam_id: string; visibility: string }>('select exam_id, visibility from public.cbt_bank_security where exam_id = any($1)', [[provenanceRestricted, provenancePublic, provenanceUnclassified]]);
  assert.equal(policy.rows.length, 2, 'the unclassified bank was not silently classified');
});

test('an import batch containing restricted text publishes nothing into a public bank', async () => {
  await db.exec('reset role');
  const before = (await db.query<{ count: string }>('select count(*) from public.exam_questions where exam_id=$1', [provenancePublic])).rows[0].count;
  const importId = await importBatch(provenancePublic, [
    { text: 'An ordinary question that is safe to publish?', correct: 'A' },
    { text: 'confidential 2026 mock which ion carries the charge in solution', correct: 'B' },
  ], 'synthetic/provenance.pdf');
  await db.exec('set role service_role');
  await assert.rejects(db.query('select public.commit_question_import($1,$2)', [importId, admin]), /already exists in a restricted bank/i);
  await db.exec('reset role');
  assert.equal((await db.query<{ count: string }>('select count(*) from public.exam_questions where exam_id=$1', [provenancePublic])).rows[0].count, before, 'the whole batch rolled back');
  const status = await db.query<{ status: string; imported_count: number }>('select status, imported_count from public.question_imports where id=$1', [importId]);
  assert.equal(status.rows[0].status, 'extracted');
  assert.equal(Number(status.rows[0].imported_count), 0);
});

test('a restricted bank cannot be created while the provenance guard is missing', async () => {
  await db.exec('reset role');
  const bank = 'b1000000-0000-4000-8000-000000000012';
  await db.query("insert into public.cbt_exams(id,title,exam_body,subject,duration_minutes,is_active) values ($1,'Half migrated','WAEC','Mathematics',30,true)", [bank]);
  await db.exec('begin');
  await db.exec('drop trigger cbt_question_provenance_guard on public.exam_questions');
  await assert.rejects(
    db.query("select public.cbt_bank_classify($1,'restricted',now()+interval '2 days')", [bank]),
    /require the question provenance guard/i,
  );
  await db.exec('rollback');
  assert.equal((await db.query('select exam_id from public.cbt_bank_security where exam_id=$1', [bank])).rows.length, 0);
  assert.equal((await db.query<{ ready: boolean }>('select public.cbt_question_provenance_ready() as ready')).rows[0].ready, true, 'the guard survived the rolled-back drop');
});
