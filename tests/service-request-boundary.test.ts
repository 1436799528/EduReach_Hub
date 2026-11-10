import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyMigrations, MIGRATIONS_DIR } from '../scripts/replay';

// Only synthetic accounts and rows in a throwaway PostgreSQL engine. The
// platform shim is not hosted Supabase Auth/Storage/PostgREST.
const STUDENT_A = '71111111-2222-4333-8444-555555555555';
const STUDENT_B = '79999999-2222-4333-8444-555555555555';
const STAFF = '72222222-2222-4333-8444-555555555555';
const REQUEST_A = '73333333-2222-4333-8444-555555555555';
const REQUEST_B = '74444444-2222-4333-8444-555555555555';
let db: PGlite;
let serviceId: string;

async function asUser<T>(id: string, sql: string, params: unknown[] = []) {
  await db.exec('set role authenticated');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    return await db.query<T>(sql, params);
  } finally { await db.exec('reset role'); }
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  // Supabase's service role bypasses RLS; the generic test shim creates it
  // without that platform property. Model it only inside this throwaway engine.
  await db.exec('alter role service_role bypassrls');
  for (const [id, email] of [[STUDENT_A, 'a@example.test'], [STUDENT_B, 'b@example.test'], [STAFF, 'staff@example.test']] as const) {
    await db.query('insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)', [id, email, '{}']);
  }
  await db.query("update public.profiles set role = 'super_admin' where id = $1", [STAFF]);
  const service = await db.query<{ id: string }>('select id from public.service_catalog where active = true order by id limit 1');
  assert.ok(service.rows[0], 'the local replay has an active service');
  serviceId = service.rows[0].id;
  await db.query("insert into public.service_requests (id,user_id,service_id,status,form_data) values ($1,$2,$3,'submitted','{}'),($4,$5,$3,'submitted','{}')", [REQUEST_A, STUDENT_A, serviceId, REQUEST_B, STUDENT_B]);
});

after(async () => { await db.close(); });

test('authenticated staff and students have no direct table or column UPDATE privilege', async () => {
  const staff = await asUser<{ is_staff: boolean }>(STAFF, 'select public.is_staff($1) as is_staff', [STAFF]);
  assert.equal(staff.rows[0].is_staff, true, 'fixture must exercise a real staff account');
  const result = await db.query<{ table_update: boolean; column_update: boolean }>(`select
    has_table_privilege('authenticated', 'public.service_requests', 'UPDATE') as table_update,
    exists(select 1 from pg_attribute a where a.attrelid='public.service_requests'::regclass and a.attnum>0 and not a.attisdropped and has_column_privilege('authenticated','public.service_requests',a.attname,'UPDATE')) as column_update`);
  assert.equal(result.rows[0].table_update, false);
  assert.equal(result.rows[0].column_update, false);
  for (const user of [STUDENT_A, STUDENT_B, STAFF]) {
    await assert.rejects(asUser(user, "update public.service_requests set status='processing' where id=$1", [REQUEST_A]), /permission denied/);
  }
});

test('student own-request read and active-service insert still work and other students stay isolated', async () => {
  const own = await asUser<{ id: string }>(STUDENT_A, 'select id from public.service_requests where id = $1', [REQUEST_A]);
  const other = await asUser<{ id: string }>(STUDENT_A, 'select id from public.service_requests where id = $1', [REQUEST_B]);
  assert.equal(own.rows.length, 1);
  assert.equal(other.rows.length, 0);
  const inserted = await asUser<{ user_id: string }>(STUDENT_A, "insert into public.service_requests (user_id,service_id,status,form_data) values ($1,$2,'submitted','{}') returning user_id", [STUDENT_A, serviceId]);
  assert.equal(inserted.rows[0].user_id, STUDENT_A);
  await assert.rejects(asUser(STUDENT_A, "insert into public.service_requests (user_id,service_id,status,form_data) values ($1,$2,'submitted','{}')", [STUDENT_B, serviceId]), /row-level security/);
  await assert.rejects(asUser(STUDENT_A, "insert into public.service_requests (user_id,service_id,status,form_data) values ($1,$2,'processing','{}')", [STUDENT_A, serviceId]), /row-level security/);
  const inactive = await db.query<{ id: string }>("insert into public.service_catalog (service_key,title,active) values ('test-inactive-service','Synthetic inactive service',false) returning id");
  await assert.rejects(asUser(STUDENT_A, "insert into public.service_requests (user_id,service_id,status,form_data) values ($1,$2,'submitted','{}')", [STUDENT_A, inactive.rows[0].id]), /row-level security/);
});

test('privileged updates advance versions and a stale compare-and-set cannot overwrite them', async () => {
  const before = await db.query<{ version: string }>('select updated_at::text as version from public.service_requests where id=$1', [REQUEST_A]);
  await db.exec('set role service_role');
  let updated;
  try {
    updated = await db.query<{ version: string }>("update public.service_requests set admin_note='first', updated_at='2000-01-01' where id=$1 returning updated_at::text as version", [REQUEST_A]);
  } finally { await db.exec('reset role'); }
  assert.equal(updated.rows.length, 1, 'the privileged server role can still process requests');
  assert.notEqual(updated.rows[0].version, before.rows[0].version);
  const stale = await db.query("update public.service_requests set admin_note='stale' where id=$1 and updated_at=$2::timestamptz returning id", [REQUEST_A, before.rows[0].version]);
  assert.equal(stale.rows.length, 0, 'a change by another privileged writer invalidates the observed version');
  const next = await db.query<{ version: string }>("update public.service_requests set admin_note='second' where id=$1 and updated_at=$2::timestamptz returning updated_at::text as version", [REQUEST_A, updated.rows[0].version]);
  assert.equal(next.rows.length, 1);
  assert.notEqual(next.rows[0].version, updated.rows[0].version);
  const order = await db.query<{ forward: boolean }>('select $1::timestamptz > $2::timestamptz as forward', [next.rows[0].version, updated.rows[0].version]);
  assert.equal(order.rows[0].forward, true, 'versions must advance, not merely change');
  const untouched = await db.query<{ status: string; admin_note: string | null }>('select status,admin_note from public.service_requests where id=$1', [REQUEST_B]);
  assert.deepEqual(untouched.rows[0], { status: 'submitted', admin_note: null });
});

test('migration removes explicit column grants and fails closed for inherited UPDATE privileges', async () => {
  const migration = readFileSync(join(MIGRATIONS_DIR, '20261102190000_service_request_write_boundary.sql'), 'utf8');
  await db.exec('grant update (admin_note) on public.service_requests to authenticated');
  await db.exec(migration);
  const direct = await db.query<{ allowed: boolean }>("select has_column_privilege('authenticated','public.service_requests','admin_note','UPDATE') as allowed");
  assert.equal(direct.rows[0].allowed, false);

  await db.exec('create role service_request_test_writer nologin; grant update (admin_note) on public.service_requests to service_request_test_writer; grant service_request_test_writer to authenticated');
  try {
    await assert.rejects(db.exec(migration), /UPDATE remains available through inherited grants/);
    await db.exec('rollback');
    const inherited = await db.query<{ allowed: boolean }>("select has_column_privilege('authenticated','public.service_requests','admin_note','UPDATE') as allowed");
    assert.equal(inherited.rows[0].allowed, true, 'failed rollout must not hide an inherited privilege');
  } finally {
    await db.exec('revoke service_request_test_writer from authenticated; revoke update (admin_note) on public.service_requests from service_request_test_writer; drop role service_request_test_writer');
  }
});

test('students cannot set server-controlled request fields or read staff-only fields', async () => {
  for (const [column, value] of [
    ['id', "'76666666-2222-4333-8444-555555555555'::uuid"],
    ['admin_note', "'forged staff note'"],
    ['reference_code', "'forged-reference'"],
    ['created_at', "'2000-01-01'::timestamptz"],
    ['updated_at', "'infinity'::timestamptz"],
  ] as const) {
    await assert.rejects(asUser(STUDENT_A, `insert into public.service_requests (user_id,service_id,status,form_data,${column}) values ($1,$2,'submitted','{}',${value})`, [STUDENT_A, serviceId]), /permission denied/, `client must not set ${column}`);
  }
  for (const column of ['admin_note', 'updated_at']) {
    await assert.rejects(asUser(STUDENT_A, `select ${column} from public.service_requests where id=$1`, [REQUEST_A]), /permission denied/, `client must not read ${column}`);
  }
  await assert.rejects(asUser(STUDENT_A, 'select * from public.service_requests where id=$1', [REQUEST_A]), /permission denied/);
  const student = await asUser<{ id: string; reference_code: string; status: string; created_at: Date }>(STUDENT_A, 'select id,reference_code,status,created_at from public.service_requests where id=$1', [REQUEST_A]);
  assert.equal(student.rows.length, 1, 'own tracking projection remains readable');
});

test('staff cannot bypass the admin API to read another student request', async () => {
  const direct = await asUser<{ id: string }>(STAFF, 'select id from public.service_requests where id=$1', [REQUEST_A]);
  assert.equal(direct.rows.length, 0);
  await db.exec('set role service_role');
  try {
    const privileged = await db.query<{ admin_note: string | null; version: string }>('select admin_note, updated_at::text as version from public.service_requests where id=$1', [REQUEST_A]);
    assert.equal(privileged.rows.length, 1, 'server service role retains access needed by the admin API');
  } finally { await db.exec('reset role'); }
});

test('student-field migration removes direct grants and aborts for inherited access or unknown client policies', async () => {
  const migration = readFileSync(join(MIGRATIONS_DIR, '20261102200000_service_request_student_field_boundary.sql'), 'utf8');
  await db.exec('grant select (admin_note), insert (updated_at) on public.service_requests to authenticated');
  await db.exec(migration);
  const direct = await db.query<{ note: boolean; version: boolean }>("select has_column_privilege('authenticated','public.service_requests','admin_note','SELECT') as note, has_column_privilege('authenticated','public.service_requests','updated_at','INSERT') as version");
  assert.deepEqual(direct.rows[0], { note: false, version: false });

  await db.exec('create role service_request_field_test nologin; grant insert (updated_at) on public.service_requests to service_request_field_test; grant service_request_field_test to authenticated');
  try {
    await assert.rejects(db.exec(migration), /field access remains available through inherited grants/);
    await db.exec('rollback');
  } finally {
    await db.exec('revoke service_request_field_test from authenticated; revoke insert (updated_at) on public.service_requests from service_request_field_test; drop role service_request_field_test');
  }
  for (const target of ['authenticated', 'public']) {
    await db.exec(`create policy unreviewed_client_policy on public.service_requests for select to ${target} using (true)`);
    try {
      await assert.rejects(db.exec(migration), /unreviewed client SELECT\/INSERT service_requests policy/);
      await db.exec('rollback');
      const policy = await db.query("select policyname from pg_policies where schemaname='public' and tablename='service_requests' and policyname='unreviewed_client_policy'");
      assert.equal(policy.rows.length, 1, 'failed migration must not silently delete an unreviewed policy');
    } finally { await db.exec('drop policy unreviewed_client_policy on public.service_requests'); }
  }
});
