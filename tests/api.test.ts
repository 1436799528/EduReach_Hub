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
test('invalid admin token cannot establish a session', async () => {
  const response = await fetch(`${base}/api/admin/session`, { headers: { Authorization: 'Bearer fake' } });
  assert.equal(response.status, 403);
});
for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
  test(`unknown API ${method} remains JSON 404`, async () => {
    const response = await fetch(`${base}/api/not-a-route`, { method });
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type')!, /application\/json/);
  });
}
for (const [method, path] of [['POST', '/api/cbt/exams/test/start'], ['POST', '/api/cbt/submit'], ['GET', '/api/cbt/attempts/test/progress'], ['PATCH', '/api/cbt/attempts/test/progress']]) {
  test(`student API ${method} ${path} requires authentication`, async () => {
    const response = await fetch(base + path, { method });
    assert.equal(response.status, 401);
  });
}
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
