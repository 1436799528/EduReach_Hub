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

// AN-1 / CBT readiness: both new functions sit behind dynamic SQL or plpgsql
// bodies, which PostgreSQL does not validate when the function is created. A
// replay therefore proves they *apply* but not that they *run*, so these tests
// insert real rows and call them.
test('content_integrity_report() runs and reports CBT subject coverage', async () => {
  await withDatabase(async (db) => {
    await applyMigrations(db);

    // An active bank with a healthy subject and a thin one: total question count
    // looks fine, but a student selecting the thin subject gets a failing paper.
    await db.exec(`
      insert into public.cbt_exams (id, title, exam_body, subject, is_active)
      values ('11111111-1111-4111-8111-111111111111', 'JAMB UTME 2026', 'JAMB', 'General', true);
      insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, position)
      select '11111111-1111-4111-8111-111111111111', 'Use of English', 'q' || n, 'a', 'b', 'c', 'd', 'A', n
        from generate_series(1, 12) as n;
      insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, position)
      select '11111111-1111-4111-8111-111111111111', 'Physics', 'q' || n, 'a', 'b', 'c', 'd', 'A', 100 + n
        from generate_series(1, 2) as n;
    `);

    const { rows } = await db.query<{ report: Record<string, any> }>(
      'select public.content_integrity_report() as report',
    );
    const cbt = rows[0].report.cbt;
    assert.ok(cbt, 'the report has no cbt section');
    assert.equal(cbt.active_exams_without_questions, 0, 'this bank has questions; the old metric must stay quiet');
    assert.equal(cbt.active_exams_with_thin_subjects, 1, 'Physics has 2 questions and must be reported as thin');
    const coverage = cbt.subject_coverage as Array<{ exam_title: string; subject: string; questions: number }>;
    assert.ok(Array.isArray(coverage) && coverage.length === 2, `expected 2 coverage rows, got ${JSON.stringify(coverage)}`);
    const physics = coverage.find((row) => row.subject === 'physics');
    assert.equal(physics?.questions, 2);
  });
});

test('prune_site_analytics_events() deletes only rows older than the window', async () => {
  await withDatabase(async (db) => {
    await applyMigrations(db);

    await db.exec(`
      insert into public.site_analytics_events (event_name, path, session_id, created_at) values
        ('page_view', '/', 'session-old', now() - interval '120 days'),
        ('page_view', '/news', 'session-mid', now() - interval '91 days'),
        ('page_view', '/services', 'session-new', now() - interval '10 days');
    `);

    const { rows } = await db.query<{ result: Record<string, any> }>(
      'select public.prune_site_analytics_events(90) as result',
    );
    assert.equal(rows[0].result.deleted, 2, 'the two rows past the window must go, the recent one must stay');
    assert.equal(rows[0].result.retentionDays, 90);

    const remaining = await db.query<{ session_id: string }>(
      'select session_id from public.site_analytics_events order by created_at',
    );
    assert.deepEqual(remaining.rows.map((row) => row.session_id), ['session-new']);

    // Idempotent: a second run in the same moment deletes nothing new.
    const again = await db.query<{ result: Record<string, any> }>(
      'select public.prune_site_analytics_events(90) as result',
    );
    assert.equal(again.rows[0].result.deleted, 0);
  });
});

test('scheduled_job_status() reports last success, last failure and freshness', async () => {
  await withDatabase(async (db) => {
    await applyMigrations(db);

    await db.exec(`
      insert into public.scheduled_job_runs (job_name, status, started_at, finished_at, error) values
        ('newsroom-refresh', 'succeeded', now() - interval '2 hours', now() - interval '2 hours', null),
        ('newsroom-refresh', 'failed',    now() - interval '26 hours', now() - interval '26 hours', 'fetch timeout'),
        ('analytics-retention', 'succeeded', now() - interval '80 hours', now() - interval '80 hours', null);
    `);

    const { rows } = await db.query<{ status: Record<string, any> }>(
      'select public.scheduled_job_status(48) as status',
    );
    const jobs = rows[0].status.jobs as Array<Record<string, any>>;
    assert.equal(jobs.length, 2, 'both jobs must appear');

    const newsroom = jobs.find((job) => job.job_name === 'newsroom-refresh')!;
    assert.equal(newsroom.runs, 2);
    assert.equal(newsroom.failures, 1);
    assert.equal(newsroom.last_error, 'fetch timeout');
    assert.equal(newsroom.fresh, true, 'a success two hours old is inside the 48-hour window');

    const retention = jobs.find((job) => job.job_name === 'analytics-retention')!;
    assert.equal(retention.fresh, false, 'a success 80 hours old is stale for a daily job');
  });
});

test('prune_scheduled_job_runs() removes only rows past its window', async () => {
  await withDatabase(async (db) => {
    await applyMigrations(db);

    await db.exec(`
      insert into public.scheduled_job_runs (job_name, status, started_at) values
        ('newsroom-refresh', 'succeeded', now() - interval '200 days'),
        ('newsroom-refresh', 'succeeded', now() - interval '30 days');
    `);

    const { rows } = await db.query<{ result: Record<string, any> }>(
      'select public.prune_scheduled_job_runs(180) as result',
    );
    assert.equal(rows[0].result.deleted, 1);
    assert.equal(rows[0].result.retentionDays, 180);

    const remaining = await db.query<{ n: number }>('select count(*)::int as n from public.scheduled_job_runs');
    assert.equal(remaining.rows[0].n, 1, 'the recent run must survive');
  });
});

test('scheduled_job_runs is closed to client roles', async () => {
  await withDatabase(async (db) => {
    await applyMigrations(db);

    // RLS must be on, and no policy may grant a client role anything.
    const { rows } = await db.query<{ rls: boolean; policies: number }>(`
      select c.relrowsecurity as rls,
             (select count(*)::int from pg_policies p
               where p.schemaname = 'public' and p.tablename = 'scheduled_job_runs') as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'scheduled_job_runs'
    `);
    assert.equal(rows[0].rls, true, 'RLS must be enabled');
    assert.equal(rows[0].policies, 1, 'only the deny-client policy should exist');

    const grants = await db.query<{ rolname: string }>(`
      select distinct g.rolname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
        join pg_roles g on g.oid = a.grantee
       where n.nspname = 'public' and c.relname = 'scheduled_job_runs'
         and g.rolname in ('anon', 'authenticated')
    `);
    assert.deepEqual(grants.rows, [], 'no client role may hold a grant on the job log');
  });
});
