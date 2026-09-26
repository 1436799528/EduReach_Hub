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
      keys: async () => ['edureach-shell-v3', 'edureach-dynamic-v3', 'unrelated-app'],
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
test('even asset URLs with Authorization bypass service worker', () => {
  const { handlers } = worker();
  handlers.fetch({ request: new Request('https://example.test/assets/file.js', { headers: { Authorization: 'Bearer token' } }), respondWith: () => assert.fail('intercepted private request') });
});
test('activation purges old EduReach data caches only', async () => {
  const { handlers, deleted } = worker();
  let task: Promise<void>;
  handlers.activate({ waitUntil: (promise: Promise<void>) => { task = promise; } });
  await task!;
  assert.deepEqual(deleted, ['edureach-shell-v3', 'edureach-dynamic-v3']);
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
test('public assets are cloned before consumption and cached with waitUntil', async () => {
  const { handlers, cached } = worker();
  let response: Promise<Response>;
  const tasks: Promise<void>[] = [];
  handlers.fetch({ request: new Request('https://example.test/assets/app.js'), respondWith: (promise: Promise<Response>) => { response = promise; }, waitUntil: (promise: Promise<void>) => tasks.push(promise) });
  assert.equal(await (await response!).text(), 'asset');
  await Promise.all(tasks);
  assert.deepEqual(cached, ['https://example.test/assets/app.js']);
});
