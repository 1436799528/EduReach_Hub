/**
 * OBS-1 — scheduled job run recording.
 *
 * A scheduled job that fails silently is worse than no job: the site keeps looking
 * healthy while news stops arriving or analytics stop being pruned. This module is
 * the smallest thing that makes a failure visible — one row per run in
 * `scheduled_job_runs`, read back by `scheduled_job_status()` and the admin console.
 *
 * Design rules, all deliberate:
 *
 *  - **Recording a run can never fail the job.** A telemetry write that throws would
 *    turn a successful newsroom refresh into a failed one. Every function here is
 *    best-effort and returns a boolean instead of throwing.
 *  - **The detail is operator-safe by construction.** `sanitizeDetail` keeps numbers,
 *    booleans and short strings and drops anything else, so a job cannot accidentally
 *    write a credential, a token or a student's data into an operational log.
 *  - **A job that never records is still visible.** `scheduled_job_status()` reports
 *    `fresh: false` for a job whose last success is older than the window, and a job
 *    with no rows at all is absent from the list — both are signals, not silence.
 */

export type JobStatus = 'succeeded' | 'partial' | 'failed';

/** Jobs that are expected to run on the daily schedule. */
export const KNOWN_JOBS = [
  'newsroom-refresh',
  'analytics-retention',
  'opportunity-expiry',
  'scheduled-job-prune',
] as const;
export type KnownJob = (typeof KNOWN_JOBS)[number];

/** How recently a daily job must have succeeded to count as healthy. */
export const STALE_AFTER_HOURS = 48;

const MAX_DETAIL_STRING = 200;
const MAX_DETAIL_KEYS = 20;

/**
 * Keep a job's detail payload safe to show an operator: scalars only, short strings
 * only, a bounded number of keys. Nested objects and arrays are dropped rather than
 * flattened, because flattening is how a secret ends up in a log.
 */
export function sanitizeDetail(detail: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (Object.keys(out).length >= MAX_DETAIL_KEYS) break;
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === 'boolean') {
      out[key] = value;
    } else if (typeof value === 'string') {
      const trimmed = value.trim().slice(0, MAX_DETAIL_STRING);
      if (trimmed) out[key] = trimmed;
    }
  }
  return out;
}

/** Trim an error to something an operator can act on, without a stack trace. */
export function sanitizeError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const trimmed = message.trim().slice(0, 500);
  return trimmed || null;
}

interface MinimalClient {
  from(table: string): any;
}

export interface RunOutcome {
  status: JobStatus;
  startedAt: Date;
  detail?: Record<string, unknown>;
  error?: unknown;
}

export async function recordJobRun(
  supabase: MinimalClient,
  jobName: string,
  outcome: RunOutcome,
): Promise<boolean> {
  const finishedAt = new Date();
  const durationMs = Math.max(0, finishedAt.getTime() - outcome.startedAt.getTime());
  try {
    const { error } = await supabase.from('scheduled_job_runs').insert({
      job_name: jobName.slice(0, 60),
      status: outcome.status,
      started_at: outcome.startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs,
      detail: sanitizeDetail(outcome.detail),
      error: sanitizeError(outcome.error),
    });
    return !error;
  } catch {
    return false;
  }
}

export async function runRecorded<T>(
  supabase: MinimalClient,
  jobName: string,
  job: () => Promise<{ result: T; status?: JobStatus; detail?: Record<string, unknown> }>,
): Promise<T> {
  const startedAt = new Date();
  try {
    const { result, status, detail } = await job();
    await recordJobRun(supabase, jobName, { status: status ?? 'succeeded', startedAt, detail });
    return result;
  } catch (error) {
    await recordJobRun(supabase, jobName, { status: 'failed', startedAt, error });
    throw error;
  }
}

export function evaluateJobHealth(
  status: { sinceHours: number; jobs: Array<Record<string, any>> } | null | undefined,
  expected: readonly string[] = KNOWN_JOBS,
): { ok: boolean; missing: string[]; stale: string[]; failing: string[] } {
  const jobs = status?.jobs ?? [];
  const byName = new Map(jobs.map((job) => [String(job.job_name), job]));

  const missing = expected.filter((name) => !byName.has(name));
  const stale = expected
    .filter((name) => byName.has(name) && byName.get(name).fresh === false)
    .map((name) => name);
  const failing = expected
    .filter((name) => {
      const job = byName.get(name);
      return job && job.last_failure_at && (!job.last_success_at || job.last_failure_at > job.last_success_at);
    })
    .map((name) => name);

  return { ok: missing.length === 0 && stale.length === 0 && failing.length === 0, missing, stale, failing };
}
