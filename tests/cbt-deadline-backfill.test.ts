import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { migrationFiles, MIGRATIONS_DIR, SHIM_PATH } from '../scripts/replay';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The deadline backfill migration (20261124120000_cbt_deadline_backfill.sql).
 *
 * A timed attempt stored with `expires_at NULL` rendered a frozen countdown in
 * the exam hall. The migration restores `started_at + duration_minutes` — the
 * deadline the session was created with — and must never extend time.
 */

const STUDENT = '81111111-1111-4111-8111-111111111111';
const TIMED = '82222222-2222-4222-8222-222222222221';
const UNTIMED = '82222222-2222-4222-8222-222222222222';
const ALREADY_SET = '82222222-2222-4222-8222-222222222223';
const MIGRATION = '20261124120000_cbt_deadline_backfill.sql';

let db: PGlite;

before(async () => {
  db = new PGlite();
  // Apply every migration that predates the backfill, seed the legacy rows it
  // describes, then apply the backfill itself — exactly the order production
  // sees.
  const files = migrationFiles();
  assert.ok(files.includes(MIGRATION), `${MIGRATION} must exist in the migration history`);
  const cut = files.indexOf(MIGRATION);
  await db.exec(readFileSync(SHIM_PATH, 'utf8'));
  for (const file of files.slice(0, cut)) await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));

  await db.exec(`
    insert into auth.users(id,email,raw_user_meta_data) values ('${STUDENT}','a@synthetic.test','{}');
    insert into public.cbt_exams(id,title,exam_body,subject,description,duration_minutes,is_active)
      values ('${TIMED}','Synthetic timed','WAEC','Mathematics','test',30,true),
             ('${UNTIMED}','Synthetic untimed','WAEC','Mathematics','test',30,true),
             ('${ALREADY_SET}','Synthetic set','WAEC','Mathematics','test',30,true);
    -- The legacy insert shape (started_at + (duration_minutes || ' minutes')::interval)
    -- with a NULL exam duration produced a NULL deadline on a timed session.
    insert into public.cbt_attempts(id,user_id,exam_id,status,started_at,expires_at,duration_minutes,total_questions,answers_draft) values
      ('${TIMED}','${STUDENT}','${TIMED}','in_progress',timestamptz '2026-11-24 12:00:00+00',null,30,1,'{}'),
      ('${UNTIMED}','${STUDENT}','${UNTIMED}','in_progress',timestamptz '2026-11-24 12:00:00+00',null,null,1,'{}'),
      ('${ALREADY_SET}','${STUDENT}','${ALREADY_SET}','in_progress',timestamptz '2026-11-24 12:00:00+00',timestamptz '2026-11-24 12:15:00+00',30,1,'{}');
  `);

  await db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION), 'utf8'));
});

after(async () => {
  await db.close();
});

test('a timed attempt stored without a deadline gets started_at + duration_minutes', async () => {
  const { rows } = await db.query<{ expires_at: Date | string }>(
    'select expires_at from public.cbt_attempts where id=$1',
    [TIMED],
  );
  assert.equal(new Date(rows[0].expires_at).toISOString(), '2026-11-24T12:30:00.000Z', 'exactly the promised deadline, never now + duration');
});

test('a genuinely untimed attempt keeps no deadline', async () => {
  const { rows } = await db.query<{ expires_at: Date | string | null }>(
    'select expires_at from public.cbt_attempts where id=$1',
    [UNTIMED],
  );
  assert.equal(rows[0].expires_at, null);
});

test('an existing deadline is never moved', async () => {
  const { rows } = await db.query<{ expires_at: Date | string }>(
    'select expires_at from public.cbt_attempts where id=$1',
    [ALREADY_SET],
  );
  assert.equal(new Date(rows[0].expires_at).toISOString(), '2026-11-24T12:15:00.000Z');
});

test('the migration is idempotent', async () => {
  await db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION), 'utf8'));
  const { rows } = await db.query<{ expires_at: Date | string }>(
    'select expires_at from public.cbt_attempts where id=$1',
    [TIMED],
  );
  assert.equal(new Date(rows[0].expires_at).toISOString(), '2026-11-24T12:30:00.000Z');
});
