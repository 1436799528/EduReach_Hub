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
