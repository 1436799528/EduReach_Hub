import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import {
  auditChecklist,
  migrationFilesInRepo,
  parseChecklist,
  parseMigrationFile,
  repoMigrations,
  VALIDATION_SQL,
  withChecklist,
} from '../scripts/migration-checklist';

// The migration checklist has to fail when a migration is not in it.
//
// `supabase/ci/production-validation.sql` used to answer "is the history
// applied?" with `count(*) >= 74` and a hand-written list of release versions.
// Neither statement could see a migration that had just been added: the count
// was satisfied by any 74 rows and the list only named the files someone had
// remembered to paste in. These tests pin both halves of the replacement: the
// static audit that raises the alarm, and the SQL that reports the comparison
// when an operator runs it against the project.

const root = fileURLToPath(new URL('..', import.meta.url));
const validationSql = readFileSync(join(root, VALIDATION_SQL), 'utf8');

/** The generated rows, as the audit expects to receive them. */
const checklist = parseChecklist(validationSql);

test('every migration file in the repository is listed in the checklist', () => {
  assert.ok(checklist, 'production-validation.sql must carry the generated checklist block');
  const problems = auditChecklist(migrationFilesInRepo(root), checklist);
  assert.deepEqual(problems, [], problems.map((problem) => problem.detail).join('; '));
  assert.equal(checklist.length, migrationFilesInRepo(root).length, 'the checklist must list every migration file, exactly once');
});

test('the checklist fails when a migration is omitted from it', () => {
  const files = migrationFilesInRepo(root);
  const omitted = files[files.length - 1];
  const shortened = (checklist ?? []).filter((entry) => entry.file !== omitted);
  const problems = auditChecklist(files, shortened);
  assert.equal(problems.length, 1, `expected exactly one problem, got ${JSON.stringify(problems)}`);
  assert.equal(problems[0].kind, 'missing-from-checklist');
  assert.match(problems[0].detail, new RegExp(omitted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(problems[0].detail, /migrations:checklist -- --write/, 'the failure must say how to fix it');
});

test('the checklist fails when it lists a migration that no longer exists', () => {
  const files = migrationFilesInRepo(root).filter((file) => file !== checklist?.[0]?.file);
  const problems = auditChecklist(files, checklist ?? []);
  assert.equal(problems.length, 1, JSON.stringify(problems));
  assert.equal(problems[0].kind, 'checklist-entry-without-file');
});

test('the checklist fails when two files claim the same 14-digit version', () => {
  const files = ['20261001120000_first.sql', '20261001120000_second.sql'];
  const problems = auditChecklist(files, [
    { version: '20261001120000', name: 'first', file: '20261001120000_first.sql' },
    { version: '20261001120000', name: 'second', file: '20261001120000_second.sql' },
  ]);
  assert.deepEqual(problems.map((problem) => problem.kind), ['duplicate-version']);
});

test('six legacy files sharing an 8-digit date are history, not a conflict', () => {
  // 20260903 legitimately names six different migrations in this repository.
  const files = ['20260903_one.sql', '20260903_two.sql'];
  const problems = auditChecklist(files, [
    { version: '20260903', name: 'one', file: '20260903_one.sql' },
    { version: '20260903', name: 'two', file: '20260903_two.sql' },
  ]);
  assert.deepEqual(problems, []);
});

test('the checklist fails when an entry disagrees with the file it names', () => {
  const files = ['20261001120000_real_name.sql'];
  const problems = auditChecklist(files, [
    { version: '20261001120000', name: 'a_name_the_file_does_not_have', file: '20261001120000_real_name.sql' },
  ]);
  assert.deepEqual(problems.map((problem) => problem.kind), ['name-mismatch']);
});

test('a migration without a version prefix is reported instead of being skipped', () => {
  assert.equal(parseMigrationFile('not_a_migration.sql'), null);
  const problems = auditChecklist(['not_a_migration.sql'], []);
  assert.deepEqual(problems.map((problem) => problem.kind), ['malformed-filename']);
});

test('rewriting the checklist from the files produces a checklist that passes', () => {
  const { migrations } = repoMigrations(root);
  const rewritten = withChecklist(validationSql, migrations);
  const reparsed = parseChecklist(rewritten);
  assert.deepEqual(auditChecklist(migrationFilesInRepo(root), reparsed), []);
  assert.match(rewritten.slice(rewritten.indexOf('-- 8.')), /every migration in the repository is recorded/, 'the generated block must sit inside the SQL check that uses it');
});

// The static audit raises the alarm; this proves the SQL an operator runs
// reports the same thing. It executes against a real PostgreSQL (PGlite), with
// only the ledger table the Supabase platform provides — no hosted project, no
// write, nothing to clean up.
function checkEightSql(): string {
  const start = validationSql.indexOf('-- 8. Every migration');
  const end = validationSql.indexOf('-- 9. The objects this release introduces');
  assert.ok(start >= 0 && end > start, 'production-validation.sql must keep a numbered check 8');
  const block = validationSql.slice(start, end);
  const statement = block
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .trim();
  assert.ok(statement.startsWith('with repo_migrations'), 'check 8 must be a single read-only statement');
  return statement;
}

async function ledgerResult(rows: Array<{ version: string; name: string }>): Promise<{ result: string; detail: string }> {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema if not exists supabase_migrations;
      create table supabase_migrations.schema_migrations (version text primary key, name text);
    `);
    for (const row of rows) {
      await db.query('insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)', [row.version, row.name]);
    }
    const { rows: output } = await db.query<{ result: string; detail: string }>(checkEightSql());
    return output[0];
  } finally {
    await db.close();
  }
}

test('check 8 passes when the ledger records every migration in the checklist', async () => {
  assert.ok(checklist, 'checklist block is required');
  // The live ledger recorded several of these files under a later version
  // number, so the ledger rows deliberately use different versions and the
  // prefixed names the platform stores.
  const rows = checklist.map((entry, index) => ({
    version: String(20260000000000 + index),
    // The platform stored the legacy files under a name with a different date
    // prefix, which is exactly the case the prefix-stripping comparison covers.
    name: `${entry.version.length === 8 ? '20260915' : entry.version}_${entry.name}`,
  }));
  const output = await ledgerResult(rows);
  assert.equal(output.result, 'pass', output.detail);
});

test('check 8 fails and names the file when one migration is not in the ledger', async () => {
  assert.ok(checklist, 'checklist block is required');
  const omitted = checklist[checklist.length - 1];
  const rows = checklist
    .filter((entry) => entry.file !== omitted.file)
    .map((entry, index) => ({ version: String(20260000000000 + index), name: `${entry.version.length === 8 ? '20260915' : entry.version}_${entry.name}` }));
  const output = await ledgerResult(rows);
  assert.equal(output.result, 'fail');
  assert.match(output.detail, /1 of \d+ repository migrations are not recorded/);
  assert.ok(output.detail.includes(omitted.file), `detail must name ${omitted.file}: ${output.detail}`);
});
