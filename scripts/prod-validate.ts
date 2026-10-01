/**
 * D5 — production environment validation.
 *
 *   npm run prod:validate              # env contract + every live check that works
 *   npm run prod:validate -- --json    # machine-readable, for a deploy gate
 *
 * What this can and cannot do is a hard platform fact, not a shortcut: a
 * service-role Supabase client speaks PostgREST, and PostgREST cannot run
 * `information_schema` or `pg_catalog` queries. So the checks split in two.
 *
 * **This script performs (live, read-only):**
 *   - the environment-variable contract, with no value ever printed;
 *   - Supabase connectivity under the service key;
 *   - storage buckets: existence, and that none the app treats as private is public;
 *   - `content_integrity_report()`, which returns the database's own data-quality
 *     report — including the CBT subject coverage behind the "not ready yet" error;
 *   - reachability of the tables the application reads.
 *
 * **Needs a real SQL connection, so it is a committed artifact instead:**
 *   `supabase/ci/production-validation.sql` — RLS enablement, policy counts,
 *   function grants to client roles, migration history. Run it in the Supabase SQL
 *   editor or psql; it prints `pass`/`fail` per check and is strictly read-only.
 *   This script points at it rather than pretending to run it.
 *
 * Two invariants: no secret is ever printed, and **unreachable is never reported as
 * passing** — a check that could not run is `skipped`, with the reason, and the exit
 * code distinguishes "failed" from "not yet verified".
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseKey } from '../lib/supabase-config';
import { describeEnv, evaluateEnv } from '../src/lib/envContract';

export const SQL_ARTIFACT = 'supabase/ci/production-validation.sql';

export type CheckState = 'pass' | 'fail' | 'skipped';

export interface ValidationCheck {
  group: string;
  name: string;
  state: CheckState;
  detail?: string;
}

/** Objects the application calls and would break without. */
export const EXPECTED_FUNCTIONS = [
  'handle_new_user',
  'admin_audit_log',
  'admin_dashboard_metrics',
  'admin_activity_breakdown',
  'admin_bootstrap_first_admin',
  'check_rate_limit',
  'close_expired_opportunities',
  'content_integrity_report',
  'expire_stale_news',
  'get_cbt_questions',
  'get_cbt_questions_for_subjects',
  'get_cbt_result',
  'get_public_service_request',
  'is_staff',
  'is_staff_user',
  'prune_site_analytics_events',
  'set_service_reference_code',
  'start_cbt_attempt_for_subjects',
];

/** Buckets the application writes to. None may be public. */
export const EXPECTED_BUCKETS = ['admin-content', 'resource-files', 'campus-uploads'];

/** Tables the browser or the server reads directly. */
export const PROBED_TABLES = [
  'profiles',
  'service_catalog',
  'service_requests',
  'cbt_exams',
  'exam_questions',
  'news_articles',
  'opportunities',
  'institutions',
  'student_notifications',
  'site_analytics_events',
];

/**
 * Storage validation. A bucket the application treats as private must not be public —
 * that is a data-exposure bug no policy can paper over.
 */
export function checkBuckets(
  buckets: Array<{ name: string; public: boolean }> | null | undefined,
): ValidationCheck[] {
  const list = buckets ?? [];
  const names = new Set(list.map((bucket) => bucket.name));
  const missing = EXPECTED_BUCKETS.filter((bucket) => !names.has(bucket));
  const wronglyPublic = list
    .filter((bucket) => EXPECTED_BUCKETS.includes(bucket.name) && bucket.public)
    .map((bucket) => bucket.name);
  return [
    {
      group: 'storage',
      name: 'every bucket the application writes to exists',
      state: missing.length ? 'fail' : 'pass',
      detail: missing.length ? `missing: ${missing.join(', ')}` : EXPECTED_BUCKETS.join(', '),
    },
    {
      group: 'storage',
      name: 'no application bucket is publicly readable',
      state: wronglyPublic.length ? 'fail' : 'pass',
      detail: wronglyPublic.length ? `public but must not be: ${wronglyPublic.join(', ')}` : 'all private',
    },
  ];
}

/** Turn the database's own integrity report into pass/fail checks. */
export function checkIntegrityReport(report: Record<string, any> | null | undefined): ValidationCheck[] {
  if (!report) {
    return [{ group: 'data', name: 'content_integrity_report() returned a report', state: 'fail', detail: 'no report' }];
  }
  const cbt = report.cbt ?? {};
  const news = report.news ?? {};
  const opportunities = report.opportunities ?? {};
  const checks: ValidationCheck[] = [
    {
      group: 'data',
      name: 'no active CBT bank is empty',
      state: Number(cbt.active_exams_without_questions ?? 0) > 0 ? 'fail' : 'pass',
      detail: `${cbt.active_exams_without_questions ?? 0} active exam(s) with no questions`,
    },
    {
      group: 'data',
      name: 'no active CBT bank has a thinly covered subject',
      state: Number(cbt.active_exams_with_thin_subjects ?? 0) > 0 ? 'fail' : 'pass',
      detail:
        Number(cbt.active_exams_with_thin_subjects ?? 0) > 0
          ? `${cbt.active_exams_with_thin_subjects} exam(s) hold a subject with fewer than 5 questions — see subject_coverage in the report`
          : 'every subject has at least 5 questions',
    },
    {
      group: 'data',
      name: 'no question is missing an answer option',
      state: Number(cbt.questions_missing_options ?? 0) > 0 ? 'fail' : 'pass',
      detail: `${cbt.questions_missing_options ?? 0} question(s) missing option A or B`,
    },
    {
      group: 'data',
      name: 'no question has an invalid correct answer',
      state: Number(cbt.questions_with_invalid_answer ?? 0) > 0 ? 'fail' : 'pass',
      detail: `${cbt.questions_with_invalid_answer ?? 0} question(s) with a null or non-A/B/C/D answer`,
    },
    {
      group: 'data',
      name: 'no active opportunity is past its deadline',
      state: Number(opportunities.active_expired ?? 0) > 0 ? 'fail' : 'pass',
      detail: `${opportunities.active_expired ?? 0} active but expired`,
    },
    {
      group: 'data',
      name: 'no published news article is stale',
      state: Number(news.expired_still_published ?? 0) > 0 ? 'fail' : 'pass',
      detail: `${news.expired_still_published ?? 0} expired but still published`,
    },
  ];
  return checks;
}

export function summarise(checks: ValidationCheck[]): string {
  const counts = { pass: 0, fail: 0, skipped: 0 };
  for (const check of checks) counts[check.state] += 1;
  const lines = checks.map((check) => {
    const mark = check.state === 'pass' ? 'ok  ' : check.state === 'fail' ? 'FAIL' : 'skip';
    return `${mark} [${check.group.padEnd(11)}] ${check.name}${check.detail ? ` — ${check.detail}` : ''}`;
  });
  lines.push('', `${counts.pass} passed, ${counts.fail} failed, ${counts.skipped} skipped.`);
  return lines.join('\n');
}

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');
  const read = (name: string) => process.env[name];
  const env = evaluateEnv(read);

  const checks: ValidationCheck[] = [
    {
      group: 'environment',
      name: 'every required environment variable is set',
      state: env.ok ? 'pass' : 'fail',
      detail: env.missingRequired.length ? `missing: ${env.missingRequired.join(', ')}` : 'all present',
    },
    {
      group: 'environment',
      name: 'recommended environment variables are set',
      state: env.missingRecommended.length ? 'skipped' : 'pass',
      detail: env.missingRecommended.length ? `not set: ${env.missingRecommended.join(', ')}` : 'all present',
    },
  ];

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = getServerSupabaseKey();

  if (!url || !key) {
    checks.push({
      group: 'connectivity',
      name: 'live validation against the Supabase project',
      state: 'skipped',
      detail: 'no SUPABASE_URL/VITE_SUPABASE_URL and no service-role key in this environment',
    });
  } else {
    const supabase: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

    // Connectivity: a real read through the service key.
    const probe = await supabase.from('profiles').select('id').limit(1);
    checks.push({
      group: 'connectivity',
      name: 'the project accepts the service-role key',
      state: probe.error ? 'fail' : 'pass',
      detail: probe.error ? probe.error.message : 'service-role read succeeded',
    });

    if (!probe.error) {
      for (const table of PROBED_TABLES) {
        const result = await supabase.from(table).select('*', { count: 'exact', head: true });
        checks.push({
          group: 'reachability',
          name: `${table} is readable`,
          state: result.error ? 'fail' : 'pass',
          detail: result.error ? result.error.message : `${result.count ?? 0} row(s)`,
        });
      }

      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      if (bucketError) {
        checks.push({ group: 'storage', name: 'storage is readable', state: 'fail', detail: bucketError.message });
      } else {
        checks.push(...checkBuckets(buckets as Array<{ name: string; public: boolean }>));
      }

      const { data: report, error: reportError } = await supabase.rpc('content_integrity_report');
      if (reportError) {
        checks.push({
          group: 'data',
          name: 'content_integrity_report() is callable',
          state: 'fail',
          detail: reportError.message,
        });
      } else {
        checks.push(...checkIntegrityReport(report as Record<string, any>));
      }
    }
  }

  if (!asJson) {
    console.log('D5 production environment validation\n');
    console.log('Environment variables (values are never printed):');
    for (const line of describeEnv(read)) console.log(`  ${line}`);
    console.log(`\n${summarise(checks)}`);
    console.log(
      `\nThe following checks need a real SQL connection (PostgREST cannot query\n` +
        `information_schema). Run this read-only script in the Supabase SQL editor:\n\n` +
        `  ${SQL_ARTIFACT}\n\n` +
        `It covers RLS enablement, policy counts, function grants to client roles and\n` +
        `the migration history, and prints pass/fail per check.`,
    );
  } else {
    console.log(JSON.stringify({ checks, sqlArtifact: SQL_ARTIFACT }, null, 2));
  }

  if (checks.some((check) => check.state === 'fail')) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  void main();
}
