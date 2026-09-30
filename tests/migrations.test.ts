import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations, migrationFiles, REPO_ROOT } from '../scripts/replay';

// TEST-1 / BASE-1: apply every migration, in filename order, to a real
// PostgreSQL engine and then assert the objects the application uses exist.
//
// The engine is a real PostgreSQL compiled to WebAssembly (`@electric-sql/pglite`;
// 0.5.8 bundles PostgreSQL 18.3), so this runs in `npm test` — on every developer
// machine, in CI, and offline. It catches what the static `schema:audit` cannot:
// invalid syntax, a bad constraint, a policy Postgres refuses. It is NOT Supabase
// Cloud: the `auth` and `storage` surface is provided by
// `supabase/ci/platform-shims.sql`, no hosted project is contacted, and RLS is
// created but not exercised as a non-superuser role (see docs/features/TEST-1.md).

async function withDatabase<T>(run: (db: PGlite) => Promise<T>): Promise<T> {
  const db = new PGlite();
  try {
    return await run(db);
  } finally {
    await db.close();
  }
}

test('every migration applies, in order, to a real PostgreSQL engine', async () => {
  await withDatabase(async (db) => {
    // PGlite ships a real PostgreSQL build (0.5.8 bundles PostgreSQL 18.3); the
    // assertion guards against a future dependency change quietly swapping it
    // for something that is not PostgreSQL.
    const engine = await db.query<{ version: string }>('select version() as version');
    const major = Number(/PostgreSQL (\d+)\./.exec(engine.rows[0].version)?.[1] ?? 0);
    assert.ok(major >= 16, `expected a real PostgreSQL >= 16, got: ${engine.rows[0].version}`);

    const applied = await applyMigrations(db);
    assert.equal(applied.length, migrationFiles().length, 'every migration file must be applied');
  });
});

test('the applied schema satisfies the objects the application uses', async () => {
  await withDatabase(async (db) => {
    await applyMigrations(db);
    // Throws with a list of what is missing if any assertion fails.
    await db.exec(readFileSync(join(REPO_ROOT, 'supabase/ci/verify-migrations.sql'), 'utf8'));

    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
    );
    assert.ok(rows[0].n >= 35, `expected at least 35 public tables, found ${rows[0].n}`);
  });
});
