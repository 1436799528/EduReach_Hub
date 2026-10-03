import assert from 'node:assert/strict';
import { test } from 'node:test';

// OBS-1 — scheduled job observability.
//
// The behaviour that matters here is the behaviour under failure. A job recorder
// that throws would turn a successful newsroom refresh into a failed one, which is
// worse than having no recorder at all. And a job that stops firing produces no
// error anywhere — so "no recent success" has to be a first-class answer, not an
// absence of data.

import {
  KNOWN_JOBS,
  STALE_AFTER_HOURS,
  evaluateJobHealth,
  recordJobRun,
  runRecorded,
  sanitizeDetail,
  sanitizeError,
} from '../src/server/jobRuns';

/** A stub client that records inserts instead of writing them. */
function stubClient(behaviour: { fail?: boolean; throwOnInsert?: boolean } = {}) {
  const inserts: Array<Record<string, unknown>> = [];
  return {
    inserts,
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          inserts.push({ table, ...row });
          if (behaviour.throwOnInsert) throw new Error('connection reset');
          return Promise.resolve({ error: behaviour.fail ? { message: 'insert refused' } : null });
        },
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Sanitisation — the detail is operator-visible                       */
/* ------------------------------------------------------------------ */

test('only scalars survive into the job detail', () => {
  const clean = sanitizeDetail({
    published: 4,
    dryRun: false,
    source: 'jamb.gov.ng',
    nested: { secret: 'sb_secret_abc' },
    list: [1, 2, 3],
    nothing: null,
    missing: undefined,
  });
  assert.deepEqual(clean, { published: 4, dryRun: false, source: 'jamb.gov.ng' });
  assert.ok(!JSON.stringify(clean).includes('sb_secret'), 'a nested secret must not survive flattening');
});

test('a long string is truncated and empty values are dropped', () => {
  const clean = sanitizeDetail({ long: 'x'.repeat(5000), blank: '   ' });
  assert.equal((clean.long as string).length, 200);
  assert.ok(!('blank' in clean));
});

test('the detail is bounded even for a hostile payload', () => {
  const huge = Object.fromEntries(Array.from({ length: 500 }, (_, index) => [`key${index}`, index]));
  assert.ok(Object.keys(sanitizeDetail(huge)).length <= 20);
  assert.deepEqual(sanitizeDetail(null), {});
  assert.deepEqual(sanitizeDetail([1, 2] as unknown as Record<string, unknown>), {});
});

test('an error is trimmed to a message without a stack', () => {
  assert.equal(sanitizeError(new Error('boom')), 'boom');
  assert.equal(sanitizeError('plain'), 'plain');
  assert.equal(sanitizeError(undefined), null);
  assert.equal(sanitizeError({}), null);
  const long = sanitizeError(new Error('e'.repeat(2000)));
  assert.equal(long?.length, 500);
});

/* ------------------------------------------------------------------ */
/* Recording — best effort, never fatal                                */
/* ------------------------------------------------------------------ */

test('a successful run writes one row with a duration', async () => {
  const client = stubClient();
  const ok = await recordJobRun(client, 'newsroom-refresh', {
    status: 'succeeded',
    startedAt: new Date(Date.now() - 1500),
    detail: { published: 2 },
  });
  assert.equal(ok, true);
  assert.equal(client.inserts.length, 1);
  const row = client.inserts[0];
  assert.equal(row.job_name, 'newsroom-refresh');
  assert.equal(row.status, 'succeeded');
  assert.equal(row.error, null);
  assert.ok(Number(row.duration_ms) >= 1000, 'the duration should reflect the elapsed time');
});

test('a refused insert returns false instead of throwing', async () => {
  const ok = await recordJobRun(stubClient({ fail: true }), 'newsroom-refresh', {
    status: 'succeeded',
    startedAt: new Date(),
  });
  assert.equal(ok, false, 'a telemetry failure must not look like success, but must not throw either');
});

test('a throwing client is swallowed', async () => {
  const ok = await recordJobRun(stubClient({ throwOnInsert: true }), 'newsroom-refresh', {
    status: 'succeeded',
    startedAt: new Date(),
  });
  assert.equal(ok, false);
});

test('runRecorded records success and returns the result unchanged', async () => {
  const client = stubClient();
  const result = await runRecorded(client, 'analytics-retention', async () => ({
    result: { deleted: 12 },
    detail: { deleted: 12 },
  }));
  assert.deepEqual(result, { deleted: 12 });
  assert.equal(client.inserts[0].status, 'succeeded');
});

test('runRecorded records the failure and still re-throws it', async () => {
  const client = stubClient();
  await assert.rejects(
    runRecorded(client, 'newsroom-refresh', async () => {
      throw new Error('upstream 503');
    }),
    /upstream 503/,
  );
  assert.equal(client.inserts.length, 1);
  assert.equal(client.inserts[0].status, 'failed');
  assert.equal(client.inserts[0].error, 'upstream 503');
});

/* ------------------------------------------------------------------ */
/* Health — a silent job is a finding                                  */
/* ------------------------------------------------------------------ */

const freshJob = { job_name: 'newsroom-refresh', fresh: true, last_success_at: '2026-10-01T09:00:00Z', last_failure_at: null };
const retentionJob = { job_name: 'analytics-retention', fresh: true, last_success_at: '2026-10-01T09:05:00Z', last_failure_at: null };
const opportunityJob = { job_name: 'opportunity-expiry', fresh: true, last_success_at: '2026-10-01T09:10:00Z', last_failure_at: null };
const pruneJob = { job_name: 'scheduled-job-prune', fresh: true, last_success_at: '2026-10-01T09:15:00Z', last_failure_at: null };
const allFreshJobs = [freshJob, retentionJob, opportunityJob, pruneJob];

test('all known jobs running fresh is healthy', () => {
  const health = evaluateJobHealth({ sinceHours: STALE_AFTER_HOURS, jobs: allFreshJobs });
  assert.equal(health.ok, true);
  assert.deepEqual(health, { ok: true, missing: [], stale: [], failing: [] });
});

test('a job that never recorded is reported as missing, not healthy', () => {
  const health = evaluateJobHealth({
    sinceHours: STALE_AFTER_HOURS,
    jobs: allFreshJobs.filter((job) => job.job_name !== 'analytics-retention'),
  });
  assert.equal(health.ok, false);
  assert.deepEqual(health.missing, ['analytics-retention']);
});

test('an empty status is not a pass', () => {
  assert.equal(evaluateJobHealth(null).ok, false);
  assert.equal(evaluateJobHealth(undefined).ok, false);
  assert.deepEqual(evaluateJobHealth({ sinceHours: 48, jobs: [] }).missing, [...KNOWN_JOBS]);
});

test('a job whose last success is stale is reported as stale', () => {
  const stale = { ...freshJob, fresh: false, last_success_at: '2026-09-20T09:00:00Z' };
  const health = evaluateJobHealth({ sinceHours: STALE_AFTER_HOURS, jobs: [stale, retentionJob, opportunityJob, pruneJob] });
  assert.equal(health.ok, false);
  assert.deepEqual(health.stale, ['newsroom-refresh']);
});

test('a failure more recent than the last success is reported as failing', () => {
  const failing = { ...freshJob, last_failure_at: '2026-10-01T10:00:00Z', last_error: 'fetch timeout' };
  const health = evaluateJobHealth({ sinceHours: STALE_AFTER_HOURS, jobs: [failing, retentionJob, opportunityJob, pruneJob] });
  assert.equal(health.ok, false);
  assert.deepEqual(health.failing, ['newsroom-refresh']);
});

test('an old failure followed by a success is not a current failure', () => {
  const recovered = { ...freshJob, last_failure_at: '2026-09-28T10:00:00Z' };
  const health = evaluateJobHealth({ sinceHours: STALE_AFTER_HOURS, jobs: [recovered, retentionJob, opportunityJob, pruneJob] });
  assert.deepEqual(health.failing, [], 'a recovered job must not keep being reported as failing');
  assert.equal(health.ok, true);
});

test('an unexpected job in the table does not affect the verdict', () => {
  const health = evaluateJobHealth({
    sinceHours: STALE_AFTER_HOURS,
    jobs: [...allFreshJobs, { job_name: 'some-future-job', fresh: false }],
  });
  assert.equal(health.ok, true);
});
