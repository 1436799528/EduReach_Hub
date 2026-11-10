import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// Synthetic users and attempts in a disposable replay. No hosted calls.
const STUDENT = '81111111-1111-4111-8111-111111111111';
const OTHER = '82222222-2222-4222-8222-222222222222';
const ACTIVE = '84444444-4444-4444-8444-444444444444';
const GRACE = '85555555-5555-4555-8555-555555555555';
const PAST = '86666666-6666-4666-8666-666666666666';
const SUBMITTED = '87777777-7777-4777-8777-777777777777';
const NO_DEADLINE = '88888888-8888-4888-8888-888888888888';
let db: PGlite;

async function asUser<T>(user: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('set role authenticated');
  try { await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]); return await fn(); }
  finally { await db.exec('reset role'); }
}
async function expire(user: string, attempt: string) {
  return asUser(user, async () => (await db.query<{ status: string }>(
    'select public.cbt_expire_owned_attempt($1) as status', [attempt],
  )).rows[0].status);
}

before(async () => {
  db = new PGlite(); await applyMigrations(db);
  await db.exec(`
    insert into auth.users(id,email,raw_user_meta_data) values ('${STUDENT}','a@synthetic.test','{}'),('${OTHER}','b@synthetic.test','{}');
    insert into public.cbt_exams(id,title,exam_body,subject,description,duration_minutes,is_active)
      select v.id::uuid,'Synthetic','WAEC','Mathematics','test',30,true from (values ('${ACTIVE}'),('${GRACE}'),('${PAST}'),('${SUBMITTED}'),('${NO_DEADLINE}')) as v(id);
    insert into public.cbt_attempts(id,user_id,exam_id,status,expires_at,total_questions,answers_draft) values
      ('${ACTIVE}','${STUDENT}','${ACTIVE}','in_progress',now()+interval '30 minutes',1,'{"1":0}'),
      ('${GRACE}','${STUDENT}','${GRACE}','in_progress',now()-interval '60 seconds',1,'{"1":1}'),
      ('${PAST}','${STUDENT}','${PAST}','in_progress',now()-interval '121 seconds',1,'{"1":2}'),
      ('${SUBMITTED}','${STUDENT}','${SUBMITTED}','submitted',now()-interval '1 day',1,'{}'),
      ('${NO_DEADLINE}','${STUDENT}','${NO_DEADLINE}','in_progress',null,1,'{"1":3}');
  `);
});
after(async () => { await db.close(); });

test('expiry leaves active attempts, grace-period attempts and null deadlines untouched', async () => {
  for (const id of [ACTIVE, GRACE, NO_DEADLINE]) assert.equal(await expire(STUDENT, id), 'in_progress');
  const { rows } = await db.query<{ answers_draft: Record<string, number> }>('select answers_draft from public.cbt_attempts where id=$1', [GRACE]);
  assert.deepEqual(rows[0].answers_draft, { '1': 1 });
});

test('after the grace period expiry is idempotent and preserves accepted answers', async () => {
  assert.equal(await expire(STUDENT, PAST), 'expired');
  assert.equal(await expire(STUDENT, PAST), 'expired');
  const { rows } = await db.query<{ answers_draft: Record<string, number> }>('select answers_draft from public.cbt_attempts where id=$1', [PAST]);
  assert.deepEqual(rows[0].answers_draft, { '1': 2 });
});

test('submitted attempts are not reopened or changed', async () => {
  assert.equal(await expire(STUDENT, SUBMITTED), 'submitted');
  const { rows } = await db.query<{ status: string }>('select status from public.cbt_attempts where id=$1', [SUBMITTED]);
  assert.equal(rows[0].status, 'submitted');
});

test('other users and anonymous callers cannot expire an attempt', async () => {
  await assert.rejects(expire(OTHER, ACTIVE), /not found/i);
  await db.exec('set role anon');
  try { await assert.rejects(db.query('select public.cbt_expire_owned_attempt($1)', [ACTIVE]), /permission denied/i); }
  finally { await db.exec('reset role'); }
  assert.equal(await expire(STUDENT, ACTIVE), 'in_progress');
});
