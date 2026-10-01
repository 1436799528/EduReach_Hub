/**
 * BASE-1 schema audit.
 *
 * Answers, without a database: "if this repository is given to an empty
 * Supabase project, does the migration history create everything it needs?"
 *
 * It walks the migrations in filename order, tracks the objects each one
 * creates, and reports:
 *
 *   hardFailures        statements that reference an object no earlier migration
 *                       created — the first one is where a fresh apply stops;
 *   missingTables       tables/RPCs the application calls that no migration creates;
 *   missingColumns      columns the application or the history uses that no
 *                       migration creates;
 *   orderFailures       a column referenced before the migration that adds it;
 *   guardedNotes        dynamic SQL (`execute '...'`) whose target may be absent
 *                       by design (those statements are conditionally skipped);
 *   deferredWarnings    table references inside plpgsql bodies, which Postgres
 *                       only resolves when the function runs.
 *
 * Limitations, stated rather than hidden: it does not execute SQL, and it
 * resolves references at table/RPC granularity (plus columns where the
 * repository names them explicitly). The definitive check remains
 * `supabase db reset` on a scratch project — see docs/features/BASE-1.md.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface MigrationFile {
  name: string;
  sql: string;
}

export interface HardFailure {
  migration: string;
  reference: string;
  kind: string;
  detail: string;
}

export interface AuditReport {
  migrations: string[];
  tablesCreated: Map<string, string>;
  functionsCreated: Set<string>;
  codeTables: Set<string>;
  codeFunctions: Set<string>;
  hardFailures: HardFailure[];
  missingTables: string[];
  missingColumns: string[];
  orderFailures: HardFailure[];
  guardedNotes: string[];
  deferredWarnings: string[];
  unreferencedBaselineTables: string[];
}

/** Objects Supabase provides before any migration runs. */
const PLATFORM_TABLES = new Set(['auth.users', 'storage.objects', 'storage.buckets']);

const CODE_DIRS = ['server.ts', 'src', 'lib', 'pages', 'netlify', 'scripts'];

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/** Blank out string literals, keeping a marker so callers can spot dynamic SQL. */
function blankStrings(sql: string): { static: string; dynamic: string[] } {
  const dynamic: string[] = [];
  const staticSql = sql.replace(/'(?:[^']|'')*'/g, (match) => {
    dynamic.push(match);
    return "''";
  });
  return { static: staticSql, dynamic };
}

interface TableState {
  created: string;
  columns: Map<string, string>;
  referenced: boolean;
}

function collectDefinitions(sql: string, state: {
  tables: Map<string, TableState>;
  functions: Set<string>;
}) {
  for (const match of sql.matchAll(/create table (?:if not exists )?public\.([a-z_]+)\s*\(([\s\S]*?)\n\)\s*;/gi)) {
    const [, table, body] = match;
    if (state.tables.has(table)) continue;
    const columns = new Map<string, string>();
    for (const line of body.split('\n')) {
      const column = /^\s*([a-z_]+)\s+[a-z]/i.exec(line);
      if (column && !['constraint', 'primary', 'foreign', 'unique', 'check'].includes(column[1].toLowerCase())) {
        columns.set(column[1], 'create');
      }
    }
    state.tables.set(table, { created: '', columns, referenced: true });
  }

  for (const statement of sql.split(';')) {
    const alter = /alter table (?:if exists )?public\.([a-z_]+)/i.exec(statement);
    if (!alter) continue;
    const table = state.tables.get(alter[1]);
    if (!table) continue;
    for (const column of statement.matchAll(/add column if not exists ([a-z_]+)/gi)) {
      if (!table.columns.has(column[1])) table.columns.set(column[1], 'alter');
    }
  }

  for (const match of sql.matchAll(/create (?:or replace )?function public\.([a-z_]+)\s*\(([^)]*)\)/gi)) {
    state.functions.add(`${match[1]}(${match[2].split(',').length === 1 && match[2].trim() === '' ? 0 : match[2].split(',').length})`);
  }
}

/** References that must resolve when the statement runs. */
function collectReferences(sql: string, file: string, failures: { hard: HardFailure[]; order: HardFailure[] }, state: {
  tables: Map<string, TableState>;
  functions: Set<string>;
}) {
  const tableRef = (table: string, kind: string) => {
    const entry = state.tables.get(table);
    if (!entry) {
      failures.hard.push({ migration: file, reference: `public.${table}`, kind, detail: 'table is not created by any earlier migration' });
      return;
    }
    entry.referenced = true;
  };

  const patterns: Array<[RegExp, string]> = [
    [/create index if not exists \S+ on public\.([a-z_]+)/gi, 'index'],
    [/create policy \S+ on public\.([a-z_]+)/gi, 'policy'],
    [/drop policy if exists \S+ on public\.([a-z_]+)/gi, 'policy'],
    [/alter table (?:if exists )?public\.([a-z_]+)/gi, 'alter table'],
    [/create trigger \S+[\s\S]{0,120}?(?:before|after|instead of)\s+[\s\S]{0,60}?\son public\.([a-z_]+)/gi, 'trigger'],
    [/insert into public\.([a-z_]+)/gi, 'insert'],
    [/update public\.([a-z_]+)/gi, 'update'],
    [/delete from public\.([a-z_]+)/gi, 'delete'],
    [/(?:revoke|grant)[^;]*?on table public\.([a-z_]+)/gi, 'grant/revoke'],
    [/references public\.([a-z_]+)\s*\(/gi, 'foreign key'],
    [/join public\.([a-z_]+)/gi, 'join'],
    [/from public\.([a-z_]+)/gi, 'from'],
    [/, public\.([a-z_]+)/gi, 'reference'],
  ];

  for (const [pattern, kind] of patterns) {
    for (const match of sql.matchAll(pattern)) {
      if (PLATFORM_TABLES.has(`public.${match[1]}`)) continue;
      tableRef(match[1], kind);
    }
  }

  // Static function calls in DDL: revoke/grant statements check the signature.
  for (const match of sql.matchAll(/(?:revoke|grant)[^;]*?on function public\.([a-z_]+)\s*\(([^)]*)\)/gi)) {
    const args = match[2].trim();
    const arity = args === '' ? 0 : args.split(',').length;
    if (!state.functions.has(`${match[1]}(${arity})`)) {
      failures.hard.push({
        migration: file,
        reference: `public.${match[1]}(${arity} args)`,
        kind: 'grant/revoke function',
        detail: 'function signature is not created by any earlier migration',
      });
    }
  }

  // Columns named explicitly by the history: index definitions and column grants.
  for (const match of sql.matchAll(/create index if not exists \S+ on public\.([a-z_]+)\s*\(([^)]*)\)/gi)) {
    const table = state.tables.get(match[1]);
    if (!table) continue;
    for (const raw of match[2].split(',')) {
      const column = raw.trim().split(/\s+/)[0].replace(/[()]/g, '');
      if (!/^[a-z_]+$/.test(column)) continue;
      if (!table.columns.has(column)) {
        failures.order.push({ migration: file, reference: `public.${match[1]}.${column}`, kind: 'index column', detail: 'column is not created by any earlier migration' });
      }
    }
  }
  for (const match of sql.matchAll(/(?:revoke|grant) (?:update|insert|select)\s*\(([^)]*)\)\s*on table public\.([a-z_]+)/gi)) {
    const table = state.tables.get(match[2]);
    if (!table) continue;
    for (const column of match[1].split(',').map((value) => value.trim())) {
      if (!/^[a-z_]+$/.test(column)) continue;
      if (!table.columns.has(column)) {
        failures.order.push({ migration: file, reference: `public.${match[2]}.${column}`, kind: 'column grant', detail: 'column is not created by any earlier migration' });
      }
    }
  }
  for (const match of sql.matchAll(/insert into public\.([a-z_]+)\s*\(([^)]*)\)/gi)) {
    const table = state.tables.get(match[1]);
    if (!table) continue;
    for (const column of match[2].split(',').map((value) => value.trim())) {
      if (!/^[a-z_]+$/.test(column)) continue;
      if (!table.columns.has(column)) {
        failures.order.push({ migration: file, reference: `public.${match[1]}.${column}`, kind: 'insert column', detail: 'column is not created by any earlier migration' });
      }
    }
  }
}

/** Tables and RPCs the application calls, plus the columns it names. */
export function collectCodeUsage(root: string): { tables: Set<string>; functions: Set<string>; columns: Map<string, Set<string>>; buckets: Set<string> } {
  const tables = new Set<string>();
  const functions = new Set<string>();
  const columns = new Map<string, Set<string>>();
  const buckets = new Set<string>();

  const walk = (path: string, output: string[]) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', 'build', '.arena'].includes(entry.name)) continue;
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full, output);
      else if (/\.(ts|tsx)$/.test(entry.name)) output.push(full);
    }
  };

  const files: string[] = [];
  for (const relative of CODE_DIRS) {
    const full = join(root, relative);
    try {
      if (relative.endsWith('.ts')) files.push(full);
      else walk(full, files);
    } catch {
      // Directory absent in this checkout: nothing to scan.
    }
  }

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(\w+)\.from\(\s*'([a-z_]+)'\s*\)(\s*\.\s*select\(\s*'([^']*)'\s*\))?/g)) {
      const [, receiver, table, , selectList] = match;
      if (receiver === 'storage') {
        buckets.add(table);
        continue;
      }
      tables.add(table);
      if (selectList && selectList.trim() !== '*') {
        const set = columns.get(table) ?? new Set<string>();
        for (const raw of selectList.split(',')) {
          const entry = raw.trim().split(':').pop()!.trim();
          // `service_catalog(title)` is an embedded resource, not a column.
          if (entry.includes('(') || !/^[a-z_]+$/.test(entry)) continue;
          set.add(entry);
        }
        columns.set(table, set);
      }
    }
    for (const match of source.matchAll(/\.rpc\(\s*'([a-z_]+)'/g)) functions.add(match[1]);
  }

  return { tables, functions, columns, buckets };
}

export function loadMigrations(root: string): MigrationFile[] {
  const directory = join(root, 'supabase', 'migrations');
  return readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(directory, name), 'utf8') }));
}

export function runSchemaAudit(root: string): AuditReport {
  const migrations = loadMigrations(root);
  const state = { tables: new Map<string, TableState>(), functions: new Set<string>() };
  const failures = { hard: [] as HardFailure[], order: [] as HardFailure[] };
  const guardedNotes: string[] = [];
  const deferredWarnings: string[] = [];

  for (const migration of migrations) {
    const cleaned = stripComments(migration.sql);
    // Function bodies resolve later (or, for `language sql`, at creation); take
    // them out of the DDL scan and analyse them in their own pass below.
    const withoutBodies = cleaned.replace(/\bas\s+(\$[a-z_]*\$)[\s\S]*?\1/gi, ' as $body$ $body$');
    const { static: staticSql, dynamic } = blankStrings(withoutBodies);

    // Definitions first: a migration may index, grant on or reference an object
    // it creates in the same file.
    collectDefinitions(staticSql, state);
    for (const [table, entry] of state.tables) {
      if (!entry.created) entry.created = migration.name;
    }
    collectReferences(staticSql, migration.name, failures, state);

    // Dynamic SQL is skipped by the repo's own to_regclass guards; record it so
    // the audit can show what it deliberately did not check.
    for (const statement of dynamic) {
      if (!/\b(alter table|drop policy|create policy|revoke|grant|insert into|drop function)\b/i.test(statement)) continue;
      if (!statement.includes('public.')) continue;
      guardedNotes.push(`${migration.name}: ${statement.trim().slice(0, 120)}`);
    }

    // Function bodies: a plpgsql body is not resolved at creation time, a
    // `language sql` body is. Both are recorded so the report separates
    // "would fail now" from "would fail when called".
    for (const block of migration.sql.matchAll(/\bas\s+(\$[a-z_]*\$)([\s\S]*?)\1/gi)) {
      const body = block[2];
      if (!/\b(from|into|update|join|delete from)\s+public\./i.test(body)) continue;
      const isSql = /language sql/i.test(migration.sql.slice(Math.max(0, block.index - 500), block.index));
      const references = [...body.matchAll(/(?:from|into|update|join|delete from)\s+public\.([a-z_]+)/gi)]
        .map((match) => match[1])
        .filter((table) => !state.tables.has(table));
      for (const table of new Set(references)) {
        deferredWarnings.push(`${migration.name}: public.${table} inside a ${isSql ? 'sql' : 'plpgsql'} body (not resolved at migration time)`);
      }
    }
  }

  const usage = collectCodeUsage(root);
  const missingTables: string[] = [];
  for (const table of usage.tables) {
    if (!state.tables.has(table)) missingTables.push(table);
  }
  const missingFunctions: string[] = [];
  for (const fn of usage.functions) {
    const created = [...state.functions].some((signature) => signature.startsWith(`${fn}(`));
    if (!created) missingFunctions.push(fn);
  }
  const missingColumns: string[] = [];
  for (const [table, wanted] of usage.columns) {
    const entry = state.tables.get(table);
    if (!entry) continue;
    for (const column of wanted) {
      if (!entry.columns.has(column)) missingColumns.push(`${table}.${column}`);
    }
  }

  const unreferencedBaselineTables = [...state.tables.entries()]
    .filter(([name, entry]) => name !== 'profiles' && !entry.referenced)
    .map(([name]) => name);

  return {
    migrations: migrations.map((migration) => migration.name),
    tablesCreated: new Map([...state.tables].map(([name, entry]) => [name, entry.created])),
    functionsCreated: state.functions,
    codeTables: usage.tables,
    codeFunctions: usage.functions,
    hardFailures: failures.hard,
    missingTables: [...missingTables, ...missingFunctions.map((fn) => `rpc:${fn}`)],
    missingColumns,
    orderFailures: failures.order,
    guardedNotes,
    deferredWarnings,
    unreferencedBaselineTables,
  };
}

export function formatReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`BASE-1 schema audit — ${report.migrations.length} migrations`);
  lines.push(`  tables created by migrations: ${report.tablesCreated.size}`);
  lines.push(`  functions created by migrations: ${report.functionsCreated.size}`);
  lines.push(`  tables used by the application: ${report.codeTables.size}`);
  const section = (title: string, items: string[]) => {
    lines.push(items.length ? `  ${title}: ${items.length}` : `  ${title}: none`);
    for (const item of items) lines.push(`    - ${item}`);
  };
  section('hard failures (a fresh apply stops here)', report.hardFailures.map((failure) => `${failure.migration} → ${failure.kind} ${failure.reference} (${failure.detail})`));
  section('missing objects required by the application', [...report.missingTables, ...report.missingColumns]);
  section('ordering failures (referenced before creation)', report.orderFailures.map((failure) => `${failure.migration} → ${failure.kind} ${failure.reference}`));
  section('deferred (runtime) references', report.deferredWarnings);
  section('guarded dynamic SQL, not checked', report.guardedNotes);
  return lines.join('\n');
}

const isDirectRun = process.argv[1]?.endsWith('schema-audit.ts') || process.argv[1]?.endsWith('schema-audit.js');
if (isDirectRun) {
  const report = runSchemaAudit(process.cwd());
  console.log(formatReport(report));
  const fatal = report.hardFailures.length + report.missingTables.length + report.missingColumns.length + report.orderFailures.length;
  if (fatal > 0) {
    console.error(`\nBASE-1 audit: ${fatal} blocking finding(s).`);
    process.exit(1);
  }
  console.log('\nBASE-1 audit: no blocking findings.');
}
