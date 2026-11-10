import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// Disposable synthetic records only. These tests document risks; they do not
// implement, authorize, or certify account deletion.
const A = 'a1111111-1111-4111-8111-111111111111';
const B = 'b1111111-1111-4111-8111-111111111111';
const ADMIN = 'c1111111-1111-4111-8111-111111111111';
const POST = 'd1111111-1111-4111-8111-111111111111';
let db: PGlite;

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  for (const [id, email] of [[A, 'a@synthetic.test'], [B, 'b@synthetic.test'], [ADMIN, 'admin@synthetic.test']]) {
    await db.query('insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)', [id, email, '{}']);
  }
  await db.query('insert into public.campus_posts (id,author_id) values ($1,$2)', [POST, A]);
  await db.query('insert into public.campus_post_comments (post_id,author_id) values ($1,$2)', [POST, B]);
  await db.query("insert into public.site_analytics_events (event_name,path,session_id,user_id) values ('page_view','/','synthetic-session',$1)", [A]);
  await db.query("insert into public.admin_audit_logs (admin_user_id,action,entity_type) values ($1,'synthetic','test')", [ADMIN]);
});
after(async () => { await db.close(); });

test('a naive Auth deletion cascades to another user’s contribution and leaves unlinked analytics', async () => {
  await db.query('delete from auth.users where id=$1', [A]);
  const comments = await db.query<{ count: number }>('select count(*)::int as count from public.campus_post_comments where author_id=$1', [B]);
  const survivor = await db.query<{ count: number }>('select count(*)::int as count from public.profiles where id=$1', [B]);
  const analytics = await db.query<{ count: number }>('select count(*)::int as count from public.site_analytics_events where user_id=$1', [A]);
  assert.equal(comments.rows[0].count, 0, 'another user’s comment is deleted through the shared post cascade');
  assert.equal(survivor.rows[0].count, 1, 'the other student still exists');
  assert.equal(analytics.rows[0].count, 1, 'an unlinked analytics identifier survives Auth deletion');
});

test('audit references can prevent an Auth deletion instead of completing it', async () => {
  await assert.rejects(db.query('delete from auth.users where id=$1', [ADMIN]), /foreign key/i);
  const user = await db.query<{ count: number }>('select count(*)::int as count from auth.users where id=$1', [ADMIN]);
  assert.equal(user.rows[0].count, 1);
});
