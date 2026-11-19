import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  __resetErrorTrackingForTests,
  errorTrackingConfigured,
  FORWARDED_EVENTS,
  flushErrorTracking,
  installForwarder,
  redactSentryEvent,
  setErrorTrackingClient,
  shouldForward,
  startErrorTracking,
  type ErrorTrackingClient,
  type ErrorTrackingPayload,
} from '../lib/errorTracking';
import { EventRateLimiter, log, setLogForwarder, setLogSink } from '../lib/observability';

/**
 * The tracker is the one place where data leaves the process. These tests pin
 * the three properties the approval depended on: it is off unless configured,
 * it only forwards what a maintainer should be paged about, and nothing
 * identifying is in the payload.
 */

interface Captured {
  kind: 'exception' | 'message';
  payload: ErrorTrackingPayload;
  error?: unknown;
}

function fakeClient(events: Captured[]): ErrorTrackingClient {
  return {
    captureException: (error, payload) => events.push({ kind: 'exception', payload, error }),
    captureMessage: (payload) => events.push({ kind: 'message', payload }),
    flush: async () => true,
  };
}

afterEach(() => {
  __resetErrorTrackingForTests();
  setLogSink(null);
  setLogForwarder(null);
});

test('without a DSN the tracker stays off and the SDK is never loaded', async () => {
  const started = await startErrorTracking({} as NodeJS.ProcessEnv);
  assert.equal(started, false);
  assert.equal(errorTrackingConfigured(), false);
  // A missing DSN is not an error: the structured log still has every event.
  assert.equal(await flushErrorTracking(10), true);
});

test('only events a maintainer should act on are forwarded, and only at error level', () => {
  assert.ok(FORWARDED_EVENTS.includes('cbt.submit_failed'));
  assert.ok(FORWARDED_EVENTS.includes('audit.write_failed'));
  assert.equal(shouldForward('cbt.submit_failed', 'error'), true);
  assert.equal(shouldForward('process.uncaught_exception', 'critical'), true);
  // A recoverable admin failure has an `http.server_error` line instead: one
  // incident, not two.
  assert.equal(shouldForward('admin.news_create.failed', 'error'), false);
  assert.equal(shouldForward('auth.verify_failed', 'warn'), false);
  assert.equal(shouldForward('http.slow', 'warn'), false);
  // An event carrying a real exception is worth a stack trace regardless.
  assert.equal(shouldForward('something.unlisted', 'error', true), true);
});

test('forwarding sends the exception, the request id and the redacted context', () => {
  const captured: Captured[] = [];
  const client = fakeClient(captured);
  setErrorTrackingClient(client);
  installForwarder(client, new EventRateLimiter(10, 60_000));
  setLogSink(() => {});

  const failure = new Error('duplicate key value violates unique constraint "profiles_email_key"');
  log.error('cbt.submit_failed', { request_id: 'req_0123456789', attempt_id: 'attempt_1' }, failure);

  assert.equal(captured.length, 1);
  assert.equal(captured[0].kind, 'exception');
  assert.equal(captured[0].error, failure, 'the stack is why the tracker exists');
  assert.equal(captured[0].payload.event, 'cbt.submit_failed');
  assert.equal(captured[0].payload.level, 'error');
  assert.equal(captured[0].payload.requestId, 'req_0123456789');
  assert.equal(captured[0].payload.context.attempt_id, 'attempt_1');
  assert.equal(errorTrackingConfigured(), true);
});

test('a forwarded payload cannot carry a credential even if the call site passes one', () => {
  const captured: Captured[] = [];
  const client = fakeClient(captured);
  setErrorTrackingClient(client);
  installForwarder(client, new EventRateLimiter(10, 60_000));
  setLogSink(() => {});

  log.error(
    'audit.write_failed',
    { action: 'cbt_question_regrade', authorization: 'Bearer sb_secret_synthetic', token: 'synthetic-token' },
    new Error('write failed'),
  );

  const line = JSON.stringify(captured[0].payload);
  assert.ok(!line.includes('sb_secret_synthetic'));
  assert.ok(!line.includes('synthetic-token'));
  assert.equal(captured[0].payload.context.authorization, '[redacted]');
});

test('a burst is capped so the free-tier quota cannot be spent in a morning', () => {
  const captured: Captured[] = [];
  const client = fakeClient(captured);
  setErrorTrackingClient(client);
  installForwarder(client, new EventRateLimiter(2, 3_600_000));
  setLogSink(() => {});

  for (let index = 0; index < 5; index += 1) log.error('http.server_error', { route: 'GET /api/news', status: 500 });
  assert.equal(captured.length, 2, 'the cap is the quota guard, not a sampling decision');
  assert.equal(captured[0].kind, 'message', 'a 5xx without an exception is still one issue per route');
});

test('the daily cap is what bounds the month, independently of the hourly one', () => {
  const captured: Captured[] = [];
  const client = fakeClient(captured);
  setErrorTrackingClient(client);
  installForwarder(client, new EventRateLimiter(100, 3_600_000), new EventRateLimiter(3, 86_400_000));
  setLogSink(() => {});

  for (let index = 0; index < 10; index += 1) log.error('http.server_error', { route: 'GET /api/news', status: 500 });
  // 30/hour and 150/day can never exceed 4,650 in a 31-day month: 5,000 is safe.
  assert.equal(captured.length, 3);
});

test('the SDK event is reduced to the error and nothing about the caller', () => {
  const safe = redactSentryEvent({
    server_name: 'ip-10-0-1-4',
    user: { id: 'u_1', email: 'student@example.test', ip_address: '203.0.113.9' },
    contexts: { cloud_resource: { 'host.id': 'i-abc' }, runtime: { name: 'node' } },
    request: {
      method: 'POST',
      url: 'https://edureachhub.netlify.app/api/cbt/attempts/abc/submit?token=synthetic-leak',
      headers: { authorization: 'Bearer synthetic-leak', cookie: 'sb=1' },
      cookies: { sb: 'synthetic-cookie' },
      data: { answers: { 1: 'A' }, password: 'synthetic-password' },
      query_string: 'token=synthetic-leak',
    },
    extra: { token: 'synthetic-extra-token', route: 'POST /api/cbt/attempts/:id/submit' },
    tags: { event: 'cbt.submit_failed', authorization: 'Bearer synthetic-leak', attempt_id: 'abc' },
    breadcrumbs: [
      { category: 'fetch', message: 'POST https://example.test?token=synthetic-leak', data: { url: 'https://x?token=1' } },
    ],
    message: 'x'.repeat(1000),
  });

  const line = JSON.stringify(safe);
  for (const secret of [
    'synthetic-leak',
    'synthetic-cookie',
    'synthetic-password',
    'synthetic-extra-token',
    'student@example.test',
    '203.0.113.9',
    'ip-10-0-1-4',
    'i-abc',
  ]) {
    assert.ok(!line.includes(secret), `${secret} must not leave the process`);
  }

  assert.equal(safe.server_name, undefined);
  assert.equal(safe.user, undefined);
  assert.equal(safe.contexts, undefined);
  assert.deepEqual(safe.request, { method: 'POST', url: 'https://edureachhub.netlify.app/api/cbt/attempts/abc/submit' });
  assert.equal((safe.extra as Record<string, unknown>).token, '[redacted]');
  assert.equal((safe.extra as Record<string, unknown>).route, 'POST /api/cbt/attempts/:id/submit');
  assert.deepEqual(safe.tags, { event: 'cbt.submit_failed', attempt_id: 'abc' });
  assert.equal((safe.breadcrumbs as Array<Record<string, unknown>>)[0].data, undefined);
  assert.equal((safe.message as string).length, 301);
});
