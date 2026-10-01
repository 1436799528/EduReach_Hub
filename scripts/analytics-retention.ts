/**
 * AN-1 — analytics retention.
 *
 * Raw product events are kept for the window declared in
 * `src/lib/analyticsTaxonomy.ts` (RETENTION_DAYS) and deleted by
 * `prune_site_analytics_events(p_retention_days)`, which computes the cutoff in
 * SQL so the database's clock decides what is old.
 *
 *   npm run analytics:retention              # dry run: the plan, no credentials, no writes
 *   npm run analytics:retention -- --apply   # delete; needs service-role credentials
 *
 * Nothing schedules this yet: a scheduler is OBS-1's job. Until something calls
 * it, rows older than the window remain in the table, and
 * `docs/features/AN-1.md` says so rather than implying otherwise.
 */
import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseKey } from '../lib/supabase-config';
import { RETENTION_DAYS } from '../src/lib/analyticsTaxonomy';

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
  const { data, error } = await supabase.rpc('prune_site_analytics_events', { p_retention_days: plan.retentionDays });
  if (error) {
    console.error(`  prune failed: ${error.message}`);
    if (/could not find the function|does not exist/i.test(error.message)) {
      console.error('  apply supabase/migrations/20261001120000_analytics_retention.sql first.');
    }
    process.exitCode = 1;
    return;
  }
  const result = readRetentionResult(data);
  if (result.ok === false) {
    console.error(`  ${result.reason}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  deleted ${result.deleted} row(s) older than ${result.cutoff}.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  void main();
}
