/**
 * AN-1 — analytics retention.
 *
 * Raw product events are kept for the window declared in
 * `src/lib/analyticsTaxonomy.ts` (RETENTION_DAYS) and deleted by
 * `prune_site_analytics_events(p_retention_days)`, which computes the cutoff in
 * SQL so the database's clock decides what is old.
 *
 *   npm run analytics:retention              # dry run: counts what is old, deletes nothing
 *   npm run analytics:retention -- --apply   # delete; needs service-role credentials
 *
 * A dry run used to call `prune_site_analytics_events()` — the deleting function
 * — and print its answer as if it had only been a plan. It was caught on a real
 * project where the count happened to be 0, so nothing was lost, but a command
 * that says "nothing will be deleted" and then deletes is the worst kind of
 * wrong. A dry run now issues one read-only `count` query and never reaches a
 * mutating RPC; `tests/analytics-retention.test.ts` fails if that changes.
 *
 * Nothing schedules this yet: a scheduler is OBS-1's job. Until something calls
 * it, rows older than the window remain in the table, and
 * `docs/features/AN-1.md` says so rather than implying otherwise.
 */
// `.env` is loaded here as well as in the server: an operator who follows
// `.env.production.example` and writes the values into `.env` must see them
// used by the validator, not a misleading "NOT SET". No value is ever printed.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseKey } from '../lib/supabase-config';
import { RETENTION_DAYS } from '../src/lib/analyticsTaxonomy';
import { recordJobRun } from '../src/server/jobRuns';

export type RetentionPlan = {
  retentionDays: number;
  cutoff: string;
  apply: boolean;
  dryRun: boolean;
};

/** Pure: what the run intends to do, before anything is contacted. */
export function buildRetentionPlan(now: Date, retentionDays: number, apply: boolean): RetentionPlan {
  const days = Number.isFinite(retentionDays) && retentionDays > 0 ? Math.floor(retentionDays) : RETENTION_DAYS;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  return { retentionDays: days, cutoff, apply, dryRun: !apply };
}

export type RetentionResult =
  | { ok: true; deleted: number; cutoff: string; retentionDays: number }
  | { ok: false; reason: string };

/** Pure: read the RPC's jsonb answer without trusting its shape. */
export function readRetentionResult(data: unknown): RetentionResult {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'the prune function returned nothing' };
  const record = data as Record<string, unknown>;
  const deleted = Number(record.deleted);
  const retentionDays = Number(record.retentionDays ?? RETENTION_DAYS);
  const cutoff = typeof record.cutoff === 'string' ? record.cutoff : '';
  if (!Number.isFinite(deleted) || deleted < 0) return { ok: false, reason: 'the prune function returned no deleted count' };
  return { ok: true, deleted, cutoff, retentionDays };
}

export type RetentionClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => {
    select: (columns: string, options: { count: 'exact'; head: true }) => {
      lt: (column: string, value: string) => PromiseLike<{ count: number | null; error: { message: string } | null }>;
    };
  };
};

export type RetentionExecution =
  | { ok: true; mode: 'dry-run'; wouldDelete: number | null; cutoff: string; retentionDays: number }
  | { ok: true; mode: 'apply'; deleted: number; cutoff: string; retentionDays: number }
  | { ok: false; reason: string };

/**
 * Do exactly what the plan says, and nothing else.
 *
 * A dry run performs one read-only count (`head: true` returns no rows) so the
 * operator can see how much the apply would remove. Only `--apply` reaches the
 * mutating RPC, and only the RPC decides what is old, because it uses the
 * database's clock rather than this machine's.
 */
export async function executeRetention(client: RetentionClient, plan: RetentionPlan): Promise<RetentionExecution> {
  if (plan.dryRun) {
    const { count, error } = await client
      .from('site_analytics_events')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', plan.cutoff);
    if (error) return { ok: false, reason: `the read-only count failed: ${error.message}` };
    return { ok: true, mode: 'dry-run', wouldDelete: typeof count === 'number' ? count : null, cutoff: plan.cutoff, retentionDays: plan.retentionDays };
  }

  const { data, error } = await client.rpc('prune_site_analytics_events', { p_retention_days: plan.retentionDays });
  if (error) {
    const hint = /could not find the function|does not exist/i.test(error.message)
      ? ' apply supabase/migrations/20261001120000_analytics_retention.sql first.'
      : '';
    return { ok: false, reason: `prune failed: ${error.message}${hint}` };
  }
  const result = readRetentionResult(data);
  if (result.ok === false) return { ok: false, reason: result.reason };
  return { ok: true, mode: 'apply', deleted: result.deleted, cutoff: result.cutoff || plan.cutoff, retentionDays: result.retentionDays };
}

export function supabaseUrlForRetention(env: NodeJS.ProcessEnv = process.env): string {
  return (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const plan = buildRetentionPlan(new Date(), RETENTION_DAYS, apply);

  console.log('AN-1 analytics retention');
  console.log(`  window:  ${plan.retentionDays} days (src/lib/analyticsTaxonomy.ts)`);
  console.log(`  cutoff:  ${plan.cutoff}`);
  console.log(`  mode:    ${plan.dryRun ? 'dry run — nothing will be deleted' : 'apply — rows older than the cutoff will be deleted'}`);

  const url = supabaseUrlForRetention();
  const key = getServerSupabaseKey();

  if (plan.dryRun && (!url || !key)) {
    console.log('  no service-role credentials in this environment, so the count is not shown.');
    console.log('  run with credentials, or with --apply, against the deployed project.');
    return;
  }
  if (!url || !key) {
    console.error('  --apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).');
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const startedAt = new Date();
  const outcome = await executeRetention(supabase as unknown as RetentionClient, plan);

  if (outcome.ok === false) {
    console.error(`  ${outcome.reason}`);
    // OBS-1: a failed apply is recorded so the console can see it. Best effort,
    // and only on --apply: a dry run is not a job execution.
    if (apply) await recordJobRun(supabase, 'analytics-retention', { status: 'failed', startedAt, error: outcome.reason });
    process.exitCode = 1;
    return;
  }

  if (outcome.mode === 'dry-run') {
    const counted = outcome.wouldDelete === null ? 'an unknown number of' : `${outcome.wouldDelete}`;
    console.log(`  ${counted} row(s) older than ${outcome.cutoff} would be deleted. Nothing was deleted.`);
    console.log('  this machine computed the cutoff; --apply lets the database decide.');
    return;
  }

  await recordJobRun(supabase, 'analytics-retention', {
    status: 'succeeded',
    startedAt,
    detail: { deleted: outcome.deleted, retentionDays: outcome.retentionDays },
  });
  console.log(`  deleted ${outcome.deleted} row(s) older than ${outcome.cutoff}.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  void main();
}
