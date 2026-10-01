import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';
import { comparePosture, readActualPosture, RLS_POSTURE, type ActualPosture } from '../scripts/rls-posture';

// BASE-1b: every table in `public` has a documented, enforced access posture,
// no client role can reach a table RLS does not protect, and the policies
// actually filter rows for the anon/authenticated roles. The database is the
// schema this repository produces, replayed on a real engine with Supabase's
// permissive default grants in place (see supabase/ci/platform-shims.sql).

const USER_A = '11111111-2222-3333-4444-555555555555';
const USER_B = '99999999-9999-9999-9999-999999999999';

let db: PGlite;
let actual: ActualPosture[];

/** Runs a statement as one of the API roles, the way PostgREST would. */
async function queryAs(role: 'anon' | 'authenticated', userId: string | null, sql: string) {
  await db.exec(`set role ${role}`);
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
    return await db.query<{ n?: number; id?: string }>(sql);
  } finally {
    await db.exec('reset role');
  }
}

async function expectDenied(role: 'anon' | 'authenticated', userId: string | null, sql: string) {
  await assert.rejects(
    () => queryAs(role, userId, sql),
    /permission denied/,
    `${role} must not be able to run: ${sql}`,
  );
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  // Two accounts through the real signup trigger, and one notification for A,
  // so "own rows" and "another user's rows" are distinguishable.
  for (const [id, email] of [[USER_A, 'a@example.com'], [USER_B, 'b@example.com']] as const) {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
      id,
      email,
      JSON.stringify({ first_name: 'Posture', last_name: id.slice(0, 2) }),
    ]);
  }
  await db.query(
    `insert into public.student_notifications (user_id, title, body, notification_type)
     values ($1, 'Test', 'Body', 'service_request')`,
    [USER_A],
  );
  actual = await readActualPosture(db);
});

after(async () => {
  await db.close();
});

test('every public table is classified and the database matches the classification', () => {
  const findings = comparePosture(actual);
  assert.deepEqual(
    findings.map((finding) => `${finding.table}: ${finding.problem}`),
    [],
    'the posture audit found unexplained tables or drift',
  );
  assert.ok(actual.length >= 35, `expected at least 35 public tables, found ${actual.length}`);
  const known = new Set(actual.map((row) => row.table));
  for (const entry of RLS_POSTURE) {
    assert.ok(known.has(entry.table), `${entry.table} is classified but no migration creates it`);
  }
});

test('no client role can reach a table with RLS disabled, or one with no policy', () => {
  const offenders = actual.filter(
    (row) => (row.anon.length > 0 || row.authenticated.length > 0) && (!row.rls || row.policies === 0),
  );
  assert.deepEqual(
    offenders.map((row) => `${row.table} (rls=${row.rls}, policies=${row.policies})`),
    [],
    'a table reachable with the publishable key has no row-level protection',
  );
});

test('financial, audit and pipeline tables are unreachable with the publishable key', async () => {
  const closed = ['student_wallets', 'student_wallet_transactions', 'payment_events', 'admin_audit_logs', 'exam_questions'];
  for (const table of closed) {
    const row = actual.find((candidate) => candidate.table === table);
    assert.ok(row, `${table} is missing from the schema`);
    assert.deepEqual(row.anon, [], `${table} grants anon ${row.anon.join(',') || 'nothing'}`);
    assert.deepEqual(row.authenticated, [], `${table} grants authenticated ${row.authenticated.join(',') || 'nothing'}`);
  }
  // And the grant absence is enforced, not just recorded.
  await expectDenied('anon', null, 'select count(*) from public.student_wallets');
  await expectDenied('authenticated', USER_A, 'select count(*) from public.student_wallets');
  await expectDenied('authenticated', USER_A, 'update public.student_wallets set balance = 1');
  await expectDenied('anon', null, 'select count(*) from public.admin_audit_logs');
});

test('public-read tables expose select and nothing else', async () => {
  for (const table of ['institutions', 'service_catalog', 'cbt_exams', 'news_articles', 'opportunities']) {
    const row = actual.find((candidate) => candidate.table === table);
    assert.ok(row, `${table} is missing from the schema`);
    assert.deepEqual(row.anon, ['select'], `${table} anon privileges`);
    assert.deepEqual(row.authenticated, ['select'], `${table} authenticated privileges`);
  }
  // anon can read the public catalogue without a session, and cannot write it.
  const catalogue = await queryAs('anon', null, 'select count(*)::int as n from public.service_catalog');
  assert.ok((catalogue.rows[0].n ?? 0) > 0, 'anon must be able to read the public service catalogue');
  await expectDenied('anon', null, `insert into public.service_catalog (service_key, title) values ('x', 'x')`);
  await expectDenied('anon', null, `update public.service_catalog set title = 'x'`);
});

test('owner-scoped policies filter rows for the authenticated role', async () => {
  const own = await queryAs('authenticated', USER_A, 'select count(*)::int as n from public.student_notifications');
  assert.equal(own.rows[0].n, 1, 'a student must see their own notification');
  const others = await queryAs('authenticated', USER_B, 'select count(*)::int as n from public.student_notifications');
  assert.equal(others.rows[0].n, 0, "a student must not see another student's notifications");

  const ownProfile = await queryAs('authenticated', USER_A, 'select count(*)::int as n from public.profiles');
  assert.equal(ownProfile.rows[0].n, 1, 'a student must see their own profile');
  await queryAs('authenticated', USER_B, 'select count(*)::int as n from public.profiles');

  // Updating someone else's row matches nothing rather than being allowed.
  const update = await queryAs(
    'authenticated',
    USER_B,
    `update public.profiles set full_name = 'hijacked' where id = '${USER_A}' returning id`,
  );
  assert.equal(update.rows.length, 0, "a student must not be able to update another student's profile");
});

test('the tightened posture still provisions new accounts', async () => {
  // handle_new_user() runs as the table owner (security definer) and writes
  // profiles and student_wallets — tables that now have RLS on and no client
  // grant. This asserts the service/definer path is genuinely unaffected.
  for (const id of [USER_A, USER_B]) {
    const profile = await db.query<{ role: string }>(`select role from public.profiles where id = $1`, [id]);
    assert.equal(profile.rows.length, 1, 'the signup trigger must create a profile row');
    assert.equal(profile.rows[0].role, 'student', 'a new account is a student by default');
    const wallet = await db.query(`select user_id from public.student_wallets where user_id = $1`, [id]);
    assert.equal(wallet.rows.length, 1, 'the signup trigger must create the wallet row');
  }
});
