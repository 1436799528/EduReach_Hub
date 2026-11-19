/**
 * MONT-1 - the two measurements the guide asks for that the application can
 * answer honestly today: a CBT backlog and ungraded submissions.
 *
 * Guide 8.7 asks for "grading queue growth" and "database connections near the
 * limit". The architecture matters here, because the obvious reading is wrong:
 *
 *  - **There is no grading queue.** `submit_cbt_attempt_configured` (and the v2
 *    finalise RPC) grade inside the submit transaction and write `score` on the
 *    same row. Nothing is enqueued, so "queue depth" would be a fiction.
 *  - **The real backlog is work the system owes.** Two states matter: an attempt
 *    whose own `expires_at` passed more than `stuck_after_minutes` ago and is
 *    still `in_progress` (abandoned tab, auto-submit never reconciled), and a
 *    `submitted` attempt with `score is null` - the latter should be impossible,
 *    so a single row is an integrity failure, not a slow queue.
 *  - **Database connections are not reachable from here.** PostgREST does not
 *    expose `pg_stat_activity`; measuring it needs either a new privileged SQL
 *    function (a schema object, which needs approval) or a Supabase Management
 *    API token (a new secret and a new dependency). The provider already reports
 *    it - see docs/operations/MONITORING.md - so no code was written for it.
 *
 * Both counts are single-row aggregates over `cbt_attempts`, read with the
 * service role, and each is independent: a failed read reports `null` for that
 * number instead of failing the endpoint that carries it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const BACKLOG_LIMITS = {
  /** Only attempts whose deadline passed this long ago are "stuck". */
  stuck_after_minutes: 60,
  /** A few abandoned tabs are normal; this many is a reconciliation problem. */
  stuck_open_warn: 50,
  /** An ungraded submission should be impossible. One is already an incident. */
  ungraded_warn: 1,
} as const;

export type BacklogAlert = 'stuck_attempts' | 'oldest_stuck_attempt' | 'ungraded_attempts';

export interface CbtBacklogCounts {
  stuck_open: number | null;
  oldest_stuck_minutes: number | null;
  ungraded_submitted: number | null;
}

export interface CbtBacklog extends CbtBacklogCounts {
  limits: typeof BACKLOG_LIMITS;
  alerts: BacklogAlert[];
  /** Which reads failed, so a partial answer is never mistaken for a clean one. */
  unavailable: string[];
}

/** Pure decision function, so the thresholds can be tested without a database. */
export function evaluateCbtBacklog(
  counts: CbtBacklogCounts,
  limits: typeof BACKLOG_LIMITS = BACKLOG_LIMITS,
): BacklogAlert[] {
  const alerts: BacklogAlert[] = [];
  if (counts.stuck_open !== null && counts.stuck_open >= limits.stuck_open_warn) alerts.push('stuck_attempts');
  if (counts.oldest_stuck_minutes !== null && counts.oldest_stuck_minutes >= limits.stuck_after_minutes)
    alerts.push('oldest_stuck_attempt');
  if (counts.ungraded_submitted !== null && counts.ungraded_submitted >= limits.ungraded_warn)
    alerts.push('ungraded_attempts');
  return alerts;
}

interface CountQuery {
  count: number | null;
  error: { message?: string } | null;
}

export async function readCbtBacklog(
  client: SupabaseClient,
  options: { now?: Date; limits?: typeof BACKLOG_LIMITS } = {},
): Promise<CbtBacklog> {
  const limits = options.limits ?? BACKLOG_LIMITS;
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - limits.stuck_after_minutes * 60_000).toISOString();
  const unavailable: string[] = [];

  let stuckOpen: number | null = null;
  try {
    const { count, error } = (await client
      .from('cbt_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_progress')
      .lt('expires_at', cutoff)) as CountQuery;
    if (error) throw new Error(error.message ?? 'read failed');
    stuckOpen = count ?? null;
  } catch {
    unavailable.push('stuck_open');
  }

  let oldestStuckMinutes: number | null = null;
  try {
    const { data, error } = await client
      .from('cbt_attempts')
      .select('expires_at')
      .eq('status', 'in_progress')
      .lt('expires_at', cutoff)
      .order('expires_at', { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message ?? 'read failed');
    const oldest = (data as Array<{ expires_at: string | null }> | null)?.[0]?.expires_at;
    if (oldest) oldestStuckMinutes = Math.floor((now.getTime() - new Date(oldest).getTime()) / 60_000);
  } catch {
    unavailable.push('oldest_stuck');
  }

  let ungraded: number | null = null;
  try {
    const { count, error } = (await client
      .from('cbt_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted')
      .is('score', null)) as CountQuery;
    if (error) throw new Error(error.message ?? 'read failed');
    ungraded = count ?? null;
  } catch {
    unavailable.push('ungraded_submitted');
  }

  const counts: CbtBacklogCounts = {
    stuck_open: stuckOpen,
    oldest_stuck_minutes: oldestStuckMinutes,
    ungraded_submitted: ungraded,
  };

  return { ...counts, limits, alerts: evaluateCbtBacklog(counts, limits), unavailable };
}
