import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker() {
  const handlers: Record<string, (event: any) => void> = {};
  const deleted: string[] = [];
  const cached: string[] = [];
  const context = {
    URL, Response,
    self: { location: { origin: 'https://example.test' }, addEventListener: (name: string, fn: any) => { handlers[name] = fn; }, clients: { claim: async () => {} }, skipWaiting: async () => {} },
    caches: {
      keys: async () => ['edureach-shell-v4', 'edureach-dynamic-v4', 'unrelated-app'],
      delete: async (key: string) => { deleted.push(key); },
      match: async () => undefined,
      open: async () => ({ addAll: async () => {}, put: async (req: Request) => { cached.push(req.url); } }),
    },
    fetch: async () => { const response = new Response('asset'); Object.defineProperty(response, 'type', { value: 'basic' }); return response; },
  };
  vm.runInNewContext(source, context);
  return { handlers, context, deleted, cached };
}
for (const path of ['/api', '/api/admin/users', '/api/cbt/attempts/id/progress', '/.netlify/functions/api/admin/users', '/dashboard']) {
  test(`service worker does not cache private/non-static ${path}`, () => {
    const { handlers } = worker();
    let intercepted = false;
    handlers.fetch({ request: new Request(`https://example.test${path}`), respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
  });
}
test('versioned JavaScript and CSS bundles are cached for offline reopen', async () => {
  const { handlers, cached } = worker();
  const tasks: Promise<void>[] = [];
  for (const path of ['/assets/app-a1b2c3.js', '/assets/app-a1b2c3.css']) {
    let response: Promise<Response>;
    handlers.fetch({ request: new Request(`https://example.test${path}`), respondWith: (promise: Promise<Response>) => { response = promise; }, waitUntil: (promise: Promise<void>) => tasks.push(promise) });
    assert.equal(await (await response!).text(), 'asset');
  }
  await Promise.all(tasks);
  // Vite changes the file name whenever the content changes, so these cached
  // copies can never go stale.
  assert.deepEqual(cached, ['https://example.test/assets/app-a1b2c3.js', 'https://example.test/assets/app-a1b2c3.css']);
});

test('a cached versioned bundle is served without the network on reopen', async () => {
  const hit = new Response('cached-bundle');
  const { handlers, context } = worker();
  (context.caches as { match: unknown }).match = async () => hit;
  let fetched = false;
  context.fetch = async () => { fetched = true; return new Response('network'); };
  let response: Promise<Response>;
  handlers.fetch({ request: new Request('https://example.test/assets/app-a1b2c3.js'), respondWith: (promise: Promise<Response>) => { response = promise; }, waitUntil: () => {} });
  assert.equal(await response!, hit);
  assert.equal(fetched, false, 'the network is not consulted for a cached versioned bundle');
});
test('even asset URLs with Authorization bypass service worker', () => {
  const { handlers } = worker();
  handlers.fetch({ request: new Request('https://example.test/assets/file.js', { headers: { Authorization: 'Bearer token' } }), respondWith: () => assert.fail('intercepted private request') });
});
test('activation purges old EduReach data caches only', async () => {
  const { handlers, deleted } = worker();
  let task: Promise<void>;
  handlers.activate({ waitUntil: (promise: Promise<void>) => { task = promise; } });
  await task!;
  assert.deepEqual(deleted, ['edureach-shell-v4', 'edureach-dynamic-v4']);
});
test('offline navigation returns an actual response, never undefined', async () => {
  const { handlers, context } = worker();
  context.fetch = async () => { throw new Error('offline'); };
  let task: Promise<Response>;
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/', mode: 'navigate', headers: new Headers() }, respondWith: (promise: Promise<Response>) => { task = promise; } });
  const response = await task!;
  assert.equal(response.status, 503);
  assert.match(await response.text(), /offline/);
});
test('stable public assets are cloned before consumption and cached with waitUntil', async () => {
  const { handlers, cached } = worker();
  let response: Promise<Response>;
  const tasks: Promise<void>[] = [];
  handlers.fetch({ request: new Request('https://example.test/icons/logo.png'), respondWith: (promise: Promise<Response>) => { response = promise; }, waitUntil: (promise: Promise<void>) => tasks.push(promise) });
  assert.equal(await (await response!).text(), 'asset');
  await Promise.all(tasks);
  assert.deepEqual(cached, ['https://example.test/icons/logo.png']);
});
