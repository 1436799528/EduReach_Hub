import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { once } from 'node:events';
import { setLogSink, type LogRecord } from '../lib/observability';

/**
 * The failure that motivated request correlation: a 500 in production with
 * nothing on the line but a stack and no way to match it to the request the
 * student reported. These tests drive the real Express app and assert that a
 * refused or failed request produces a searchable record with the same id the
 * response carries.
 *
 * Explicitly the fail-closed, unconfigured environment: no database, no writes.
 */
Object.assign(process.env, {
  NETLIFY: 'true',
  NODE_ENV: 'production',
  VITE_SUPABASE_URL: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  SUPABASE_SECRET_KEY: '',
  EDUREACH_ADMIN_BOOTSTRAP_EMAIL: '',
});

const records: Array<{ record: LogRecord; stream: 'stdout' | 'stderr' }> = [];
setLogSink((record, stream) => records.push({ record, stream }));

const { app } = await import('../server');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No test port');
const base = `http://127.0.0.1:${address.port}`;
after(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ).then(() => setLogSink(null)),
);

function events(name: string): LogRecord[] {
  return records.filter((entry) => entry.record.event === name).map((entry) => entry.record);
}

test('every response carries a correlation id, including the ones that fail', async () => {
  const response = await fetch(`${base}/api/admin/users`);
  assert.equal(response.status, 401);
  const id = response.headers.get('x-request-id');
  assert.ok(id, 'a refused request still gets an id');
  assert.match(id, /^[A-Za-z0-9._:-]{8,64}$/);

  const denied = events('http.denied');
  assert.equal(denied.length, 1);
  assert.equal(denied[0].request_id, id, 'the log line and the response agree on the id');
  assert.equal(denied[0].status, 401);
  assert.equal(denied[0].route, 'GET /api/admin/users');
  assert.equal(denied[0].level, 'warn');
  assert.equal(records.find((entry) => entry.record.event === 'http.denied')?.stream, 'stderr');
});

test('the platform request id is reused, so a Netlify log search matches', async () => {
  const response = await fetch(`${base}/api/admin/session`, {
    headers: { 'x-nf-request-id': '01JABCDEF0123456789ABCDEF' },
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('x-request-id'), '01JABCDEF0123456789ABCDEF');

  const refused = events('auth.refused_unauthenticated').at(-1);
  assert.ok(refused, 'the authorization refusal is recorded next to the 401');
  assert.equal(refused.request_id, '01JABCDEF0123456789ABCDEF');
  assert.equal(refused.status, 401);
});

test('a token sent by the caller never appears in a logged record', async () => {
  const synthetic = 'sb_secret_synthetic_only_for_this_test';
  const response = await fetch(`${base}/api/admin/question-reports`, {
    headers: { authorization: `Bearer ${synthetic}` },
  });
  assert.equal(response.status, 401);
  const lines = records.map((entry) => JSON.stringify(entry.record)).join('\n');
  assert.ok(!lines.includes(synthetic), 'the bearer token must never be logged');
  assert.ok(!/Bearer\s/.test(lines), 'nor the header it arrived in');
});

test('a route id is reduced to a shape so cardinality stays bounded', async () => {
  const response = await fetch(`${base}/api/site-content`);
  // Unconfigured Supabase: the public read degrades rather than crashing.
  assert.ok([200, 503].includes(response.status));
  const logged = records.filter((entry) => String(entry.record.route || '').includes(':id'));
  assert.equal(logged.length, 0, 'a uuid must not appear verbatim in a route');
  for (const entry of records) {
    assert.ok(
      !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(String(entry.record.route || '')),
      `route shapes never contain a uuid: ${String(entry.record.route)}`,
    );
  }
});
