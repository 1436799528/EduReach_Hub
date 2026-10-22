/**
 * Migration checklist — does the SQL checklist cover every migration that
 * actually exists in this repository?
 *
 * `supabase/ci/production-validation.sql` is the read-only script an operator
 * runs in the Supabase SQL editor. Until now its "the migration history is
 * applied" check was `count(*) >= 74`, with the number written by hand, plus a
 * hand-written list of a few dozen versions. Both answers only "how many?" and
 * "these particular ones?". A migration added yesterday was counted by neither
 * statement, so the checklist could report `pass` while the repository held a
 * migration that no database had ever been told about.
 *
 * This module makes the checklist a generated artefact:
 *
 *   - `supabase/migrations/*.sql` is the source of truth (every file, no
 *     hand-picked subset, whether or not it changes schema);
 *   - the `values` list between the BEGIN/END markers in
 *     `supabase/ci/production-validation.sql` is written from that list;
 *   - `npm run migrations:checklist` fails when a file has no entry (a new,
 *     unchecked migration), when an entry has no file (a deleted or renamed
 *     migration), when two files claim the same version, or when an entry
 *     disagrees with its file's name.
 *
 * Nothing here contacts a database, and nothing marks a migration as applied.
 * The comparison against the live ledger happens in the SQL script itself,
 * read-only, where an operator can see it.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CHECKLIST_BEGIN = '-- BEGIN GENERATED MIGRATION CHECKLIST';
export const CHECKLIST_END = '-- END GENERATED MIGRATION CHECKLIST';
export const VALIDATION_SQL = 'supabase/ci/production-validation.sql';
export const MIGRATIONS_DIR = 'supabase/migrations';

export interface RepoMigration {
  /** The numeric prefix: 8 digits on the legacy files, 14 on newer ones. */
  version: string;
  /** Filename without the version prefix and without `.sql`. */
  name: string;
  /** Filename as committed. */
  file: string;
}

export interface ChecklistProblem {
  kind: 'missing-from-checklist' | 'checklist-entry-without-file' | 'duplicate-version' | 'name-mismatch' | 'malformed-filename' | 'missing-block' | 'duplicate-checklist-entry';
  detail: string;
  file?: string;
}

const FILE_PATTERN = /^(\d{8}|\d{14})_([A-Za-z0-9][A-Za-z0-9_.-]*)\.sql$/;

/** Every migration file in the repository, in filename order. */
export function migrationFilesInRepo(root: string): string[] {
  return readdirSync(join(root, MIGRATIONS_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

/** Parse a committed filename into its version and name. */
export function parseMigrationFile(file: string): RepoMigration | null {
  const match = FILE_PATTERN.exec(file);
  if (!match) return null;
  return { version: match[1], name: match[2], file };
}

/** The committed migrations, plus the filenames that do not follow the pattern. */
export function repoMigrations(root: string): { migrations: RepoMigration[]; malformed: string[] } {
  const migrations: RepoMigration[] = [];
  const malformed: string[] = [];
  for (const file of migrationFilesInRepo(root)) {
    const parsed = parseMigrationFile(file);
    if (parsed) migrations.push(parsed);
    else malformed.push(file);
  }
  return { migrations, malformed };
}

/** The generated block, without its markers. */
export function checklistBlock(sql: string): string | null {
  const begin = sql.indexOf(CHECKLIST_BEGIN);
  if (begin < 0) return null;
  const end = sql.indexOf(CHECKLIST_END, begin);
  if (end < 0) return null;
  return sql.slice(begin + CHECKLIST_BEGIN.length, end);
}

/** Read the checklist entries back out of the SQL. */
export function parseChecklist(sql: string): RepoMigration[] | null {
  const block = checklistBlock(sql);
  if (block === null) return null;
  const entries: RepoMigration[] = [];
  for (const match of block.matchAll(/\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/g)) {
    entries.push({ version: match[1], name: match[2], file: match[3] });
  }
  return entries;
}

/** The `values` rows for the SQL block, formatted for the SQL editor. */
export function renderChecklistRows(migrations: RepoMigration[]): string {
  return migrations
    .map((migration) => `    ('${migration.version}', '${migration.name}', '${migration.file}')`)
    .join(',\n');
}

/** Rewrite the generated block in a validation script, leaving everything else alone. */
export function withChecklist(sql: string, migrations: RepoMigration[]): string {
  const begin = sql.indexOf(CHECKLIST_BEGIN);
  const end = sql.indexOf(CHECKLIST_END, begin);
  if (begin < 0 || end < 0) throw new Error(`production-validation.sql has no ${CHECKLIST_BEGIN} … ${CHECKLIST_END} block`);
  return `${sql.slice(0, begin + CHECKLIST_BEGIN.length)}\n${renderChecklistRows(migrations)}\n${sql.slice(end)}`;
}

/**
 * The audit. Pure: it judges the files and the checklist it is given, so a test
 * can hand it a deliberately incomplete pair and see it fail.
 */
export function auditChecklist(files: string[], checklist: RepoMigration[] | null): ChecklistProblem[] {
  const problems: ChecklistProblem[] = [];

  if (checklist === null) {
    problems.push({ kind: 'missing-block', detail: `the checklist block is missing; run \`npm run migrations:checklist -- --write\`` });
    return problems;
  }

  const repo: RepoMigration[] = [];
  const malformed: string[] = [];
  for (const file of files) {
    const parsed = parseMigrationFile(file);
    if (parsed) repo.push(parsed);
    else malformed.push(file);
  }
  for (const file of malformed) {
    problems.push({ kind: 'malformed-filename', detail: `${file} does not start with an 8- or 14-digit version`, file });
  }

  const byFile = new Map(checklist.map((entry) => [entry.file, entry]));
  const byRepoFile = new Map(repo.map((entry) => [entry.file, entry]));

  for (const migration of repo) {
    const entry = byFile.get(migration.file);
    if (!entry) {
      problems.push({
        kind: 'missing-from-checklist',
        detail: `${migration.file} is in the repository but not in the checklist — run \`npm run migrations:checklist -- --write\``,
        file: migration.file,
      });
      continue;
    }
    if (entry.version !== migration.version || entry.name !== migration.name) {
      problems.push({
        kind: 'name-mismatch',
        detail: `the checklist says ${entry.version}/${entry.name} but the file is ${migration.version}/${migration.name}`,
        file: migration.file,
      });
    }
  }

  for (const entry of checklist) {
    if (!byRepoFile.has(entry.file)) {
      problems.push({
        kind: 'checklist-entry-without-file',
        detail: `the checklist lists ${entry.file}, which is not in ${MIGRATIONS_DIR}`,
        file: entry.file,
      });
    }
  }

  // Only 14-digit versions are real Supabase versions. The legacy files carry an
  // 8-digit date, and several of them legitimately share a date (six on
  // 20260903), so a repeated 8-digit prefix is not a conflict — it is history.
  const versions = new Map<string, string[]>();
  for (const migration of repo) {
    if (migration.version.length !== 14) continue;
    const list = versions.get(migration.version) ?? [];
    list.push(migration.file);
    versions.set(migration.version, list);
  }
  for (const [version, owners] of versions) {
    if (owners.length > 1) {
      problems.push({
        kind: 'duplicate-version',
        detail: `version ${version} is claimed by ${owners.join(' and ')} — a database cannot apply both`,
      });
    }
  }

  const seen = new Set<string>();
  for (const entry of checklist) {
    if (seen.has(entry.file)) {
      problems.push({ kind: 'duplicate-checklist-entry', detail: `${entry.file} appears more than once in the checklist`, file: entry.file });
    }
    seen.add(entry.file);
  }

  return problems;
}

function main(): void {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const write = process.argv.includes('--write');
  const { migrations, malformed } = repoMigrations(root);
  const path = join(root, VALIDATION_SQL);
  const sql = readFileSync(path, 'utf8');

  if (write) {
    if (malformed.length) {
      console.error(`MIGRATIONS: ${malformed.length} file(s) do not follow the version_name.sql pattern:`);
      for (const file of malformed) console.error(`  ${file}`);
      process.exitCode = 1;
      return;
    }
    writeFileSync(path, withChecklist(sql, migrations));
    console.log(`MIGRATIONS: checklist rewritten with ${migrations.length} migration(s) in ${VALIDATION_SQL}`);
    return;
  }

  const problems = auditChecklist(migrationFilesInRepo(root), parseChecklist(sql));
  const checked = migrations.length;
  if (problems.length) {
    console.error(`MIGRATIONS: the checklist does not match the repository (${checked} migration file(s) checked)`);
    for (const problem of problems) console.error(`  [${problem.kind}] ${problem.detail}`);
    process.exitCode = 1;
    return;
  }
  console.log(`MIGRATIONS: all ${checked} migrations in ${MIGRATIONS_DIR} are listed in the checklist (${VALIDATION_SQL})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
