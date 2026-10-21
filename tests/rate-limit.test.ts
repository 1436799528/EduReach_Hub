import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { once } from 'node:events';

import { MemoryRateLimiter, bearerSubject, clientKey, createRateLimiter, type RateLimitRule } from '../lib/rate-limit';

// Explicitly test the unconfigured, fail-closed environment. No live writes.
Object.assign(process.env, {
  NETLIFY: 'true', NODE_ENV: 'production', VITE_SUPABASE_URL: '',
  SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '', EDUREACH_ADMIN_BOOTSTRAP_EMAIL: '',
});

const rule: RateLimitRule = { name: 'unit-test', limit: 3, windowSeconds: 60 };

function mockRequest(headers: Record<string, string> = {}): any {
  const lowered = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    header: (name: string) => lowered[String(name).toLowerCase()],
    ip: '10.0.0.1',
    socket: { remoteAddress: '10.0.0.1' },
  };
}

function mockResponse(): any {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    body: null as unknown,
    headers,
    setHeader: (key: string, value: string) => { headers[key.toLowerCase()] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
}


/**
 * Runs a middleware and resolves when it either calls next() or writes a
 * response, so a blocked request does not leave the test pending.
 */
function runMiddleware(
  middleware: (req: any, res: any, next: () => void) => unknown,
  request: any,
  response: any,
): Promise<{ nextCalled: boolean }> {
  return new Promise((resolve) => {
    const originalJson = response.json.bind(response);
    response.json = (payload: unknown) => { originalJson(payload); resolve({ nextCalled: false }); return response; };
    middleware(request, response, () => resolve({ nextCalled: true }));
  });
}

test('memory limiter allows up to the limit then reports a retry window', () => {
  let clock = 1_000_000;
  const limiter = new MemoryRateLimiter(() => clock);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = limiter.hit('k', rule);
    assert.equal(result.allowed, true, `attempt ${attempt} should be allowed`);
    assert.equal(result.remaining, 3 - attempt);
  }

  const blocked = limiter.hit('k', rule);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds > 0 && blocked.retryAfterSeconds <= 60);

  // A different key (another student) is unaffected.
  assert.equal(limiter.hit('other', rule).allowed, true);

  // The window slides: after it elapses the bucket is available again.
  clock += 61_000;
  assert.equal(limiter.hit('k', rule).allowed, true);
});

test('clientKey prefers the Netlify client IP, then x-forwarded-for, then the socket', () => {
  assert.equal(clientKey(mockRequest({ 'x-nf-client-connection-ip': '41.1.2.3', 'x-forwarded-for': '9.9.9.9' })), '41.1.2.3');
  assert.equal(clientKey(mockRequest({ 'x-forwarded-for': '9.9.9.9, 10.0.0.2' })), '9.9.9.9');
  assert.equal(clientKey(mockRequest()), '10.0.0.1');
});

test('middleware blocks in-process and sets rate limit headers', async () => {
  const middleware = createRateLimiter({})(rule);
  const request = mockRequest();
  const response = mockResponse();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await runMiddleware(middleware, request, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['ratelimit-limit'], '3');
  }

  await runMiddleware(middleware, request, response);
  assert.equal(response.statusCode, 429);
  assert.deepEqual(response.body, { error: 'Too many requests. Please slow down and try again shortly.' });
  assert.equal(response.headers['retry-after'], '60');
});

test('durable layer denies when the counter says so, and fails open when it is unavailable', async () => {
  const denying = createRateLimiter({ callRpc: async () => ({ data: false, error: null }) })({
    name: 'durable-deny', limit: 10, windowSeconds: 60, durable: true,
  });
  const denyResponse = mockResponse();
  await runMiddleware(denying, mockRequest(), denyResponse);
  assert.equal(denyResponse.statusCode, 429);

  const erroring = createRateLimiter({
    callRpc: async () => ({ data: null, error: { message: 'function public.check_rate_limit does not exist' } }),
  })({ name: 'durable-error', limit: 10, windowSeconds: 60, durable: true });
  const errorResponse = mockResponse();
  const errorRun = await runMiddleware(erroring, mockRequest(), errorResponse);
  assert.equal(errorRun.nextCalled, true, 'a missing durable limiter must not break the endpoint');
  assert.equal(errorResponse.statusCode, 200);

  const throwing = createRateLimiter({ callRpc: async () => { throw new Error('network down'); } })({
    name: 'durable-throw', limit: 10, windowSeconds: 60, durable: true,
  });
  const throwResponse = mockResponse();
  const throwRun = await runMiddleware(throwing, mockRequest(), throwResponse);
  assert.equal(throwRun.nextCalled, true);
  assert.equal(throwResponse.statusCode, 200);
});

test('sensitive endpoints are rate limited end to end', async () => {
  const { app } = await import('../server');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  const base = `http://127.0.0.1:${address.port}`;
  after(() => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  const statuses: number[] = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(`${base}/api/admin/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '203.0.113.9' },
      body: '{}',
    });
    statuses.push(response.status);
    if (attempt === 0) {
      assert.equal(response.headers.get('ratelimit-limit'), '5');
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  }

  assert.equal(statuses[5], 429, 'the sixth bootstrap attempt from one address is refused');
  assert.ok(statuses.slice(0, 5).every((status) => status !== 429));

  // A different address is still served (no shared global bucket).
  const other = await fetch(`${base}/api/admin/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '203.0.113.10' },
    body: '{}',
  });
  assert.notEqual(other.status, 429);
});

function bearerFor(sub: string): string {
  const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `Bearer ${segment({ alg: 'none', typ: 'JWT' })}.${segment({ sub })}.signature`;
}

test('bearerSubject reads only a UUID-shaped subject claim', () => {
  const id = '33333333-3333-3333-3333-333333333333';
  assert.equal(bearerSubject(mockRequest({ authorization: bearerFor(id) })), id);
  assert.equal(bearerSubject(mockRequest({ authorization: bearerFor('not-a-uuid') })), null);
  assert.equal(bearerSubject(mockRequest({ authorization: 'Bearer not-a-jwt' })), null);
  assert.equal(bearerSubject(mockRequest()), null);
});

test('keyByUser counts per account behind one shared IP, falling back to the IP', async () => {
  const perUserRule: RateLimitRule = { name: 'per-user', limit: 2, windowSeconds: 60, keyByUser: true };
  const middleware = createRateLimiter({})(perUserRule);
  const studentA = mockRequest({ authorization: bearerFor('33333333-3333-3333-3333-333333333333') });
  const studentB = mockRequest({ authorization: bearerFor('44444444-4444-4444-4444-444444444444') });

  // Both students share mockRequest's 10.0.0.1 address (a lab behind NAT).
  const resA = mockResponse();
  await runMiddleware(middleware, studentA, resA);
  await runMiddleware(middleware, studentA, resA);
  assert.equal(resA.statusCode, 200);
  await runMiddleware(middleware, studentA, resA);
  assert.equal(resA.statusCode, 429, 'the third request from the same account is blocked');

  const resB = mockResponse();
  const runB = await runMiddleware(middleware, studentB, resB);
  assert.equal(runB.nextCalled, true, 'a different student on the same IP is not blocked by the first');
  assert.equal(resB.statusCode, 200);

  // No token (or a malformed one) shares the per-IP bucket.
  const resAnon = mockResponse();
  await runMiddleware(middleware, mockRequest(), resAnon);
  await runMiddleware(middleware, mockRequest({ authorization: 'Bearer not-a-jwt' }), resAnon);
  assert.equal(resAnon.statusCode, 200);
  await runMiddleware(middleware, mockRequest(), resAnon);
  assert.equal(resAnon.statusCode, 429, 'anonymous requests still share the IP bucket');
});
