import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// A throwaway PostgreSQL engine and synthetic accounts, never a hosted project.
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b1111111-1111-4111-8111-111111111111';
const KEY = 'c1111111-1111-4111-8111-111111111111';
const KEY_2 = 'c2222222-2222-4222-8222-222222222222';
let db: PGlite;
let slug: string;

async function call(user: string | null, key: string | null, data: unknown, service = slug, recoveryOnly = false) {
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user || '']);
    return await db.query<{ id: string; reference_code: string; status: string; created_at: string }>(
      'select * from public.submit_service_request_idempotent($1, $2::jsonb, $3::uuid, $4::uuid, $5::boolean)',
      [service, JSON.stringify(data), key, user, recoveryOnly],
    );
  } finally { await db.exec('reset role'); }
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  for (const [id, email] of [[A, 'a@synthetic.test'], [B, 'b@synthetic.test']] as const) {
    await db.query('insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)', [id, email, '{}']);
  }
  const service = await db.query<{ service_key: string }>('select service_key from public.service_catalog where active is true order by id limit 1');
  assert.ok(service.rows[0]);
  slug = service.rows[0].service_key;
});
after(async () => { await db.close(); });

test('same student and key recover the original reference without creating another request', async () => {
  const details = { notes: 'synthetic request', fullName: 'Synthetic Student' };
  const first = (await call(A, KEY, details)).rows[0];
  const retry = (await call(A, KEY, { fullName: 'Synthetic Student', notes: 'synthetic request' })).rows[0];
  assert.ok(first.reference_code);
  assert.deepEqual(retry, first);
  const count = await db.query<{ count: number }>('select count(*)::int as count from public.service_requests where user_id=$1', [A]);
  assert.equal(count.rows[0].count, 1);
  const columns = Object.keys(first).sort();
  assert.deepEqual(columns, ['created_at', 'id', 'reference_code', 'status']);
});

test('a reused key cannot accept changed details or a different service', async () => {
  await assert.rejects(call(A, KEY, { notes: 'changed' }), /submission key.*different/i);
  await assert.rejects(call(A, KEY, { notes: 'synthetic request', fullName: 'Synthetic Student' }, 'nonexistent-service'), /submission key.*different/i);
});

test('key ownership is scoped to the authenticated student and anonymous access is denied', async () => {
  await assert.rejects(call(null, KEY, {}), /permission denied/i);
  const own = (await call(B, KEY, { notes: 'different student' })).rows[0];
  const original = (await call(A, KEY, { notes: 'synthetic request', fullName: 'Synthetic Student' })).rows[0];
  assert.notEqual(own.id, original.id);
  assert.notEqual(own.reference_code, original.reference_code);
});

test('the database refuses a changed or missing expected account before inserting', async () => {
  const key = 'c5555555-5555-4555-8555-555555555555';
  await db.exec('set role authenticated');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [B]);
    for (const expected of [A, null]) {
      await assert.rejects(db.query(
        'select * from public.submit_service_request_idempotent($1, $2::jsonb, $3::uuid, $4::uuid, false)',
        [slug, JSON.stringify({ notes: 'prepared under another account' }), key, expected],
      ), /account changed/i);
    }
    await assert.rejects(db.query(
      'select * from public.submit_service_request_idempotent($1, $2::jsonb, $3::uuid, $4::uuid, false)',
      [slug, JSON.stringify({ notes: 'synthetic request', fullName: 'Synthetic Student' }), KEY, A],
    ), /account changed/i, 'a changed account cannot recover another account’s request');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await assert.rejects(db.query(
      'select * from public.submit_service_request_idempotent($1, $2::jsonb, $3::uuid, $4::uuid, false)',
      [slug, '{}', key, A],
    ), /authentication required/i);
  } finally { await db.exec('reset role'); }
  const count = await db.query<{ count: number }>('select count(*)::int as count from public.service_requests where submission_key=$1', [key]);
  assert.equal(count.rows[0].count, 0, 'a mismatched token must not write or recover a request');
});

test('the student cannot directly read or set the server-controlled key', async () => {
  await db.exec('set role authenticated');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [A]);
    for (const column of ['submission_key', 'submission_fingerprint']) {
      await assert.rejects(db.query(`select ${column} from public.service_requests`), /permission denied/i);
    }
    await assert.rejects(db.query("insert into public.service_requests (user_id,submission_key) values ($1,$2)", [A, KEY_2]), /permission denied/i);
  } finally { await db.exec('reset role'); }
});

test('recovery returns the existing request after its status changes', async () => {
  await db.query("update public.service_requests set status='processing' where user_id=$1 and submission_key=$2", [A, KEY]);
  const retry = (await call(A, KEY, { notes: 'synthetic request', fullName: 'Synthetic Student' })).rows[0];
  assert.equal(retry.status, 'processing');
  assert.ok(retry.reference_code);
});

test('recovery compares immutable original details, not later privileged edits', async () => {
  const key = 'c4444444-4444-4444-8444-444444444444';
  const original = { notes: 'original details' };
  const first = (await call(A, key, original)).rows[0];
  await db.query("update public.service_requests set form_data=jsonb_build_object('notes','edited later','reference_code',reference_code) where id=$1", [first.id]);
  const recovered = (await call(A, key, original)).rows[0];
  assert.equal(recovered.id, first.id, 'later edits do not prevent recovery of original submission');
  await assert.rejects(call(A, key, { notes: 'edited later' }), /submission key.*different/i);
  await assert.rejects(db.query('update public.service_requests set submission_fingerprint=null where id=$1', [first.id]), /immutable/i);
  await assert.rejects(db.query('update public.service_requests set submission_key=null where id=$1', [first.id]), /immutable/i);
});

test('check-only recovery returns existing requests and never inserts when missing', async () => {
  const missingKey = 'c6666666-6666-4666-8666-666666666666';
  await call(B, KEY_2, { notes: 'second student' });
  await db.exec('set role authenticated');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [A]);
    const recovered = await db.query<{ id: string }>(
      'select * from public.submit_service_request_idempotent($1,$2::jsonb,$3::uuid,$4::uuid,$5::boolean)',
      [slug, JSON.stringify({ notes: 'synthetic request', fullName: 'Synthetic Student' }), KEY, A, true],
    );
    assert.equal(recovered.rows.length, 1);
    const absent = await db.query('select * from public.submit_service_request_idempotent($1,$2::jsonb,$3::uuid,$4::uuid,$5::boolean)', [slug, '{}', missingKey, A, true]);
    assert.equal(absent.rows.length, 0, 'a missing record is unconfirmed and must not be created');
    await assert.rejects(db.query('select * from public.submit_service_request_idempotent($1,$2::jsonb,$3::uuid,$4::uuid,$5::boolean)', [slug, '{}', missingKey, A, null]), /recovery mode/i);
    await assert.rejects(db.query('select * from public.submit_service_request_idempotent($1,$2::jsonb,$3::uuid,$4::uuid,$5::boolean)', [slug, '{}', KEY, B, true]), /account changed/i);
    await assert.rejects(db.query('select * from public.submit_service_request_idempotent($1,$2::jsonb,$3::uuid,$4::uuid,$5::boolean)', [slug, '{}', KEY, A, true]), /submission key.*different/i);
    const otherAccount = await db.query('select * from public.submit_service_request_idempotent($1,$2::jsonb,$3::uuid,$4::uuid,$5::boolean)', [slug, JSON.stringify({ notes: 'second student' }), KEY_2, A, true]);
    assert.equal(otherAccount.rows.length, 0, 'a different account cannot recover another student’s row');
  } finally { await db.exec('reset role'); }
  const count = await db.query<{ count: number }>('select count(*)::int as count from public.service_requests where submission_key=$1', [missingKey]);
  assert.equal(count.rows[0].count, 0);
});

test('invalid payloads and new requests to an inactive service fail without insert', async () => {
  await assert.rejects(call(A, null, {}), /submission key/i);
  await assert.rejects(call(A, KEY_2, ['not an object']), /details/i);
  await assert.rejects(call(A, KEY_2, { reference_code: 'forged' }), /details/i);
  await db.query('update public.service_catalog set active=false where service_key=$1', [slug]);
  try {
    await assert.rejects(call(A, KEY_2, { notes: 'new' }), /service.*unavailable/i);
    const retry = (await call(A, KEY, { notes: 'synthetic request', fullName: 'Synthetic Student' })).rows[0];
    const checked = (await call(A, KEY, { notes: 'synthetic request', fullName: 'Synthetic Student' }, slug, true)).rows[0];
    assert.ok(retry.reference_code, 'a committed request is recoverable after the service is deactivated');
    assert.equal(checked.id, retry.id, 'check-only recovery works even for deactivated services');
    assert.equal((await call(A, KEY_2, { notes: 'new' }, slug, true)).rows.length, 0, 'check-only cannot create an inactive service request');
  } finally { await db.query('update public.service_catalog set active=true where service_key=$1', [slug]); }
});
