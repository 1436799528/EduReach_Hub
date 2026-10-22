import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import {
  auditChecklist,
  classifyMigrations,
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
    { version: '20261001120000', name: 'first', file: '20261001120000_first.sql', kind: 'shared' },
    { version: '20261001120000', name: 'second', file: '20261001120000_second.sql', kind: 'shared' },
  ], []);
  assert.deepEqual(problems.map((problem) => problem.kind), ['duplicate-version']);
});

test('files sharing an 8-digit date are history, and are marked as sharing it', () => {
  // 20260903 legitimately names six different migrations in this repository. The
  // shared date is not a conflict, but it does mean no version match can ever
  // identify one of them — hence `shared`, not `unique`.
  const files = ['20260903_one.sql', '20260903_two.sql'];
  const expectedKind = classifyMigrations([
    { version: '20260903', name: 'one', file: '20260903_one.sql' },
    { version: '20260903', name: 'two', file: '20260903_two.sql' },
  ]).map((migration) => migration.kind);
  assert.deepEqual(expectedKind, ['shared', 'shared']);

  const problems = auditChecklist(files, [
    { version: '20260903', name: 'one', file: '20260903_one.sql', kind: 'shared' },
    { version: '20260903', name: 'two', file: '20260903_two.sql', kind: 'shared' },
  ], []);
  assert.deepEqual(problems, []);
});

test('a checklist that calls a shared version unique is rejected', () => {
  // The dangerous transcription. If the generated block said `unique` for a file
  // that shares its version with another, the SQL would accept one ledger row as
  // evidence for several files - the AUD-10 false pass.
  const files = ['20260903_one.sql', '20260903_two.sql'];
  const problems = auditChecklist(files, [
    { version: '20260903', name: 'one', file: '20260903_one.sql', kind: 'unique' },
    { version: '20260903', name: 'two', file: '20260903_two.sql', kind: 'shared' },
  ], []);
  assert.deepEqual(problems.map((problem) => problem.kind), ['kind-mismatch']);
  assert.match(problems[0].detail, /migrations:checklist -- --write/, 'the failure must say how to fix it');
});

test('the checklist fails when an entry disagrees with the file it names', () => {
  const files = ['20261001120000_real_name.sql'];
  const problems = auditChecklist(files, [
    { version: '20261001120000', name: 'a_name_the_file_does_not_have', file: '20261001120000_real_name.sql', kind: 'unique' },
  ], []);
  assert.deepEqual(problems.map((problem) => problem.kind), ['name-mismatch']);
});

test('a migration without a version prefix is reported instead of being skipped', () => {
  assert.equal(parseMigrationFile('not_a_migration.sql'), null);
  const problems = auditChecklist(['not_a_migration.sql'], [], []);
  assert.deepEqual(problems.map((problem) => problem.kind), ['malformed-filename']);
});

test('rewriting the checklist from the files produces a checklist that passes', () => {
  const { migrations } = repoMigrations(root);
  const rewritten = withChecklist(validationSql, migrations);
  const reparsed = parseChecklist(rewritten);
  assert.deepEqual(auditChecklist(migrationFilesInRepo(root), reparsed), []);
  assert.match(rewritten.slice(rewritten.indexOf('-- 8.')), /every uniquely versioned migration is recorded/, 'the generated block must sit inside the SQL check that uses it');
});

// The static audit raises the alarm; this proves the SQL an operator runs
// reports the same thing. It executes against a real PostgreSQL (PGlite), with
// only the ledger table the Supabase platform provides — no hosted project, no
// write, nothing to clean up.
function checkEightSql(): string {
  const start = validationSql.indexOf('-- 8. Every migration is accounted for');
  const end = validationSql.indexOf('-- 9. The objects this release introduces');
  assert.ok(start >= 0 && end > start, 'production-validation.sql must keep a numbered check 8');
  const statement = validationSql
    .slice(start, end)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .trim();
  assert.ok(statement.startsWith('with repo_migrations'), 'check 8 must be a single read-only statement');
  return statement;
}

interface Verdict { result: string; check_name: string; detail: string }

async function ledgerVerdicts(rows: Array<{ version: string; name: string }>): Promise<Verdict[]> {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema if not exists supabase_migrations;
      create table supabase_migrations.schema_migrations (version text primary key, name text);
    `);
    for (const row of rows) {
      await db.query('insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)', [row.version, row.name]);
    }
    const { rows: output } = await db.query<Verdict>(checkEightSql());
    return output;
  } finally {
    await db.close();
  }
}

const verdict = (rows: Verdict[], fragment: string): Verdict => {
  const found = rows.find((row) => row.check_name.includes(fragment));
  assert.ok(found, `no verdict row mentions "${fragment}": ${rows.map((row) => row.check_name).join(' | ')}`);
  return found;
};

/** A ledger that records every file, each under its own distinct version. */
function distinctLedger(entries: Array<{ version: string; name: string; file: string }>) {
  return entries.map((entry, index) => ({
    version: entry.version.length === 8 ? `202609${String(index).padStart(6, '0')}` : entry.version,
    // The platform stores the prefixed name, sometimes with a different date
    // prefix; the comparison strips that prefix, which is the documented case.
    name: `${entry.version.length === 8 ? '20260915' : entry.version}_${entry.name}`,
  }));
}

test('check 8 reports pass for all three rules when every migration is recorded', async () => {
  assert.ok(checklist, 'checklist block is required');
  const verdicts = await ledgerVerdicts(distinctLedger(checklist));
  assert.equal(verdicts.length, 3, 'check 8 must return one verdict per rule');
  for (const row of verdicts) assert.equal(row.result, 'pass', `${row.check_name}: ${row.detail}`);
});

test('check 8 fails and names the file when a uniquely versioned migration is not in the ledger', async () => {
  assert.ok(checklist, 'checklist block is required');
  const omitted = checklist.find((entry) => entry.kind === 'unique')!;
  const rows = distinctLedger(checklist.filter((entry) => entry.file !== omitted.file));
  const verdicts = await ledgerVerdicts(rows);
  const unique = verdict(verdicts, 'uniquely versioned');
  assert.equal(unique.result, 'fail');
  assert.match(unique.detail, /1 of \d+ uniquely versioned repository migrations are not recorded/);
  assert.ok(unique.detail.includes(omitted.file), `detail must name ${omitted.file}: ${unique.detail}`);
});

test('one 20260903 ledger row cannot vouch for the six migrations that share that version', async () => {
  // AUD-10, the exact defect: check 8 used to accept a migration when *its
  // version* appeared in the ledger, so a single row with version 20260903
  // satisfied all six files on that date. Proven before the fix: one row made
  // check 8 return `pass` with "0 of 74 ... not recorded".
  assert.ok(checklist, 'checklist block is required');
  const shared = checklist.filter((entry) => entry.kind === 'shared');
  assert.ok(shared.length >= 5, 'the fixture needs the shared-version migrations');

  const rows = distinctLedger(checklist.filter((entry) => !entry.file.startsWith('20260903_')));
  // Exactly one row for the shared date, and it names only one of the six.
  rows.push({ version: '20260903', name: 'restrict_profile_client_columns' });

  const verdicts = await ledgerVerdicts(rows);
  const sharedVerdict = verdict(verdicts, 'sharing a legacy version');
  assert.equal(sharedVerdict.result, 'fail', 'a single shared-version row must not satisfy the group');
  const unrecorded = shared.filter(
    (entry) => entry.file.startsWith('20260903_') && entry.name !== 'restrict_profile_client_columns',
  );
  assert.equal(unrecorded.length, 4, 'four of the six files on that date have no row of their own');
  for (const entry of unrecorded) {
    assert.ok(sharedVerdict.detail.includes(entry.file), `${entry.file} is unrecorded and must be named: ${sharedVerdict.detail}`);
  }
  assert.ok(!sharedVerdict.detail.includes('restrict_profile_client_columns.sql'), 'the recorded file must not be listed as missing');
});

test('a shared-version migration is accepted on its own name, even under a different timestamp', async () => {
  // The documented reconciliation: five of the six 20260903 files are recorded in
  // the live ledger under a later version with the same name.
  assert.ok(checklist, 'checklist block is required');
  const documented: Record<string, string> = {
    '20260903_enable_staff_service_request_moderation.sql': '20260903191649',
    '20260903_harden_profile_and_submission_rls.sql': '20260903191619',
    '20260903_restrict_notification_creation_to_staff.sql': '20260903192620',
    '20260903_restrict_profile_client_columns.sql': '20260903191723',
    '20260903_scope_past_questions_to_student_programme.sql': '20260903192713',
  };
  const rows = distinctLedger(checklist.filter((entry) => !entry.file.startsWith('20260903_')));
  for (const [file, remoteVersion] of Object.entries(documented)) {
    const entry = checklist.find((item) => item.file === file)!;
    rows.push({ version: remoteVersion, name: `${remoteVersion}_${entry.name}` });
  }
  const verdicts = await ledgerVerdicts(rows);
  assert.equal(verdict(verdicts, 'sharing a legacy version').result, 'pass');
});

test('a migration with no ledger evidence is reported as unresolved, never as applied', async () => {
  assert.ok(checklist, 'checklist block is required');
  const unresolved = checklist.filter((entry) => entry.kind === 'unresolved');
  assert.equal(unresolved.length, 1, 'the reconciliation document leaves exactly one file unresolved');

  // Production-like state: every other file recorded, this one not.
  const rows = distinctLedger(checklist.filter((entry) => entry.kind !== 'unresolved'));
  const absent = verdict(await ledgerVerdicts(rows), 'no ledger evidence');
  assert.equal(absent.result, 'unresolved', 'absence of evidence must not be reported as pass or as fail');
  assert.ok(absent.detail.includes(unresolved[0].file), `the verdict must name the file: ${absent.detail}`);
  assert.notEqual(absent.result, 'pass');

  // Once a ledger row for the file itself exists, the rule stops blocking it.
  const present = verdict(
    await ledgerVerdicts([...rows, { version: '20260903191000', name: 'production_security_hardening' }]),
    'no ledger evidence',
  );
  assert.equal(present.result, 'pass', present.detail);
});

test('a version-only match does not settle an unresolved migration', async () => {
  // The unresolved file shares the legacy date 20260903. A ledger row carrying
  // that bare version is not evidence about the file, so the rule must stay
  // unresolved rather than quietly pass.
  assert.ok(checklist, 'checklist block is required');
  const rows = distinctLedger(checklist.filter((entry) => entry.kind !== 'unresolved'));
  rows.push({ version: '20260903', name: 'something_else_entirely' });
  const verdicts = await ledgerVerdicts(rows);
  assert.equal(verdict(verdicts, 'no ledger evidence').result, 'unresolved');
});

test('a stale generated checklist fails validation', () => {
  // A migration added to the repository without regenerating the block.
  const files = migrationFilesInRepo(root);
  const fresh = files.concat(['20261101120000_added_but_not_regenerated.sql']);
  const problems = auditChecklist(fresh, checklist);
  assert.deepEqual(problems.map((problem) => problem.kind), ['missing-from-checklist']);

  // A migration deleted from the repository without regenerating the block.
  const removed = files.filter((file) => file !== checklist![0].file);
  const stale = auditChecklist(removed, checklist);
  assert.deepEqual(stale.map((problem) => problem.kind), ['checklist-entry-without-file']);
});

test('the validation SQL contains no data-mutating statement', () => {
  // Read-only by construction: an operator runs this in the SQL editor against
  // production, so a stray write would be executed by hand.
  const stripped = validationSql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
  for (const keyword of ['insert', 'update', 'delete', 'truncate', 'drop', 'alter', 'create', 'grant', 'revoke', 'copy', 'vacuum', 'refresh']) {
    // `create or replace` inside a quoted comment string is not a statement; the
    // script's own text never assigns to a table.
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    assert.ok(!pattern.test(stripped), `production-validation.sql contains "${keyword}" outside a comment`);
  }
  assert.match(validationSql, /from supabase_migrations\.schema_migrations/, 'it must read the ledger');
});
