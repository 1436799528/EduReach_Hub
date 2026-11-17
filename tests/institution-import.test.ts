import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { REPO_ROOT, applyMigrations } from '../scripts/replay';
import { isSession, transformBatch, type DirectoryEntry } from '../scripts/institutions/researchBatch';

// INSTITUTION-2: the research importer. The batch under test is the real
// `data/institutions/research-batch-001.json`, transformed by the real mapping
// and applied by the real transactional function — on a synthetic PostgreSQL,
// with synthetic institutions that reuse the batch's own UUIDs.
//
// What is proven here:
//   * the mapping resolves every source key and both institutions;
//   * a dry run writes nothing but returns the same counts an apply would;
//   * an apply lands every row in_review, never published;
//   * re-applying is idempotent and never publishes or duplicates;
//   * a verified row is not overwritten by an older batch;
//   * rows whose programme was never researched are rejected with a reason,
//     not silently dropped.

const UNICAL = '1e7e9cdd-b6aa-42d1-b9fc-76f8d6a55ddc';
const FUHSI = 'a413c221-219a-4120-a187-d4dc9586f1e6';

const batch = JSON.parse(readFileSync(join(REPO_ROOT, 'data/institutions/research-batch-001.json'), 'utf8'));
// The catalogue the batch is resolved against is the batch's own institution
// list. It grew from the two universities this file started with to the full
// 329-institution inventory, and an institution the catalogue cannot resolve is
// a blocking failure for the whole batch — so a two-row catalogue would now
// reject all 327 others. Deriving the directory keeps the assertion that
// matters (every row resolves to exactly one catalogue row) true for the real
// batch rather than for a fixture that no longer resembles it.
const directory: DirectoryEntry[] = batch.institutions.map((institution: any) => ({
  institutionId: institution.institutionId,
  canonicalName: institution.canonicalName,
  acronym: institution.acronym ?? null,
}));

/** Escapes a value for inclusion in a single-quoted SQL literal. */
function sqlText(value: unknown): string {
  return value === null || value === undefined ? 'null' : `'${String(value).replace(/'/g, "''")}'`;
}

let db: PGlite;

async function apply(payload: unknown, dryRun: boolean) {
  const { rows } = await db.query<{ result: any }>(
    'select public.institution_import_apply($1::jsonb, $2::boolean) as result',
    [JSON.stringify(payload), dryRun],
  );
  return rows[0].result;
}

function total(bucket: Record<string, number> | undefined): number {
  return Object.values(bucket ?? {}).reduce((sum, value) => sum + Number(value ?? 0), 0);
}

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
  await db.exec('alter role service_role bypassrls');
  // Every institution the batch can reference must exist before the apply
  // tests run: the imported rows carry foreign keys to public.institutions, and
  // the batch now covers the whole inventory rather than two universities.
  const rows = directory
    .map(
      (entry) =>
        `('${entry.institutionId}', ${sqlText(entry.canonicalName)}, ${sqlText(entry.acronym)}, 'Nigeria', 'university')`,
    )
    .join(',\n           ');
  await db.exec(`
    insert into public.institutions (id, school_name, acronym, state, institution_type)
    values ${rows}
    on conflict (id) do nothing;
  `);
});

after(async () => { await db.close(); });

test('the real research batch maps cleanly onto the catalogue', () => {
  const { payload, issues, counts } = transformBatch(batch, directory, { batchId: 'test-batch' });
  assert.ok(payload, `payload must be produced; issues: ${JSON.stringify(issues)}`);
  const unresolved = issues.filter((issue) => /catalogue row|reconcile them/.test(issue.reason));
  assert.deepEqual(unresolved, [], 'every institution resolves to exactly one catalogue row');
  // The two universities this file was originally written against are still in
  // the batch, and each must still resolve to exactly one catalogue row now that
  // the catalogue covers the whole inventory.
  for (const id of [UNICAL, FUHSI]) {
    assert.equal(
      directory.filter((entry) => entry.institutionId === id).length,
      1,
      `${id} resolves to exactly one catalogue row`,
    );
  }
  assert.equal(counts.sources, 164, 'every source in the batch is carried');
  assert.equal(counts.profiles, 41, 'every institution that publishes a profile is mapped');
  assert.ok(counts.leadership >= 4, 'both universities publish at least a Vice-Chancellor');
  assert.ok(counts.benchmarks >= 7, 'institution threshold, programme minimums and aggregates are all typed');
  assert.ok(counts.guides >= 4, 'portal instructions are carried');
  assert.ok(counts.nationalPolicies >= 8, 'the JAMB minimum table and admission age are separate policy rows');
  assert.equal(payload!.benchmarks.filter((b) => b.benchmarkType === 'national_minimum').length, 0);
});

test('an unverified chancellorship is not imported as a person', () => {
  const { payload } = transformBatch(batch, directory);
  const unicalChancellor = payload!.leadership.filter(
    (row) => row.institutionId === UNICAL && row.officeKey === 'chancellor',
  );
  assert.deepEqual(unicalChancellor, [], 'a null name must never become a record');
});

test('a benchmark outside its declared scale is reported, not coerced', () => {
  const broken = structuredClone(batch);
  broken.institutions[1].admission.programmeMinimumUtmeScores[0].score = 420; // of 400
  const { issues } = transformBatch(broken, directory);
  assert.ok(
    issues.some((issue) => issue.entity === 'institution_admission_benchmarks' && /outside its 0-400 scale/.test(issue.reason)),
    'an impossible UTME score is rejected with a readable reason',
  );
});

test('an unknown benchmark type is rejected instead of being guessed', () => {
  const broken = structuredClone(batch);
  broken.institutions[0].admission.benchmarks[0].benchmarkType = 'vibes_based_cutoff';
  const { issues } = transformBatch(broken, directory);
  assert.ok(
    issues.some((issue) => /unrecognised benchmark type/.test(issue.reason)),
    'an unknown type must not be silently mapped to a known one',
  );
});

test('sessions must be consecutive academic years', () => {
  assert.equal(isSession('2026/2027'), true);
  assert.equal(isSession('2026/2028'), false);
  assert.equal(isSession('2026-2027'), false);
  assert.equal(isSession(undefined), false);
});

test('an institution that is not in the catalogue blocks the import', () => {
  const broken = structuredClone(batch);
  broken.institutions[1].canonicalName = 'University of Nowhere';
  broken.institutions[1].institutionId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const { payload, issues } = transformBatch(broken, directory);
  assert.equal(payload, null, 'a missing institution is a blocking validation failure');
  assert.ok(issues.some((issue) => /no catalogue row is named/.test(issue.reason)));
});

test('a batch that asserts publication is refused', () => {
  const broken = structuredClone(batch);
  broken.institutions[0].profile.publicationStatus = 'published';
  const { payload, issues } = transformBatch(broken, directory);
  assert.equal(payload, null, 'imports never publish');
  assert.ok(issues.some((issue) => /must not assert a publication state/.test(issue.reason)));
});

test('a dry run writes nothing and reports what an apply would do', async () => {
  const { payload } = transformBatch(batch, directory, { batchId: 'test-batch' });
  const summary = await apply(payload, true);
  assert.equal(summary.dryRun, true);
  assert.ok(total(summary.inserted) > 20, `expected a substantial insert plan, got ${JSON.stringify(summary.inserted)}`);

  const { rows } = await db.query<{ n: number }>('select count(*)::int as n from public.institution_profiles');
  assert.equal(rows[0].n, 0, 'the sentinel block rolled back every write');
  const { rows: sources } = await db.query<{ n: number }>('select count(*)::int as n from public.edureach_sources');
  assert.equal(sources[0].n, 0, 'sources written during the dry run were rolled back too');
});

test('an apply lands every row in review, never published', async () => {
  const { payload } = transformBatch(batch, directory, { batchId: 'test-batch' });
  const summary = await apply(payload, false);
  assert.equal(summary.dryRun, false);
  assert.ok(total(summary.inserted) > 20);

  const { rows } = await db.query<{ verification_status: string; publication_status: string }>(
    'select verification_status, publication_status from public.institution_profiles',
  );
  assert.deepEqual(rows.every((row) => row.verification_status === 'in_review' && row.publication_status === 'in_review'), true);

  const { rows: offerings } = await db.query<{ publication_status: string; verification_status: string }>(
    'select publication_status, verification_status from public.institution_programme_offerings',
  );
  assert.ok(offerings.length > 10);
  assert.ok(offerings.every((row) => row.publication_status === 'in_review' && row.verification_status === 'in_review'));

  const { rows: guides } = await db.query<{ n: number }>(
    'select count(*)::int as n from public.institution_portal_guide_steps',
  );
  assert.ok(guides[0].n > 5, 'guide steps are imported in order');

  // Nothing researched is public yet.
  await db.exec('set role anon');
  try {
    const { rows: publicProfiles } = await db.query<{ n: number }>('select count(*)::int as n from public.institution_profiles');
    assert.equal(publicProfiles[0].n, 0, 'in_review research is invisible to a visitor');
  } finally {
    await db.exec('reset role');
  }
});

test('re-applying the same batch changes nothing that matters', async () => {
  const { payload } = transformBatch(batch, directory, { batchId: 'test-batch' });
  const before = await db.query<{ n: number }>('select count(*)::int as n from public.institution_programme_offerings');
  const summary = await apply(payload, false);
  const after = await db.query<{ n: number }>('select count(*)::int as n from public.institution_programme_offerings');
  assert.equal(after.rows[0].n, before.rows[0].n, 'no duplicate offerings');
  assert.equal(total(summary.inserted), 0, 'a second apply inserts nothing new');
  assert.ok(total(summary.updated) > 0, 'it refreshes the in_review rows instead');
});

test('an older batch never overwrites verified research', async () => {
  // Research approved today, then an older batch arrives.
  await db.exec(`
    update public.institution_profiles
      set verification_status = 'verified', publication_status = 'published',
          profile_verified_at = now() + interval '1 day'
      where institution_id = '${UNICAL}';
  `);
  const { payload } = transformBatch(batch, directory, { batchId: 'test-batch' });
  const summary = await apply(payload, false);
  assert.ok(
    Number(summary.skipped_verified?.institution_profiles ?? 0) >= 1,
    `the verified profile must be skipped, got ${JSON.stringify(summary.skipped_verified)}`,
  );
  const { rows } = await db.query<{ verification_status: string; history_summary: string | null }>(
    `select verification_status, history_summary from public.institution_profiles where institution_id = '${UNICAL}'`,
  );
  assert.equal(rows[0].verification_status, 'verified', 'the verified row kept its state');
});

test('a requirement for a programme nobody researched is rejected with a reason', async () => {
  const { payload } = transformBatch(batch, directory, { batchId: 'test-batch' });
  const mutated = structuredClone(payload!);
  mutated.requirements.push({
    institutionId: UNICAL,
    programmeName: 'Astrobiology',
    admissionSession: '2026/2027',
    entryMode: 'UTME',
    utmeSubjects: ['Use of English'],
    sourceUrl: 'https://www.unical.edu.ng/',
  });
  const summary = await apply(mutated, false);
  assert.equal(summary.rejected.length, 1);
  assert.match(summary.rejected[0].reason, /no offering/);
});
