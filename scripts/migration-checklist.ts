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
 *     disagrees with its file's name or its reconciliation kind.
 *
 * Every row carries a `kind`, because "is this migration recorded?" cannot be
 * answered the same way for every file:
 *
 *   - `unique`  — one file owns this version, so a ledger row with that version
 *                 is evidence for this file (the live ledger recorded many of
 *                 these under a later timestamp; see the reconciliation doc);
 *   - `shared`  — several files share a legacy 8-digit version (six share
 *                 `20260903`). A version match is NOT evidence for any of them:
 *                 one ledger row would make all six look applied. These are
 *                 matched individually, by their own name, and nothing else;
 *   - `unresolved` — the archive holds no ledger evidence that distinguishes
 *                 this file at all (documented in the reconciliation CSV). It is
 *                 reported as `unresolved`, never as `pass` and never as a
 *                 confident `fail`.
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

/** How a migration's ledger record can be established. See the header. */
export type MigrationKind = 'unique' | 'shared' | 'unresolved';

export interface RepoMigration {
  /** The numeric prefix: 8 digits on the legacy files, 14 on newer ones. */
  version: string;
  /** Filename without the version prefix and without `.sql`. */
  name: string;
  /** Filename as committed. */
  file: string;
  /** Defaults to `unique` when the file is neither shared nor documented as unresolved. */
  kind?: MigrationKind;
}

/**
 * Migrations the archive has no ledger evidence for, with the evidence that
 * would settle each one.
 *
 * Source: `docs/operations/MIGRATION_HISTORY_MAP_2026-10-16.csv`, the row-by-row
 * comparison of every local file against the 173-entry live ledger. A file belongs
 * here only with a classification from that document saying no ledger record
 * matched it — not because it "looks odd".
 */
export interface UnresolvedMigration {
  file: string;
  /** What the reconciliation document recorded, quoted so it can be checked. */
  evidence: string;
  /** What would move this file out of this list. */
  needed: string;
}

export const UNRESOLVED_MIGRATIONS: readonly UnresolvedMigration[] = [
  {
    file: '20260903_production_security_hardening.sql',
    evidence:
      'MIGRATION_HISTORY_MAP_2026-10-16.csv records classification "legacy-filename-unmapped": no same-name live ledger entry was found. (The ledger does hold a similarly named 20260903191133 production_security_contract_hardening, which is NOT the same file.)',
    needed:
      'Compare the file against the baseline and the 20260903191133 entry on a disposable Supabase branch; if the SQL is equivalent, map it here with that version, otherwise treat it as still pending.',
  },
];

/** The unresolved files, keyed by filename. */
const UNRESOLVED_BY_FILE = new Map(UNRESOLVED_MIGRATIONS.map((entry) => [entry.file, entry]));

export interface ChecklistProblem {
  kind: 'missing-from-checklist' | 'checklist-entry-without-file' | 'duplicate-version' | 'name-mismatch' | 'malformed-filename' | 'missing-block' | 'duplicate-checklist-entry' | 'kind-mismatch' | 'unresolved-entry-without-evidence' | 'stale-unresolved-entry';
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
  return { migrations: classifyMigrations(migrations), malformed };
}

/**
 * Decide how each migration's ledger record can be established.
 *
 * A version shared by several files can never identify one of them, so those
 * files are `shared` no matter how the ledger looks. A file the reconciliation
 * document could not match to any ledger row is `unresolved`, which takes
 * precedence: it cannot be evidence for anything.
 */
export function classifyMigrations(migrations: RepoMigration[]): RepoMigration[] {
  const perVersion = new Map<string, number>();
  for (const migration of migrations) perVersion.set(migration.version, (perVersion.get(migration.version) ?? 0) + 1);
  return migrations.map((migration) => {
    const kind: MigrationKind = UNRESOLVED_BY_FILE.has(migration.file)
      ? 'unresolved'
      : (perVersion.get(migration.version) ?? 0) > 1
        ? 'shared'
        : 'unique';
    return { ...migration, kind };
  });
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
  for (const match of block.matchAll(/\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'(unique|shared|unresolved)'\s*\)/g)) {
    entries.push({ version: match[1], name: match[2], file: match[3], kind: match[4] as MigrationKind });
  }
  return entries;
}

/** The rows in the block that did not parse as a four-column entry. */
export function malformedChecklistRows(sql: string): string[] {
  const block = checklistBlock(sql);
  if (block === null) return [];
  const wellFormed = new Set<string>();
  for (const match of block.matchAll(/\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'(?:unique|shared|unresolved)'\s*\)/g)) {
    wellFormed.add(match[0]);
  }
  return [...block.matchAll(/\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'[^']*'(?:\s*,\s*'[^']*')?\s*\)/g)]
    .map((match) => match[0])
    .filter((row) => !wellFormed.has(row));
}

/**
 * The `values` rows for the SQL block, formatted for the SQL editor.
 *
 * The fourth column is the reconciliation kind, so the SQL can apply a different
 * rule to each group rather than one loose rule to all of them.
 */
export function renderChecklistRows(migrations: RepoMigration[]): string {
  const classified = classifyMigrations(migrations);
  return classified
    .map((migration) => `    ('${migration.version}', '${migration.name}', '${migration.file}', '${migration.kind}')`)
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
export function auditChecklist(
  files: string[],
  checklist: RepoMigration[] | null,
  /** The documented evidence list. Empty when auditing a synthetic file list. */
  evidence: readonly UnresolvedMigration[] = UNRESOLVED_MIGRATIONS,
): ChecklistProblem[] {
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

  // The reconciliation kind is what the SQL uses to choose its matching rule, so
  // a stale kind is not cosmetic: `unique` on a file that shares a legacy
  // version would let one ledger row vouch for several files. Recompute the kind
  // from the repository and the documented evidence, and require the generated
  // block to agree.
  const expectedKinds = new Map(classifyMigrations(
    repo.map(({ version, name, file }) => ({ version, name, file })),
  ).map((migration) => [migration.file, migration.kind]));

  for (const entry of checklist) {
    const expected = expectedKinds.get(entry.file);
    if (!expected) continue;
    if (entry.kind !== expected) {
      problems.push({
        kind: 'kind-mismatch',
        detail: `${entry.file} is listed as "${entry.kind}" but its ledger evidence is "${expected}" — run \`npm run migrations:checklist -- --write\``,
        file: entry.file,
      });
    }
    if (entry.kind === 'unresolved' && !evidence.some((item) => item.file === entry.file)) {
      problems.push({
        kind: 'unresolved-entry-without-evidence',
        detail: `${entry.file} is marked unresolved, which needs an entry in UNRESOLVED_MIGRATIONS recording why the ledger cannot establish it`,
        file: entry.file,
      });
    }
  }

  // A documented-unresolved file that is no longer in the repository means the
  // evidence list has gone stale and should stop exempting anything.
  for (const unresolved of evidence) {
    if (!byRepoFile.has(unresolved.file)) {
      problems.push({
        kind: 'stale-unresolved-entry',
        detail: `${unresolved.file} is recorded as unresolved but is not in ${MIGRATIONS_DIR}; remove its entry from UNRESOLVED_MIGRATIONS`,
        file: unresolved.file,
      });
    }
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
  for (const row of malformedChecklistRows(sql)) {
    problems.push({ kind: 'missing-from-checklist', detail: `the checklist row ${row} is not a four-column (version, name, file, kind) entry — run \`npm run migrations:checklist -- --write\`` });
  }
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
