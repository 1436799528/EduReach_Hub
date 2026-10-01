/**
 * Environment-bound entry point for the newsroom pipeline.
 *
 * Used by three callers so they always behave identically:
 *   - netlify/functions/daily-news-refresh.ts (scheduled @daily)
 *   - POST /api/admin/newsroom/ingest (manual run from the admin console)
 *   - scripts/newsroom.ts (local CLI, including --dry-run and --check-sources)
 */

import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseKey } from '../../../lib/supabase-config';
import { runIngestion, type IngestOptions, type IngestReport, type NewsroomSupabase } from './pipeline';
import { recordJobRun } from '../jobRuns';

export interface RunEnvironment {
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  EDUREACH_NEWSROOM_USER_AGENT?: string;
  [key: string]: string | undefined;
}

export function createNewsroomClient(env: RunEnvironment = process.env as RunEnvironment): NewsroomSupabase {
  const url = env.VITE_SUPABASE_URL;
  const key = getServerSupabaseKey(env as NodeJS.ProcessEnv);
  if (!url || !key) {
    throw new Error('Newsroom ingestion requires VITE_SUPABASE_URL and a server Supabase secret key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY).');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as NewsroomSupabase;
}

export async function runNewsroomRefresh(
  options: IngestOptions & { env?: RunEnvironment } = {},
): Promise<IngestReport> {
  const { env, ...ingestOptions } = options;
  const supabase = createNewsroomClient(env);
  const startedAt = new Date();
  try {
    const report = await runIngestion(supabase, {
      userAgent: env?.EDUREACH_NEWSROOM_USER_AGENT,
      triggeredBy: options.triggeredBy ?? 'schedule',
      ...ingestOptions,
    });
    // OBS-1: a partial run (some sources failed) is recorded as `partial`, not
    // `succeeded`, so "the job ran" and "the job fully worked" stay distinguishable.
    // Best effort — a telemetry failure must not turn a good refresh into a bad one.
    await recordJobRun(supabase, 'newsroom-refresh', {
      status: report.errors.length ? 'partial' : 'succeeded',
      startedAt,
      detail: {
        sourcesChecked: report.sourcesChecked,
        sourcesFailed: report.sourcesFailed,
        candidatesFound: report.candidatesFound,
        duplicates: report.duplicates,
        rejected: report.rejected,
        needsReview: report.needsReview,
        published: report.published,
        expired: report.expired,
        errors: report.errors.length,
        dryRun: Boolean(report.dryRun),
      },
    });
    return report;
  } catch (error) {
    await recordJobRun(supabase, 'newsroom-refresh', { status: 'failed', startedAt, error });
    throw error;
  }
}

/** One-line summary used by logs and the daily report. */
export function summarizeRun(report: IngestReport): string {
  return [
    `sources ${report.sourcesChecked - report.sourcesFailed}/${report.sourcesChecked}`,
    `candidates ${report.candidatesFound}`,
    `duplicates ${report.duplicates}`,
    `rejected ${report.rejected}`,
    `review ${report.needsReview}`,
    `published ${report.published}`,
    `images ${report.imagesRepaired}`,
    `expired ${report.expired}`,
    report.errors.length ? `errors ${report.errors.length}` : 'errors 0',
  ].join(' | ');
}
