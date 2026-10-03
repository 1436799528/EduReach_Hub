/**
 * CRIT-1 — the backup/restore rehearsal.
 *
 * The audit's first critical finding was that no backup, restore or rollback
 * procedure existed anywhere in the repository. Part of resolving that is being
 * able to *prove* a restore works rather than asserting it does. This script is
 * that proof, as far as it can honestly go here:
 *
 *   1. build the production schema from the committed migrations;
 *   2. write representative rows into the tables the product depends on;
 *   3. take a physical backup of the running database (`dumpDataDir`);
 *   4. restore that artifact into a **fresh, empty** database;
 *   5. prove the restored database is the same database: identical schema
 *      fingerprint, identical row counts, and the same row-level security
 *      behaviour when queried as `anon`.
 *
 * It runs on the real PostgreSQL engine (PGlite is PostgreSQL 18), which is why
 * it is worth something: a dump that does not load, or loads without its
 * policies, fails here.
 *
 * **What it does not prove, and must never be described as proving:** that a
 * Supabase *production* backup restores. Supabase's own backups, point-in-time
 * recovery windows, storage objects and the auth schema are platform features
 * this sandbox has no credentials for. `docs/operations/BACKUP_AND_RESTORE.md`
 * records that gap and the manual rehearsal that closes it.
 *
 *   npm run backup:rehearsal           # human-readable
 *   npm run backup:rehearsal -- --json # machine-readable
 */
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from './replay';

export type RehearsalStep = {
  name: string;
  state: 'pass' | 'fail';
  detail: string;
};

export type RehearsalReport = {
  steps: RehearsalStep[];
  passed: boolean;
  backupBytes: number;
  migrations: number;
};

/** Tables seeded before the backup, and what each row proves survived. */
const SEED: Array<{ table: string; sql: string }> = [
  {
    // The platform's own identity table comes first: `profiles.id` references
    // `auth.users`, exactly as it does in production.
    table: 'auth.users',
    sql: `insert into auth.users (id, email, raw_user_meta_data)
          values ('11111111-1111-4111-8111-111111111111', 'rehearsal@example.test', jsonb_build_object('first_name', 'Rehearsal'))`,
  },
  {
    // The `handle_new_user` trigger creates this row from the identity insert
    // above, so this is an update rather than an insert — which also proves the
    // trigger ran and that its output is part of what gets backed up.
    table: 'profiles',
    sql: `update public.profiles
          set full_name = 'Rehearsal Student', school = 'University of Lagos', course_programme = 'Computer Science'
          where id = '11111111-1111-4111-8111-111111111111'`,
  },
  {
    table: 'service_catalog',
    sql: `insert into public.service_catalog (service_key, title, description, active)
          values ('rehearsal-service', 'Rehearsal service', 'Seeded by the backup rehearsal.', true)`,
  },
  {
    table: 'news_articles',
    sql: `insert into public.news_articles (slug, title, excerpt, body, category, published, verification_status, last_verified_at)
          values ('rehearsal-article', 'Rehearsal article', 'Excerpt', 'Body', 'Scholarships & Funding', true, 'verified', now())`,
  },
  {
    table: 'opportunities',
    sql: `insert into public.opportunities (title, organisation, category, description, deadline, is_active)
          values ('Rehearsal grant', 'Rehearsal Foundation', 'grant', 'Seeded by the backup rehearsal.', null, true)`,
  },
  {
    table: 'past_question_resources',
    sql: `insert into public.past_question_resources (exam_body, subject, title, source_url, paper_year, published, verified_at)
          values ('JAMB', 'Physics', 'Physics 2024', 'https://example.test/physics-2024.pdf', 2024, true, now())`,
  },
  {
    table: 'cbt_exams',
    sql: `insert into public.cbt_exams (exam_body, title, subject, duration_minutes, is_active)
          values ('JAMB', 'Rehearsal bank', 'Physics', 120, true)`,
  },
];

/**
 * A schema fingerprint: tables, columns and RLS policies. Two databases with
 * the same fingerprint have the same schema *including* its security posture —
 * which is the part a naive "did the rows come back?" check misses.
 */
export async function schemaFingerprint(db: PGlite) {
  const tables = await db.query<{ n: string }>(
    `select count(*)::text as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  const columns = await db.query<{ n: string }>(
    `select count(*)::text as n from information_schema.columns where table_schema = 'public'`,
  );
  const policies = await db.query<{ n: string }>(
    `select count(*)::text as n from pg_policies where schemaname = 'public'`,
  );
  const rls = await db.query<{ n: string }>(
    `select count(*)::text as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity`,
  );
  return {
    tables: Number(tables.rows[0].n),
    columns: Number(columns.rows[0].n),
    policies: Number(policies.rows[0].n),
    rlsTables: Number(rls.rows[0].n),
  };
}

async function rowCounts(db: PGlite) {
  const counts: Record<string, number> = {};
  for (const { table } of SEED) {
    // `auth.users` is a platform table, not a public one.
    const qualified = table.includes('.') ? table : `public.${table}`;
    const { rows } = await db.query<{ n: string }>(`select count(*)::text as n from ${qualified}`);
    counts[table] = Number(rows[0].n);
  }
  return counts;
}

export async function runBackupRehearsal(): Promise<RehearsalReport> {
  const steps: RehearsalStep[] = [];
  const record = (name: string, ok: boolean, detail: string) => {
    steps.push({ name, state: ok ? 'pass' : 'fail', detail });
    return ok;
  };

  // 1. The production schema, from the committed migrations only.
  const source = new PGlite();
  const migrations = await applyMigrations(source);
  record('schema built from committed migrations', migrations.length > 0, `${migrations.length} migrations applied`);

  // 2. Represent the data the product cannot lose.
  for (const { sql } of SEED) await source.exec(sql);
  const sourceCounts = await rowCounts(source);
  const sourceFingerprint = await schemaFingerprint(source);
  record(
    'representative rows written',
    Object.values(sourceCounts).every((count) => count > 0),
    Object.entries(sourceCounts).map(([table, count]) => `${table}=${count}`).join(' '),
  );

  // Capture what RLS decides before the backup, so the restored copy can be
  // held to the same answer. The seeded paper is published *and* verified, so
  // anon must see exactly one row.
  await source.exec('set role anon');
  const anonBefore = await source.query<{ n: string }>('select count(*)::text as n from public.past_question_resources');
  await source.exec('reset role');

  // 3. The backup itself.
  const artifact = await source.dumpDataDir('gzip');
  const bytes = new Uint8Array(await artifact.arrayBuffer());
  record('backup taken', bytes.byteLength > 0, `${(bytes.byteLength / 1024).toFixed(1)} KB gzip archive`);
  await source.close();

  // 4. Restore into a fresh database. Nothing is carried over in memory.
  const restored = await PGlite.create({ loadDataDir: new Blob([bytes]) });
  try {
    const restoredCounts = await rowCounts(restored);
    const sameCounts = JSON.stringify(restoredCounts) === JSON.stringify(sourceCounts);
    record(
      'every seeded row is present after restore',
      sameCounts,
      sameCounts ? JSON.stringify(restoredCounts) : `before ${JSON.stringify(sourceCounts)} after ${JSON.stringify(restoredCounts)}`,
    );

    // 5. Same schema *and* same security posture.
    const restoredFingerprint = await schemaFingerprint(restored);
    const sameSchema = JSON.stringify(restoredFingerprint) === JSON.stringify(sourceFingerprint);
    record(
      'schema fingerprint matches, including policies and RLS',
      sameSchema,
      sameSchema
        ? `${restoredFingerprint.tables} tables, ${restoredFingerprint.columns} columns, ${restoredFingerprint.policies} policies, ${restoredFingerprint.rlsTables} with RLS`
        : `before ${JSON.stringify(sourceFingerprint)} after ${JSON.stringify(restoredFingerprint)}`,
    );

    // 6. The restored database still enforces its own access rules. A backup
    //    that restores the rows but not the policies is a breach waiting to
    //    happen, and a row-count check alone would call it a success.
    await restored.exec('set role anon');
    const anonAfter = await restored.query<{ n: string }>('select count(*)::text as n from public.past_question_resources');
    await restored.exec('reset role');
    const sameVisibility = anonAfter.rows[0].n === anonBefore.rows[0].n;
    record(
      'row-level security behaves identically after restore',
      sameVisibility,
      `anon sees ${anonAfter.rows[0].n} verified paper(s), before ${anonBefore.rows[0].n}`,
    );

    // And the derived-column contract still holds on the restored copy.
    const slug = await restored.query<{ slug: string }>(
      `select public.news_category_slug('Scholarships & Funding') as slug`,
    );
    record('database functions survive the restore', slug.rows[0].slug === 'scholarships', `news_category_slug(...) = ${slug.rows[0].slug}`);
  } finally {
    await restored.close();
  }

  return {
    steps,
    passed: steps.every((step) => step.state === 'pass'),
    backupBytes: bytes.byteLength,
    migrations: migrations.length,
  };
}

async function main() {
  const asJson = process.argv.includes('--json');
  const report = await runBackupRehearsal();
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const step of report.steps) {
      console.log(`${step.state === 'pass' ? 'ok  ' : 'FAIL'} ${step.name}\n     ↳ ${step.detail}`);
    }
    console.log(
      report.passed
        ? `\nBackup rehearsal passed: ${report.migrations} migrations, ${(report.backupBytes / 1024).toFixed(1)} KB archive, restored and verified.\nThis rehearses the application schema and data path. It does not rehearse a Supabase production backup — see docs/operations/BACKUP_AND_RESTORE.md.`
        : '\nBackup rehearsal FAILED. A restore that does not reproduce this database is not a restore.',
    );
  }
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith('backup-rehearsal.ts')) void main();
