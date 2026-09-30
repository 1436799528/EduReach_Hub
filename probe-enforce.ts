import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from './scripts/replay';
const db = new PGlite();
await applyMigrations(db);
const uid = '11111111-2222-3333-4444-555555555555';
const other = '99999999-9999-9999-9999-999999999999';
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3)`, [uid, 'a@b.c', JSON.stringify({ first_name: 'A' })]);
await db.query(`insert into public.student_notifications (user_id, title, body, notification_type) values ($1,'t','b','service_request')`, [uid]);
async function as(role: string, userId: string | null, label: string, sql: string) {
  await db.exec(`set role ${role}`);
  if (userId) await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  try {
    const r: any = await db.query(sql);
    console.log(`  ok   ${label} → ${JSON.stringify(r.rows[0])}`);
  } catch (e: any) {
    console.log(`  deny ${label} → ${e.message.slice(0, 55)}`);
  } finally {
    await db.exec('reset role');
  }
}
await as('authenticated', uid, 'own notification rows', 'select count(*)::int as n from public.student_notifications');
await as('authenticated', other, 'other user notification rows', 'select count(*)::int as n from public.student_notifications');
await as('authenticated', uid, 'own profile rows', 'select count(*)::int as n from public.profiles');
await as('authenticated', other, 'other user profile rows', 'select count(*)::int as n from public.profiles');
await as('authenticated', other, 'other user profile id', 'select id::text as id from public.profiles');
await as('anon', null, 'public service rows', 'select count(*)::int as n from public.service_catalog');
await db.close();
