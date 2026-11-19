import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BACKLOG_LIMITS, evaluateCbtBacklog, readCbtBacklog } from '../src/server/operations';

/**
 * Guide 8.7 asks for "grading queue growth". There is no grading queue - the
 * submit RPC grades inside the transaction - so these tests pin the two states
 * that a queue would have surfaced: attempts the system should have closed, and
 * submitted attempts with no score, which should be impossible.
 */

type Response = { count?: number | null; data?: unknown; error?: { message?: string } | null };

/** Minimal PostgREST chain whose `await` consumes the next canned response. */
function stubClient(responses: Response[]): SupabaseClient {
  let index = 0;
  const next = (): Response => {
    const response = responses[index];
    index += 1;
    if (!response) throw new Error(`unexpected query ${index}`);
    return response;
  };
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'lt', 'is', 'order', 'limit']) chain[method] = () => chain;
  chain.then = (resolve: (value: Response) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(next()).then(resolve, reject);
  return { from: () => chain } as unknown as SupabaseClient;
}

const healthy: Response[] = [{ count: 3 }, { data: [] }, { count: 0 }];

test('a healthy backlog reports no alerts and no unavailable reads', async () => {
  const backlog = await readCbtBacklog(stubClient(healthy));
  assert.deepEqual(backlog.alerts, []);
  assert.deepEqual(backlog.unavailable, []);
  assert.equal(backlog.stuck_open, 3);
  assert.equal(backlog.ungraded_submitted, 0);
  assert.equal(backlog.oldest_stuck_minutes, null);
  assert.equal(backlog.limits.stuck_open_warn, BACKLOG_LIMITS.stuck_open_warn);
});

test('stuck attempts and an old one are reported separately', async () => {
  const now = new Date('2026-11-19T12:00:00.000Z');
  const backlog = await readCbtBacklog(
    stubClient([{ count: 60 }, { data: [{ expires_at: '2026-11-19T08:00:00.000Z' }] }, { count: 0 }]),
    { now },
  );
  assert.equal(backlog.stuck_open, 60);
  assert.equal(backlog.oldest_stuck_minutes, 240);
  assert.deepEqual(backlog.alerts, ['stuck_attempts', 'oldest_stuck_attempt']);
});

test('one ungraded submission is already an incident', async () => {
  const backlog = await readCbtBacklog(stubClient([{ count: 0 }, { data: [] }, { count: 1 }]));
  assert.deepEqual(backlog.alerts, ['ungraded_attempts']);
});

test('a failed read is reported as unavailable instead of failing the caller', async () => {
  const backlog = await readCbtBacklog(
    stubClient([{ count: null, error: { message: 'permission denied' } }, { data: [] }, { count: 0 }]),
  );
  assert.equal(backlog.stuck_open, null);
  assert.deepEqual(backlog.unavailable, ['stuck_open']);
  assert.deepEqual(backlog.alerts, [], 'an unknown count must not be reported as a violation');
});

test('the thresholds are the documented ones and nothing is alerted on a healthy system', () => {
  assert.deepEqual(evaluateCbtBacklog({ stuck_open: 49, oldest_stuck_minutes: 59, ungraded_submitted: 0 }), []);
  assert.deepEqual(evaluateCbtBacklog({ stuck_open: 50, oldest_stuck_minutes: null, ungraded_submitted: 0 }), [
    'stuck_attempts',
  ]);
  assert.deepEqual(evaluateCbtBacklog({ stuck_open: null, oldest_stuck_minutes: null, ungraded_submitted: null }), []);
});
