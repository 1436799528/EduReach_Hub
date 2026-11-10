import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// Characterizes a pre-existing local role-escalation exposure. Does not apply
// candidate SQL and does not establish the state of a hosted Supabase project.
test('baseline replay permits a service administrator to update their own role to super_admin', async () => {
  const db = new PGlite();
  try {
    await applyMigrations(db);
    const user = 'a1000000-0000-4000-8000-000000000005';
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,'service-admin@synthetic.test','{}')", [user]);
    await db.query("update public.profiles set role='service_admin' where id=$1", [user]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    const update = await db.query<{role:string}>("update public.profiles set role='super_admin' where id=$1 returning role", [user]);
    assert.equal(update.rows[0]?.role,'super_admin');
  } finally {
    await db.close();
  }
});
