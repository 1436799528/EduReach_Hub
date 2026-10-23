import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeRetention, buildRetentionPlan, type RetentionClient, type RetentionPlan } from '../scripts/analytics-retention';

// AN-1: a dry run must not delete anything.
//
// This is a regression test for a real defect: `npm run analytics:retention`
// printed "dry run — nothing will be deleted" and then called
// `prune_site_analytics_events()`, the function that deletes rows. It was found
// on a project where the answer happened to be 0, so nothing was lost — which is
// exactly why it survived: a destructive dry run that usually finds nothing
// looks like a correct dry run. The fake client below records every call, so a
// dry run that reaches the mutating RPC fails here instead of in production.

const NOW = new Date('2026-10-22T12:00:00.000Z');

function plan(dryRun: boolean): RetentionPlan {
  return buildRetentionPlan(NOW, 90, !dryRun);
}

type Calls = { rpc: string[]; counts: Array<{ table: string; column: string; value: string }> };

function fakeClient(options: { count?: number | null; countError?: string; rpcResult?: unknown; rpcError?: string } = {}) {
  const calls: Calls = { rpc: [], counts: [] };
  const client: RetentionClient = {
    async rpc(fn) {
      calls.rpc.push(fn);
      return options.rpcError
        ? { data: null, error: { message: options.rpcError } }
        : { data: options.rpcResult ?? { deleted: 7, cutoff: '2026-07-24T12:00:00Z', retentionDays: 90 }, error: null };
    },
    from(table) {
      return {
        select() {
          return {
            async lt(column, value) {
              calls.counts.push({ table, column, value });
              return options.countError
                ? { count: null, error: { message: options.countError } }
                : { count: options.count ?? 0, error: null };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

test('a dry run counts rows and never calls the deleting function', async () => {
  const { client, calls } = fakeClient({ count: 42 });
  const outcome = await executeRetention(client, plan(true));

  assert.deepEqual(calls.rpc, [], 'a dry run reached the mutating RPC — that is the defect this test exists for');
  assert.deepEqual(calls.counts.map((entry) => `${entry.table}.${entry.column}`), ['site_analytics_events.created_at']);
  assert.equal(outcome.ok, true);
  assert.equal(outcome.ok === true && outcome.mode, 'dry-run');
  assert.equal(outcome.ok === true && outcome.mode === 'dry-run' && outcome.wouldDelete, 42);
});

test('a dry run counts against the plan cutoff, so the number matches the window', async () => {
  const { client, calls } = fakeClient({ count: 3 });
  const retention = plan(true);
  await executeRetention(client, retention);
  assert.equal(calls.counts[0].value, retention.cutoff);
});

test('a dry run that cannot count reports a failure instead of claiming zero', async () => {
  const { client } = fakeClient({ countError: 'permission denied for table site_analytics_events' });
  const outcome = await executeRetention(client, plan(true));
  assert.equal(outcome.ok, false);
  assert.match(outcome.ok === false ? outcome.reason : '', /permission denied/);
});

test('only --apply calls the prune function, and it reports what was deleted', async () => {
  const { client, calls } = fakeClient({ rpcResult: { deleted: 12, cutoff: '2026-07-24T00:00:00Z', retentionDays: 90 } });
  const outcome = await executeRetention(client, plan(false));

  assert.deepEqual(calls.rpc, ['prune_site_analytics_events']);
  assert.deepEqual(calls.counts, [], 'apply must not fall back to counting');
  assert.equal(outcome.ok, true);
  assert.equal(outcome.ok === true && outcome.mode === 'apply' && outcome.deleted, 12);
});

test('an apply that fails says why, including the migration hint when the function is missing', async () => {
  const { client } = fakeClient({ rpcError: 'Could not find the function public.prune_site_analytics_events' });
  const outcome = await executeRetention(client, plan(false));
  assert.equal(outcome.ok, false);
  assert.match(outcome.ok === false ? outcome.reason : '', /20261001120000_analytics_retention\.sql/);
});

test('the plan itself is pure and dry by default', () => {
  const dry = buildRetentionPlan(NOW, 90, false);
  assert.equal(dry.dryRun, true);
  assert.equal(dry.apply, false);
  assert.equal(dry.cutoff, '2026-07-24T12:00:00.000Z');
  const applied = buildRetentionPlan(NOW, 90, true);
  assert.equal(applied.dryRun, false);
});
