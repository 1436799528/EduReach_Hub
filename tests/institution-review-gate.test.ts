import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { MIGRATIONS_DIR, applyMigrations } from '../scripts/replay';

// The publication gate, exercised on a real PostgreSQL engine.
//
// Before this migration the rule "published requires verified" lived only in the
// API. That is one code path away from being bypassed by a script, an importer or
// a future handler. The trigger below makes the rule a property of the row, and
// these tests are what stop it being quietly dropped in a refactor.
//
// The gate is deliberately additive: it refuses a *publication*, it never
// deletes or hides a record, and an unverified row stays fully editable.

const GATE_MIGRATION = '20261118120000_institution_review_gate.sql';
const INST = '11111111-1111-4111-8111-111111111111';
const OFFERING_VERIFIED = '44444444-4444-4444-8444-444444444444';
const OFFERING_DRAFT = '55555555-5555-4555-8555-555555555555';
const UNIT_UNVERIFIED = '66666666-6666-4666-8666-666666666666';

let db: PGlite;

async function rejects(sql: string, why: string): Promise<string> {
  let failed = false;
  let message = '';
  try {
    await db.exec(sql);
  } catch (error) {
    failed = true;
    message = (error as Error).message;
  }
  assert.ok(failed, why);
  return message;
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  await db.exec('alter role service_role bypassrls');
  await db.exec(`
    insert into public.institutions (id, school_name, acronym, state, institution_type)
    values ('${INST}', 'Synthetic University', 'SU', 'Rivers', 'university');
    insert into public.institution_profiles
      (institution_id, official_name, publication_status, verification_status, source_url)
    values ('${INST}', 'Synthetic University', 'draft', 'discovered', 'https://example.edu.ng/about');
  `);
});

after(async () => {
  await db.close();
});

test('the review-gate migration is idempotent', async () => {
  const sql = readFileSync(join(MIGRATIONS_DIR, GATE_MIGRATION), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  const { rows } = await db.query<{ n: number }>(
    "select count(*)::int as n from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname = 'institution_profiles' and t.tgname = 'institution_profiles_publication_gate'",
  );
  assert.equal(rows[0].n, 1, 're-applying the loop does not duplicate a trigger');
});

test('a profile cannot be published while it is unverified', async () => {
  const message = await rejects(`
    update public.institution_profiles set publication_status = 'published'
    where institution_id = '${INST}'
  `, 'publishing an unverified profile is refused');
  assert.match(message, /cannot be published/i);
  assert.match(message, /verify the facts and their source first/i, 'the refusal tells the editor what to do');
  assert.match(message, /discovered/, 'the refusal names the status that blocked it');

  const { rows } = await db.query<{ publication_status: string; verification_status: string }>(
    'select publication_status, verification_status from public.institution_profiles',
  );
  assert.deepEqual(rows[0], { publication_status: 'draft', verification_status: 'discovered' }, 'the refused update changed nothing');
});

test('every gated table refuses the same combination', async () => {
  const cases: Array<[string, string]> = [
    ['institution_programme_offerings', `insert into public.institution_programme_offerings (institution_id, programme_name, admission_session, verification_status, publication_status) values ('${INST}', 'BSc Physics', '2026/2027', 'in_review', 'published')`],
    ['institution_admission_routes', `insert into public.institution_admission_routes (institution_id, admission_session, entry_mode, verification_status, publication_status) values ('${INST}', '2026/2027', 'UTME', 'discovered', 'published')`],
    ['institution_portal_guides', `insert into public.institution_portal_guides (institution_id, guide_type, title, verification_status, publication_status) values ('${INST}', 'admission', 'How to apply', 'outdated', 'published')`],
  ];
  for (const [table, sql] of cases) {
    const message = await rejects(sql, `${table} refuses publication without verification`);
    assert.match(message, /cannot be published/i, `${table} names the gate`);
  }
});

test('a table without a publication axis stays fully writable', async () => {
  // Academic units, leadership and campuses have no publication status. The gate
  // body reads the row as jsonb, so it is a no-op here rather than an error: an
  // editor can record an unverified unit and fix it later.
  await db.exec(`
    insert into public.institution_academic_units
      (institution_id, unit_type, unit_name, slug, verification_status)
    values ('${INST}', 'faculty', 'Science', 'science', 'unresearched');
    update public.institution_academic_units
      set verification_status = 'verified', review_note = 'Prospectus checked.'
      where slug = 'science';
  `);
  const { rows } = await db.query<{ verification_status: string }>(
    "select verification_status from public.institution_academic_units where slug = 'science'",
  );
  assert.equal(rows[0].verification_status, 'verified');
});

test('a verified record may be published, and an unverified sibling stays editable', async () => {
  await db.exec(`
    update public.institution_profiles
    set verification_status = 'verified', publication_status = 'published'
    where institution_id = '${INST}';

    insert into public.institution_programme_offerings
      (id, institution_id, programme_name, admission_session, verification_status, publication_status, source_url)
    values ('${OFFERING_VERIFIED}', '${INST}', 'BSc Physics', '2026/2027', 'verified', 'published', 'https://example.edu.ng/physics'),
           ('${OFFERING_DRAFT}', '${INST}', 'BA History', '2026/2027', 'discovered', 'draft', null);

    insert into public.institution_academic_units
      (id, institution_id, unit_type, unit_name, slug, verification_status)
    values ('${UNIT_UNVERIFIED}', '${INST}', 'faculty', 'Arts', 'arts', 'discovered');
  `);

  // An unverified row is still editable: the gate is about publication only.
  await db.exec(`
    update public.institution_programme_offerings set programme_code = 'HIS' where id = '${OFFERING_DRAFT}';
    update public.institution_academic_units set unit_name = 'Arts and Humanities' where id = '${UNIT_UNVERIFIED}';
    update public.institution_programme_offerings set verification_status = 'verified' where id = '${OFFERING_DRAFT}';
  `);

  // …and it can then be published. Its sibling's status is untouched.
  await db.exec(`update public.institution_programme_offerings set publication_status = 'published' where id = '${OFFERING_DRAFT}'`);
  const { rows } = await db.query<{ id: string; publication_status: string }>(
    'select id, publication_status from public.institution_programme_offerings order by id',
  );
  assert.equal(rows.length, 2);
  for (const row of rows) assert.equal(row.publication_status, 'published');
});

test('unpublishing and archiving are never blocked by the gate', async () => {
  await db.exec(`
    update public.institution_programme_offerings set publication_status = 'archived' where id = '${OFFERING_DRAFT}';
    update public.institution_programme_offerings set verification_status = 'outdated' where id = '${OFFERING_DRAFT}';
    update public.institution_profileS set publication_status = 'in_review' where institution_id = '${INST}';
  `);
  const { rows } = await db.query<{ publication_status: string; verification_status: string }>(
    `select publication_status, verification_status from public.institution_programme_offerings where id = '${OFFERING_DRAFT}'`,
  );
  assert.deepEqual(rows[0], { publication_status: 'archived', verification_status: 'outdated' }, 'a record can be withdrawn and marked outdated without a fight');
});

test('the review overview is one query, inverted for staff only, and never anonymous', async () => {
  const { rows } = await db.query<{
    institution_id: string; programme_offerings: number; academic_units: number; published_offerings: number; evidence_rows: number;
  }>('select institution_id, programme_offerings, academic_units, published_offerings, evidence_rows from public.institution_review_overview');
  assert.equal(rows.length, 1, 'one row per institution');
  assert.equal(rows[0].institution_id, INST);
  assert.equal(rows[0].programme_offerings, 2, 'every programme is counted, published or not');
  assert.equal(rows[0].published_offerings, 1, 'the archived row is not published');
  assert.equal(rows[0].academic_units, 2, 'both units are counted, verified or not');
  assert.equal(rows[0].evidence_rows, 0);

  // security_invoker: the view runs with the caller's rights, so an anonymous
  // caller is bound by the same policies as the base tables and has no grant.
  const { rows: mode } = await db.query<{ reloptions: string[] | null }>(
    "select reloptions from pg_class where relname = 'institution_review_overview'",
  );
  assert.ok((mode[0].reloptions ?? []).some((option) => /security_invoker=true/.test(option)), 'the view is security_invoker');

  await db.exec('set role anon');
  try {
    let denied = false;
    try {
      await db.exec('select 1 from public.institution_review_overview');
    } catch (error) {
      denied = true;
      assert.match((error as Error).message, /permission denied/i);
    }
    assert.ok(denied, 'anonymous callers cannot read the review overview');
  } finally {
    await db.exec('reset role');
  }
});

test('the review columns exist on the tables the console edits', async () => {
  const { rows } = await db.query<{ table_name: string; column_name: string }>(`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and column_name in ('review_note', 'reviewed_by', 'last_checked_at')
      and table_name in ('institution_profiles', 'institution_academic_units', 'institution_programme_offerings',
                         'institution_admission_routes', 'institution_programme_requirements',
                         'institution_portal_guides', 'institution_fact_evidence')
    order by table_name, column_name
  `);
  const tables = new Set(rows.map((row) => row.table_name));
  for (const table of [
    'institution_profiles', 'institution_academic_units', 'institution_programme_offerings',
    'institution_admission_routes', 'institution_programme_requirements', 'institution_portal_guides',
  ]) {
    assert.ok(tables.has(table), `${table} records who reviewed it and when`);
  }
  assert.ok(rows.filter((row) => row.table_name === 'institution_fact_evidence').length >= 1);
});
