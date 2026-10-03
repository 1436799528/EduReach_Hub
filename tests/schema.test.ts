import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSchemaAudit, loadMigrations } from '../scripts/schema-audit';

// BASE-1: the repository must be able to build the database it expects.
// Run against a scratch Supabase project, `supabase db reset` is the definitive
// check; these tests are the offline equivalent (see docs/features/BASE-1.md).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const report = runSchemaAudit(root);

test('no migration references an object that no earlier migration creates', () => {
  const failures = report.hardFailures.map((failure) => `${failure.migration} → ${failure.kind} ${failure.reference}: ${failure.detail}`);
  assert.deepEqual(failures, [], 'a fresh apply would stop at the first of these');
});

test('every table and RPC the application uses is created by a migration', () => {
  assert.deepEqual(report.missingTables, []);
  assert.deepEqual(report.missingColumns, []);
});

test('no column is referenced before the migration that creates it', () => {
  assert.deepEqual(report.orderFailures.map((failure) => `${failure.migration} → ${failure.reference}`), []);
});

test('migration filenames are unique and timestamp-ordered', () => {
  const files = loadMigrations(root).map((migration) => migration.name);
  assert.equal(new Set(files).size, files.length, 'duplicate migration filename');
  for (const file of files) {
    assert.match(file, /^\d{8,14}_[a-z0-9_]+\.sql$/, `${file} must start with a sortable timestamp prefix`);
  }
});

test('the baseline sorts first and the seed runs after the tables it fills', () => {
  const files = loadMigrations(root).map((migration) => migration.name);
  assert.match(files[0], /baseline/, 'the baseline schema must be the first migration a fresh project applies');
  // BASE-1 renamed these two: they used to sort before 20260915_cbt_news_tables.sql,
  // which creates the tables they touch, so an empty database failed there.
  const tablesIndex = files.indexOf('20260915_cbt_news_tables.sql');
  assert.ok(tablesIndex >= 0);
  for (const dependent of [
    '20260916000000_application_integration_seed.sql',
    '20260916010000_cbt_news_rls.sql',
  ]) {
    const index = files.indexOf(dependent);
    assert.ok(index > tablesIndex, `${dependent} must run after the CBT/news tables exist`);
  }
});

test('the baseline creates schema only: no data, no destructive statements', () => {
  const baseline = readFileSync(join(root, 'supabase/migrations', loadMigrations(root)[0].name), 'utf8');
  const body = baseline
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
  for (const forbidden of [/\bdelete from\b/i, /\btruncate\b/i, /drop table/i, /drop column/i, /rename to/i]) {
    assert.doesNotMatch(body, forbidden);
  }
  // `insert into` is allowed only for storage bucket configuration, never for
  // application data or reference rows.
  const inserts = [...body.matchAll(/insert into\s+([a-z_.]+)/gi)].map((match) => match[1]);
  assert.ok(inserts.length > 0, 'the baseline is expected to create its storage buckets');
  for (const target of inserts) {
    assert.equal(target, 'storage.buckets', `the baseline must not insert application data (found ${target})`);
  }
});

test('the baseline does not demote anyone holding a retired role (ROLE-1 decision)', () => {
  const baseline = readFileSync(join(root, 'supabase/migrations', loadMigrations(root)[0].name), 'utf8');
  assert.doesNotMatch(baseline, /update\s+public\.profiles\s+set\s+role/i);
  assert.doesNotMatch(baseline, /'senate_admin'|'campus_agent'/);
});

test('the two staff predicates list the same roles', () => {
  // public.is_staff(uuid) (baseline, used by pre-baseline policies) and
  // public.is_staff_user() (ROLE-1, the application-facing predicate) must agree,
  // or a policy and the console would disagree about who is staff.
  const migrations = loadMigrations(root);
  const baseline = migrations[0].sql;
  const role1 = migrations.find((migration) => migration.name.includes('capability_role_alignment'))!.sql;

  const roleList = (sql: string, marker: string) => {
    const start = sql.indexOf(marker);
    assert.ok(start > 0, `${marker} not found`);
    const list = sql.slice(start, start + 400);
    const match = /role in \(([^)]*)\)/i.exec(list);
    assert.ok(match, `no role list after ${marker}`);
    return match![1]
      .split(',')
      .map((value) => value.trim().replace(/'/g, ''))
      .sort();
  };

  assert.deepEqual(roleList(baseline, 'create function public.is_staff'), roleList(role1, 'create or replace function public.is_staff_user'));
});

test('every table the baseline adds is used by the history or the application', () => {
  assert.deepEqual(report.unreferencedBaselineTables, [], 'no invented tables');
});

test('the known deferred (runtime-resolved) references have not grown', () => {
  // plpgsql bodies are not resolved when the migration runs. These are
  // pre-existing and documented; a new one means a function may fail at call
  // time in a fresh environment. `get_cbt_attempt_paper` was added by CBT-2 —
  // it is defined in the same migration before the function that calls it, and
  // tests/cbt-modes.test.ts exercises the call for real, so the entry records a
  // scanner limitation rather than a production risk.
  const tables = report.deferredWarnings
    .map((warning) => /public\.([a-z_]+)/.exec(warning)![1])
    .sort();
  assert.deepEqual(
    [...new Set(tables)],
    ['get_cbt_attempt_paper', 'get_cbt_questions_for_subjects', 'institutions', 'site_analytics_events'],
  );
});

test('storage buckets the application uses are created by migrations', () => {
  const migrations = loadMigrations(root).map((migration) => migration.sql).join('\n');
  for (const bucket of ['admin-content', 'resource-files', 'campus-uploads']) {
    assert.match(migrations, new RegExp(`'${bucket}'`), `bucket ${bucket} is referenced but never created`);
  }
});

test('migration count and table inventory are stable enough to notice an accidental deletion', () => {
  // A guard against a migration file being dropped by mistake: the counts only
  // move when a migration is added or removed deliberately.
  assert.ok(report.migrations.length >= 38, `expected at least 38 migrations, found ${report.migrations.length}`);
  for (const table of [
    'profiles', 'service_catalog', 'service_requests', 'student_notifications',
    'student_wallets', 'service_catalog', 'news_ingest_candidates', 'rate_limit_hits',
  ]) {
    assert.ok(report.tablesCreated.has(table), `${table} is not created by any migration`);
  }
});
