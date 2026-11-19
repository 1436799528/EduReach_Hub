import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PUBLIC_CACHE_CONTROL,
  PRIVATE_CACHE_CONTROL,
  createPublicCache,
} from '../src/server/publicCache';

// The public institution read is one assembled response behind one cache. These
// tests hold the three properties that make that safe: stale-while-revalidate,
// single flight, and explicit invalidation. They also pin the two header
// policies, because "publicly cacheable" is a decision about content, never a
// default.

test('the class header policy is short-lived, CDN-cached and revalidating', () => {
  assert.equal(PUBLIC_CACHE_CONTROL, 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  assert.equal(PRIVATE_CACHE_CONTROL, 'private, no-store');
});

test('a cold read loads once, and a second read is a hit', async () => {
  const now = 1_000;
  let loads = 0;
  const cache = createPublicCache<string>({ ttlMs: 60_000, staleMs: 600_000, now: () => now });
  const load = async () => { loads += 1; return `value-${loads}`; };

  const first = await cache.get('institution:a:intelligence', load);
  assert.equal(first.state, 'miss');
  assert.equal(first.value, 'value-1');

  const second = await cache.get('institution:a:intelligence', load);
  assert.equal(second.state, 'hit');
  assert.equal(second.value, 'value-1');
  assert.equal(loads, 1, 'the second visitor did not touch the loader');

  const stats = cache.stats();
  assert.equal(stats.misses, 1);
  assert.equal(stats.hits, 1);
  assert.equal(stats.loads, 1);
  assert.equal(stats.size, 1);
});

test('a value past its TTL is served stale while one refresh runs behind it', async () => {
  let now = 0;
  let version = 1;
  let loads = 0;
  const cache = createPublicCache<number>({ ttlMs: 60_000, staleMs: 600_000, now: () => now });

  await cache.get('k', async () => { loads += 1; return version; });
  now = 61_000; // past the TTL, inside the stale window
  version = 2;

  const stale = await cache.get('k', async () => { loads += 1; return version; });
  assert.equal(stale.state, 'stale', 'the visitor gets the old page immediately');
  assert.equal(stale.value, 1);

  // The background refresh lands on the next tick.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const fresh = await cache.get('k', async () => { loads += 1; return version; });
  assert.equal(fresh.value, 2);
  assert.equal(fresh.state, 'hit');
  assert.equal(loads, 2, 'one refresh, not one per visitor');

  const stats = cache.stats();
  assert.equal(stats.staleHits, 1);
  assert.equal(stats.revalidations, 1);
});

test('a value past both windows waits for a fresh load instead of serving yesterday', async () => {
  let now = 0;
  let version = 1;
  const cache = createPublicCache<number>({ ttlMs: 60_000, staleMs: 120_000, now: () => now });

  await cache.get('k', async () => version);
  now = 60_000 + 120_000 + 1;
  version = 3;
  const read = await cache.get('k', async () => version);
  assert.equal(read.state, 'miss');
  assert.equal(read.value, 3);
});

test('concurrent cold requests share one loader call', async () => {
  let loads = 0;
  let release: (value: string) => void = () => {};
  const cache = createPublicCache<string>({ ttlMs: 60_000, staleMs: 600_000 });

  const slow = () => new Promise<string>((resolve) => { loads += 1; release = resolve; });
  const pending = [cache.get('k', slow), cache.get('k', slow), cache.get('k', slow)];
  // One loader is now in flight; let it resolve after the other two have joined.
  await Promise.resolve();
  release('shared');
  const results = await Promise.all(pending);

  assert.equal(loads, 1, 'a cold cache does not stampede the database');
  for (const result of results) assert.equal(result.value, 'shared');
  assert.ok(cache.stats().coalesced >= 2, 'the joining requests are counted');
});

test('a failed refresh keeps the previous value instead of caching the failure', async () => {
  let now = 0;
  const errors: string[] = [];
  const cache = createPublicCache<string>({
    ttlMs: 1_000,
    staleMs: 60_000,
    now: () => now,
    onError: (error, key) => errors.push(`${key}:${(error as Error).message}`),
  });

  await cache.get('k', async () => 'stable');
  now = 2_000;
  const stale = await cache.get('k', async () => { throw new Error('database down'); });
  assert.equal(stale.state, 'stale');
  assert.equal(stale.value, 'stable');

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(errors, ['k:database down']);
  const after = await cache.get('k', async () => 'stable');
  assert.equal(after.value, 'stable', 'the good value survived the failure');
  assert.equal(cache.stats().failures, 1);
});

test('a cold load that throws propagates and stores nothing', async () => {
  const cache = createPublicCache<string>({ ttlMs: 1_000, staleMs: 60_000 });
  await assert.rejects(() => cache.get('k', async () => { throw new Error('nope'); }), /nope/);
  assert.equal(cache.stats().size, 0);
  const retry = await cache.get('k', async () => 'recovered');
  assert.equal(retry.state, 'miss');
  assert.equal(retry.value, 'recovered');
});

test('a payload the predicate refuses is never stored', async () => {
  const cache = createPublicCache<{ profile: boolean }>({
    ttlMs: 60_000,
    staleMs: 600_000,
    shouldCache: (value) => value.profile,
  });
  const empty = await cache.get('k', async () => ({ profile: false }));
  assert.equal(empty.state, 'miss');
  assert.equal(cache.stats().size, 0, 'an empty assembly cannot outlive the publish that would fill it');

  await cache.get('k', async () => ({ profile: true }));
  assert.equal(cache.stats().size, 1);
  assert.equal((await cache.get('k', async () => ({ profile: false }))).state, 'hit');
});

test('invalidate clears one institution and leaves the rest alone', async () => {
  const cache = createPublicCache<string>({ ttlMs: 60_000, staleMs: 600_000 });
  await cache.get('institution:a:intelligence', async () => 'a');
  await cache.get('institution:b:intelligence', async () => 'b');
  await cache.get('services', async () => 'services');

  cache.invalidate('institution:a:intelligence');
  assert.equal(cache.peek('institution:a:intelligence'), undefined);
  assert.equal(cache.peek('institution:b:intelligence'), 'b');
  assert.equal(cache.stats().invalidations, 1);

  cache.invalidatePrefix('institution:');
  assert.equal(cache.peek('institution:b:intelligence'), undefined);
  assert.equal(cache.peek('services'), 'services', 'a prefix invalidation is not a flush');
});

test('counters describe the work the cache saved', async () => {
  const cache = createPublicCache<string>({ ttlMs: 60_000, staleMs: 600_000 });
  await cache.get('k', async () => 'v');
  await cache.get('k', async () => 'v');
  await cache.get('k', async () => 'v');
  const stats = cache.stats();
  assert.equal(stats.loads, 1);
  assert.equal(stats.hits, 2);
  assert.equal(stats.misses, 1);
  cache.clear();
  assert.equal(cache.stats().size, 0);
});
