/**
 * Scheduled EduReach newsroom refresh (@daily).
 *
 * This used to be an image-repair job that was called "daily news refresh".
 * It is now the scheduled entry point for the full ingestion pipeline:
 * source discovery → fetch → parse → deduplicate → classify → quality gate →
 * publish (Tier 1) or queue for review, followed by image repair and the
 * freshness sweeps. See src/server/newsroom/pipeline.ts and
 * docs/NEWSROOM_PIPELINE.md.
 */

import { runNewsroomRefresh, summarizeRun } from '../../src/server/newsroom/run';
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

export default async () => {
  try {
    const report = await runNewsroomRefresh({ env: runtimeEnv(), triggeredBy: 'schedule' });
    console.log(`EduReach daily newsroom refresh [${report.runId ?? 'dry-run'}]: ${summarizeRun(report)}`);
    for (const source of report.perSource.filter((entry) => entry.status === 'failed')) {
      console.warn(`EduReach source failed: ${source.sourceKey} — ${source.error}`);
    }
  } catch (error) {
    console.error('EduReach daily newsroom refresh failed:', error);
  }
};

export const config = {
  schedule: '@daily',
};
