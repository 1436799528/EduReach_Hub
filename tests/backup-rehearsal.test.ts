import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runBackupRehearsal, schemaFingerprint } from '../scripts/backup-rehearsal';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../scripts/replay';

// CRIT-1: the audit's first critical finding was that no backup or restore
// procedure existed anywhere. The procedure is documented in
// docs/operations/BACKUP_AND_RESTORE.md, and this test keeps it honest by
// running the part that can actually be executed — a real backup/restore round
// trip on the PostgreSQL engine — and by failing if the document stops naming
// what it does *not* prove.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

// The round trip builds and dumps a whole database, so it runs once and the
// assertions read its report.
const report = await runBackupRehearsal();

test('a backup restores into a fresh database with the same data, schema and policies', () => {
  for (const step of report.steps) {
    assert.equal(step.state, 'pass', `${step.name}: ${step.detail}`);
  }
  assert.ok(report.migrations > 40, `expected the full migration set, applied ${report.migrations}`);
  assert.ok(report.backupBytes > 10_000, `expected a real archive, got ${report.backupBytes} bytes`);
  assert.equal(report.passed, true);
});

test('the rehearsal proves security survives the restore, not just row counts', () => {
  const names = report.steps.map((step) => step.name);
  assert.ok(
    names.some((name) => /row-level security behaves identically/.test(name)),
    'a restore that loses its policies is a breach with a green tick — the rehearsal must check it',
  );
  assert.ok(
    names.some((name) => /schema fingerprint matches, including policies and RLS/.test(name)),
    'the schema check must include policies and RLS, not only tables',
  );
  const fingerprintStep = report.steps.find((step) => step.name.startsWith('schema fingerprint'));
  assert.match(fingerprintStep?.detail || '', /polic/i);
});

test('the schema fingerprint counts what it claims to count', async () => {
  const db = new PGlite();
  try {
    await applyMigrations(db);
    const fingerprint = await schemaFingerprint(db);
    assert.ok(fingerprint.tables > 30, `expected the full schema, found ${fingerprint.tables} tables`);
    assert.ok(fingerprint.policies > 30, `expected the RLS posture, found ${fingerprint.policies} policies`);
    assert.equal(
      fingerprint.rlsTables,
      fingerprint.tables,
      'every public table is protected by RLS; a restore must not change that',
    );
  } finally {
    await db.close();
  }
});

test('the procedure is documented, actionable and honest about its gaps', () => {
  const doc = read('docs/operations/BACKUP_AND_RESTORE.md');

  // Actionable: a step-by-step a second person could follow.
  assert.match(doc, /pg_dump/, 'the logical backup command is documented');
  assert.match(doc, /pg_restore/, 'and the restore command');
  assert.match(doc, /Point-in-Time Recovery|point-in-time/i, 'the platform restore path is named');
  assert.match(doc, /npm run backup:rehearsal/, 'the executable rehearsal is referenced');
  assert.match(doc, /Storage \(not covered by any database backup\)/, 'storage is called out as uncovered');

  // Honest: the parts that need credentials are marked unverified, not implied.
  assert.match(doc, /NOT VERIFIED/, 'unverified platform facts are labelled');
  assert.match(doc, /No Supabase production backup has been restored/, 'the document states what is not proven');
  assert.match(doc, /procedure documented,\s*\n?schema-and-data round trip rehearsed, production restore untested/, 'the status line does not overclaim');

  // The claim in §6 must match the rehearsal this test just ran, and it is
  // derived from that run rather than from a hardcoded number: the previous
  // constant silently stopped describing reality once migrations added tables,
  // columns and policies.
  assert.match(doc, new RegExp(`${report.migrations} migrations`), 'the documented migration count matches the run');
  // Whitespace-tolerant: the documented line wraps in the middle of the numbers.
  const { tables, columns, policies } = report.fingerprint;
  assert.match(
    doc,
    new RegExp(`${tables}\\s+tables,\\s+${columns}\\s+columns,\\s+${policies}\\s+policies`),
    'the documented fingerprint matches the run',
  );
  assert.match(
    doc,
    new RegExp(`${report.fingerprint.rlsTables}\\s+tables with RLS`),
    'the documented RLS table count matches the run',
  );
});

test('no dump or credential can be committed', () => {
  const ignore = read('.gitignore');
  for (const pattern of ['*.dump', '*.list.txt']) {
    assert.match(ignore, new RegExp(pattern.replace('*', '\\*')), `${pattern} must be ignored — dumps hold student data`);
  }
  const doc = read('docs/operations/BACKUP_AND_RESTORE.md');
  assert.match(doc, /Never commit a dump to this repository/);
});
