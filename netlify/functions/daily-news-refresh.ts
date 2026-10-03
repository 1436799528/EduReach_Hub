/**
 * Scheduled EduReach maintenance and newsroom refresh (@daily).
 *
 * The published daily job is the single production scheduler. It refreshes the
 * newsroom and also runs the database maintenance that must not be left to a
 * developer's laptop: analytics retention, opportunity expiry and operational-log
 * retention. Each maintenance task records its own outcome in scheduled_job_runs.
 */

import { createClient } from '@supabase/supabase-js';
import { runNewsroomRefresh, summarizeRun } from '../../src/server/newsroom/run';
import { recordJobRun } from '../../src/server/jobRuns';
import type { RunEnvironment } from '../../src/server/newsroom/run';

type NetlifyEnv = { get(name: string): string | undefined };
type NetlifyGlobal = { env: NetlifyEnv };
const netlify = (globalThis as typeof globalThis & { Netlify?: NetlifyGlobal }).Netlify;

/** Deployed environment takes precedence over any local .env values. */
function runtimeEnv(): RunEnvironment {
  const env: RunEnvironment = { ...(process.env as RunEnvironment) };
  if (netlify?.env) {
    for (const name of [
      'VITE_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SECRET_KEY',
      'EDUREACH_NEWSROOM_USER_AGENT',
    ]) {
      const value = netlify.env.get(name);
      if (value) env[name] = value;
    }
  }
  return env;
}

async function runMaintenance(env: RunEnvironment): Promise<void> {
  const supabase = createClient(
    env.VITE_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const jobs = [
    {
      name: 'analytics-retention',
      run: async () => {
        const { data, error } = await supabase.rpc('prune_site_analytics_events', { p_retention_days: 90 });
        if (error) throw error;
        return { deleted: Number(data?.deleted ?? 0), retentionDays: Number(data?.retentionDays ?? 90) };
      },
    },
    {
      name: 'opportunity-expiry',
      run: async () => {
        const { data, error } = await supabase.rpc('close_expired_opportunities');
        if (error) throw error;
        return { closed: Number(data ?? 0) };
      },
    },
    {
      name: 'scheduled-job-prune',
      run: async () => {
        const { data, error } = await supabase.rpc('prune_scheduled_job_runs', { p_retention_days: 180 });
        if (error) throw error;
        return { deleted: Number(data?.deleted ?? 0), retentionDays: Number(data?.retentionDays ?? 180) };
      },
    },
  ];

  await Promise.all(jobs.map(async ({ name, run }) => {
    const startedAt = new Date();
    try {
      const detail = await run();
      await recordJobRun(supabase, name, { status: 'succeeded', startedAt, detail });
      console.log(`EduReach daily maintenance [${name}]: succeeded`, detail);
    } catch (error) {
      await recordJobRun(supabase, name, { status: 'failed', startedAt, error });
      console.error(`EduReach daily maintenance [${name}] failed:`, error);
    }
  }));
}

export default async () => {
  const env = runtimeEnv();
  await Promise.allSettled([
    (async () => {
      try {
        const report = await runNewsroomRefresh({ env, triggeredBy: 'schedule' });
        console.log(`EduReach daily newsroom refresh [${report.runId ?? 'dry-run'}]: ${summarizeRun(report)}`);
        for (const source of report.perSource.filter((entry) => entry.status === 'failed')) {
          console.warn(`EduReach source failed: ${source.sourceKey} — ${source.error}`);
        }
      } catch (error) {
        console.error('EduReach daily newsroom refresh failed:', error);
      }
    })(),
    runMaintenance(env),
  ]);
};

export const config = {
  schedule: '@daily',
};
