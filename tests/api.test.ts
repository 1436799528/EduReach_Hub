import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { once } from 'node:events';

// Explicitly test the fail-closed, unconfigured environment. No live writes.
Object.assign(process.env, {
  NETLIFY: 'true', NODE_ENV: 'production', VITE_SUPABASE_URL: '',
  SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '', EDUREACH_ADMIN_BOOTSTRAP_EMAIL: '',
});
const { app } = await import('../server');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No test port');
const base = `http://127.0.0.1:${address.port}`;
after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

test('health is healthy with security headers and no framework disclosure', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'edureach' });
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-security-policy')!, /frame-ancestors 'self'/);
});
// Exercise every registered admin route, including newly added CMS endpoints.
const adminRoutes = app._router.stack.flatMap((layer: any) => {
  const route = layer.route;
  if (!route || !route.path.startsWith('/api/admin/') || route.path.endsWith('/bootstrap')) return [];
  return Object.keys(route.methods).map(method => ({ method: method.toUpperCase(), path: route.path.replace(/:[^/]+/g, 'test-id') }));
});
for (const { method, path } of adminRoutes) {
  test(`${method} ${path} rejects unauthenticated access`, async () => {
    const response = await fetch(base + path, { method });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Authentication required.' });
  });
}
test('an unverifiable admin token is treated as unauthenticated (401, not 403)', async () => {
  // ROLE-1: 401 means "we could not authenticate you"; 403 is reserved for a
  // signed-in account that lacks the capability. An unverifiable bearer token
  // is not a session, so it must not reach the authorization stage.
  const response = await fetch(`${base}/api/admin/session`, { headers: { Authorization: 'Bearer fake' } });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Invalid or expired session.' });
});
for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
  test(`unknown API ${method} remains JSON 404`, async () => {
    const response = await fetch(`${base}/api/not-a-route`, { method });
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type')!, /application\/json/);
  });
}
test('netlify functions prefix normalizes to /api under standalone server', async () => {
  const healthRes = await fetch(`${base}/.netlify/functions/api/health`);
  assert.equal(healthRes.status, 200);
  assert.deepEqual(await healthRes.json(), { status: 'ok', service: 'edureach' });

  const eventRes = await fetch(`${base}/.netlify/functions/api/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventName: 'pageview', path: '/' }),
  });
  assert.equal(eventRes.status, 204);
});
for (const [method, path] of [
  ['POST', '/api/cbt/exams/test/start'],
  ['POST', '/api/cbt/submit'],
  ['GET', '/api/cbt/attempts/test/progress'],
  ['PATCH', '/api/cbt/attempts/test/progress'],
  // CBT-2: the configured-session API is a student's own data end to end.
  ['POST', '/api/cbt/exams/test/attempts'],
  ['GET', '/api/cbt/attempts/test/paper'],
  ['POST', '/api/cbt/attempts/test/submit'],
  ['PATCH', '/api/cbt/attempts/test/draft'],
  ['POST', '/api/cbt/attempts/test/abandon'],
  ['DELETE', '/api/cbt/attempts/test'],
  ['GET', '/api/cbt/attempts'],
]) {
  test(`student API ${method} ${path} requires authentication`, async () => {
    const response = await fetch(base + path, { method });
    assert.equal(response.status, 401);
  });
}
test('CBT bank availability answers 404, never an empty catalogue, when no bank is configured', async () => {
  // The setup wizard must not offer subjects it cannot deliver. With no backend
  // the honest answer is "this bank is not available", not an empty list that
  // looks like a working bank with nothing in it.
  const response = await fetch(`${base}/api/cbt/exams/test/subjects`);
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /not configured/);
});
test('CBT exam catalogue reports real question counts instead of inventing them', async () => {
  const response = await fetch(`${base}/api/cbt/exams`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: [] });
});
test('bootstrap is disabled without explicit configuration', async () => {
  const response = await fetch(`${base}/api/admin/bootstrap`, { method: 'POST' });
  assert.equal(response.status, 503);
});
test('malformed JSON returns a safe JSON 400', async () => {
  const response = await fetch(`${base}/api/analytics/event`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid request body or URL.' });
});
test('oversized request returns a safe JSON 413', async () => {
  const response = await fetch(`${base}/api/analytics/event`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(1024 * 1024) }) });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'Request body is too large.' });
});
test('uploads authorize before parsing a larger payload', async () => {
  const response = await fetch(`${base}/api/admin/uploads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(1100000) }) });
  assert.equal(response.status, 401);
});
