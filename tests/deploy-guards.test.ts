import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { evaluateClientEnv } from '../scripts/client-env-check';
import { evaluateReady } from '../scripts/smoke-check';

// P2-1: the build-time client-contract guard, the deploy smoke check and the
// runtime banner. The finding was that a production build without
// VITE_SUPABASE_URL renders a complete-looking product that persists nothing,
// and no client-end signal disagreed.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('a production build with an unmet client contract is refused', () => {
  const verdict = evaluateClientEnv({ CONTEXT: 'production' });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.enforced, true);
  assert.deepEqual(verdict.missing, ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']);
});

test('a dev or deploy-preview build warns but continues', () => {
  for (const context of ['deploy-preview', 'branch-deploy', 'dev', undefined]) {
    const verdict = evaluateClientEnv({ CONTEXT: context });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.enforced, false, `CONTEXT=${context} must not fail a preview build`);
  }
});

test('the release pipeline can opt in to strictness explicitly', () => {
  const verdict = evaluateClientEnv({ EDUREACH_REQUIRE_CLIENT_ENV: '1' });
  assert.equal(verdict.enforced, true);
});

test('either publishable key name satisfies the contract', () => {
  const url = { VITE_SUPABASE_URL: 'https://example.supabase.co' };
  assert.equal(evaluateClientEnv({ ...url, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }).ok, true);
  assert.equal(evaluateClientEnv({ ...url, VITE_SUPABASE_ANON_KEY: 'eyJhbGciOi' }).ok, true);
  assert.equal(evaluateClientEnv(url).ok, false);
});

test('the build script runs the guard before bundling', () => {
  const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
  assert.match(scripts.build, /^tsx scripts\/client-env-check\.ts && vite build/);
  assert.equal(scripts.smoke, 'tsx scripts/smoke-check.ts');
});

test('the smoke check only passes on an explicit ready', () => {
  assert.equal(evaluateReady(200, { status: 'ready' }).ok, true);
  // A 200 that does not say ready must not pass: the check exists to tell.
  assert.equal(evaluateReady(200, { status: 'degraded' }).ok, false);
  assert.equal(evaluateReady(503, { status: 'degraded' }).ok, false);
  assert.equal(evaluateReady(200, {}).ok, false);
  const degraded = evaluateReady(503, {
    status: 'degraded',
    checks: { server: { ok: true }, supabase_configured: { ok: false, detail: 'VITE_SUPABASE_URL is missing.' } },
  });
  assert.equal(degraded.ok, false);
  assert.match(degraded.detail, /supabase_configured/);
  assert.match(degraded.detail, /VITE_SUPABASE_URL is missing/);
});

test('the banner is production-only and keyed to the client contract', () => {
  const banner = read('src/components/EnvironmentBanner.tsx');
  assert.match(banner, /import\.meta\.env\?\.PROD/);
  assert.match(banner, /isSupabaseConfigured/);
  assert.match(banner, /role="status"/, 'the banner is announced politely, not as an alert');
  // The banner must not leak configuration detail to visitors.
  assert.doesNotMatch(banner, /VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(read('src/app/App.tsx'), /<EnvironmentBanner \/>/);
});
