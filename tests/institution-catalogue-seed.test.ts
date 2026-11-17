import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { PGlite } from '@electric-sql/pglite';

import { buildCatalogueRows, buildMigration, publicWebsiteFor, slugFor } from '../scripts/institutions/buildCatalogueMigration';
import { applyMigrations, MIGRATIONS_DIR, REPO_ROOT } from '../scripts/replay';

// REG-2: the catalogue migration. After it runs, every database holds the same
// 328 universities with the same registry facts — and none of it is published,
// none of it overwrites research, and none of the unsafe domains reach the
// public directory column.

const MIGRATION = '20261119120000_institution_catalogue_registry.sql';
const migrationSql = readFileSync(join(MIGRATIONS_DIR, MIGRATION), 'utf8');

async function withCatalogue<T>(run: (db: PGlite) => Promise<T>): Promise<T> {
  const db = new PGlite();
  try {
    await applyMigrations(db);
    return await run(db);
  } finally {
    await db.close();
  }
}

test('the migration is generated from the data files, not written by hand', () => {
  assert.equal(
    buildMigration(buildCatalogueRows()),
    migrationSql,
    'the committed migration is exactly what `npm run institutions:catalogue` produces',
  );
  assert.match(migrationSql, /^-- Institution catalogue/, 'the header says what the file is for');
  assert.match(migrationSql, /-- GENERATED FILE\. Do not edit by hand/, 'and that it is generated');
});

test('the catalogue holds all 328 universities after replay', async () => {
  await withCatalogue(async (db) => {
    const { rows } = await db.query<{ n: number }>('select count(*)::int as n from public.institutions');
    assert.equal(rows[0].n, 328, 'every university the Commission lists is in the catalogue');

    const { rows: verified } = await db.query<{ n: number }>(
      'select count(*)::int as n from public.institutions where is_verified',
    );
    assert.equal(verified[0].n, 0, 'a registry row is not a verified institution');

    const { rows: added } = await db.query<{ school_name: string; state: string }>(
      "select school_name, state from public.institutions where lower(school_name) = 'african university of economics, fct, abuja'",
    );
    assert.equal(added.length, 1, 'the 2024 private university the catalogue was missing is now there');
    assert.equal(added[0].state, 'FCT Abuja');
  });
});

test('every profile is a draft discovered fact, never published', async () => {
  await withCatalogue(async (db) => {
    const { rows } = await db.query<{ publication: string; verification: string; n: number }>(
      `select publication_status as publication, verification_status as verification, count(*)::int as n
         from public.institution_profiles group by 1, 2`,
    );
    assert.deepEqual(rows, [{ publication: 'draft', verification: 'discovered', n: 328 }]);

    const { rows: websites } = await db.query<{ n: number }>(
      'select count(*)::int as n from public.institution_profiles where official_website_url is not null',
    );
    assert.equal(websites[0].n, 190, 'the 190 websites the Commission publishes are recorded');
  });
});

test('an unsafe domain never reaches the public directory column', async () => {
  await withCatalogue(async (db) => {
    const { rows } = await db.query<{ n: number }>(
      'select count(*)::int as n from public.institutions where website_url is not null',
    );
    assert.equal(rows[0].n, 177, 'only https addresses whose domain belongs to the institution are public');

    // Catalogue names, which are the names our directory already uses.
    for (const [name, domain] of [
      ['North Eastern University, Gombe', 'pru.edu.ng'],
      ['Glorious Vision University, Ogwa', 'sau.edu.ng'],
      ['Ojaja University, Eiyenkorin', 'crownhilluniversity.edu.ng'],
      ['African University of Science & Technology, Abuja', 'aust.edu.ng'],
    ] as const) {
      const { rows: publicRow } = await db.query<{ website_url: string | null }>(
        'select website_url from public.institutions where lower(trim(school_name)) = lower(trim($1))',
        [name],
      );
      assert.equal(publicRow.length, 1, `${name} is in the catalogue`);
      assert.equal(publicRow[0].website_url, null, `${name} does not publish a domain that is not its own`);

      const { rows: profile } = await db.query<{ official_website_url: string | null }>(
        `select p.official_website_url from public.institution_profiles p
           join public.institutions i on i.id = p.institution_id
          where lower(trim(i.school_name)) = lower(trim($1))`,
        [name],
      );
      assert.ok(profile[0]?.official_website_url?.includes(domain), `${name} keeps the published address as evidence`);
    }
  });
});

test('the registry vice chancellor is discovered, and a researched one is never replaced', async () => {
  await withCatalogue(async (db) => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.institution_leadership where office_key = 'vice_chancellor' and is_current",
    );
    assert.equal(rows[0].n, 262, "every vice chancellor the Commission names is recorded once");

    const { rows: verified } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.institution_leadership where verification_status <> 'discovered'",
    );
    assert.equal(verified[0].n, 0, 'a registry listing is never marked verified');

    // A profile a researcher has already confirmed must survive a re-run.
    const { rows: unical } = await db.query<{ id: string }>(
      "select id from public.institutions where lower(trim(school_name)) = 'university of calabar'",
    );
    await db.exec(`
      update public.institution_profiles
         set ownership = 'state', year_established = 1900, verification_status = 'verified',
             publication_status = 'in_review', official_website_url = 'https://research.example/calabar'
       where institution_id = '${unical[0].id}';
      update public.institution_leadership
         set full_name = 'Professor Confirmed', verification_status = 'verified'
       where institution_id = '${unical[0].id}' and office_key = 'vice_chancellor';
    `);
    await db.exec(migrationSql);

    const { rows: after } = await db.query<{ ownership: string; year: number; website: string; publication: string }>(
      `select ownership, year_established as year, official_website_url as website, publication_status as publication
         from public.institution_profiles where institution_id = '${unical[0].id}'`,
    );
    assert.deepEqual(after[0], {
      ownership: 'state',
      year: 1900,
      website: 'https://research.example/calabar',
      publication: 'in_review',
    }, 'a verified profile is not overwritten by a registry fact');

    const { rows: leader } = await db.query<{ full_name: string }>(
      `select full_name from public.institution_leadership
        where institution_id = '${unical[0].id}' and office_key = 'vice_chancellor' and is_current`,
    );
    assert.equal(leader.length, 1, 'no second current vice chancellor is created');
    assert.equal(leader[0].full_name, 'Professor Confirmed');
  });
});

test('re-running the migration changes nothing', async () => {
  await withCatalogue(async (db) => {
    const counts = async () => {
      const { rows } = await db.query<{ institutions: number; profiles: number; leadership: number; sources: number }>(
        `select (select count(*)::int from public.institutions) as institutions,
                (select count(*)::int from public.institution_profiles) as profiles,
                (select count(*)::int from public.institution_leadership) as leadership,
                (select count(*)::int from public.edureach_sources) as sources`,
      );
      return rows[0];
    };
    const before = await counts();
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    assert.deepEqual(await counts(), before, 'the migration is idempotent');
  });
});

test('the publication gate still refuses a discovered profile', async () => {
  await withCatalogue(async (db) => {
    const { rows } = await db.query<{ id: string }>(
      "select id from public.institutions where lower(trim(school_name)) = 'university of ibadan, ibadan'",
    );
    await assert.rejects(
      db.exec(`update public.institution_profiles set publication_status = 'published' where institution_id = '${rows[0].id}'`),
      /cannot be published|verification status/i,
      'the gate blocks publishing a fact that is only discovered',
    );
  });
});

test('the two unsettled identities are recorded, not deleted', async () => {
  await withCatalogue(async (db) => {
    // On a fresh database neither row exists: the Commission does not list the
    // African School of Economics, and it lists the University of Calabar once.
    const { rows: absent } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.institutions
        where lower(trim(school_name)) in ('african school of economics, abuja', 'university of calabar, calabar')`,
    );
    assert.equal(absent[0].n, 0, 'the migration invents neither row');

    // Production holds both, so model that and run the migration again.
    await db.exec(`
      insert into public.institutions (school_name, state, institution_type, is_verified)
      values ('African School of Economics, Abuja', 'FCT Abuja', 'university', true),
             ('University of Calabar, Calabar', 'Cross River', 'university', true);
    `);
    await db.exec(migrationSql);

    const { rows: alias } = await db.query<{ alias_name: string; alias_type: string }>(
      "select alias_name, alias_type from public.institution_aliases where alias_name = 'University of Calabar, Calabar'",
    );
    assert.deepEqual(alias, [{ alias_name: 'University of Calabar, Calabar', alias_type: 'duplicate_candidate' }]);
    assert.match(migrationSql, /'duplicate_candidate'/, 'the pair is recorded as a duplicate candidate');

    const { rows: evidence } = await db.query<{ verification_status: string; field_key: string }>(
      `select e.verification_status, e.field_key from public.institution_fact_evidence e
         join public.institutions i on i.id = e.institution_id
        where lower(trim(i.school_name)) = 'african school of economics, abuja'`,
    );
    assert.equal(evidence.length, 1, 'the school the Commission does not list is flagged, not removed');
    assert.equal(evidence[0].field_key, 'registry_presence');
    assert.equal(evidence[0].verification_status, 'disputed');

    // Both rows survive, and the catalogue grew by exactly the two we added.
    const { rows: total } = await db.query<{ n: number }>('select count(*)::int as n from public.institutions');
    assert.equal(total[0].n, 330, 'nothing is deleted and nothing is duplicated');
  });
});

test('the generated helper agrees with the data it ships', () => {
  const rows = buildCatalogueRows();
  assert.equal(rows.length, 328);
  assert.equal(rows.filter((row) => row.isNew).length, 1);
  assert.equal(rows.filter((row) => row.website).length, 190);
  assert.equal(rows.filter((row) => row.publicWebsite).length, 177);
  assert.equal(rows.filter((row) => row.viceChancellor).length, 262);

  assert.equal(publicWebsiteFor({ website: 'http://aust.edu.ng/', flags: ['website_not_https'] }), null);
  assert.equal(publicWebsiteFor({ website: 'https://pru.edu.ng/', flags: ['website_domain_not_abbreviation'] }), null);
  assert.equal(publicWebsiteFor({ website: 'https://www.unilag.edu.ng', flags: [] }), 'https://www.unilag.edu.ng');
  assert.equal(slugFor('University of Calabar, Calabar'), 'university-of-calabar-calabar');

  // The repository's own test-data convention: the migration is inside the
  // replay path, so `tests/migrations.test.ts` proves it applies in order.
  assert.ok(readFileSync(join(REPO_ROOT, 'scripts/replay.ts'), 'utf8').includes('readdirSync(MIGRATIONS_DIR)'));
});
