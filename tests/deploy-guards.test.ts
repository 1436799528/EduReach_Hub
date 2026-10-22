import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

// --- ENV-1: the guard must read the same environment the bundler reads --------
//
// `vite build` loads `.env` from the project root. The guard only read
// `process.env`, so on a correctly configured machine `npm run build` printed
// "Missing: VITE_SUPABASE_URL, …" and a production-context build refused to run.
// These tests spawn the real script in a throwaway directory so the behaviour of
// the file-reading layer is covered, not just the pure verdict function.

function runGuard(cwd: string, extraEnv: Record<string, string>): { code: number | null; output: string } {
  const env: Record<string, string | undefined> = { ...process.env, ...extraEnv };
  // The sandbox may itself export these; the test is about the .env file.
  for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY', 'CONTEXT', 'NETLIFY_CONTEXT', 'EDUREACH_REQUIRE_CLIENT_ENV']) {
    if (!(name in extraEnv)) delete env[name];
  }
  // Resolve the loader by path: the child runs with `cwd` set to the throwaway
  // directory, where a bare 'tsx' specifier would not resolve.
  const loader = pathToFileURL(join(root, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href;
  const result = spawnSync(process.execPath, ['--import', loader, join(root, 'scripts', 'client-env-check.ts')], {
    cwd,
    env: env as NodeJS.ProcessEnv,
    encoding: 'utf8',
  });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

function withEnvDir<T>(envBody: string | null, run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'edureach-client-env-'));
  try {
    if (envBody !== null) writeFileSync(join(dir, '.env'), envBody, 'utf8');
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const COMPLETE_ENV_FILE = [
  'VITE_SUPABASE_URL=https://exampleproject.supabase.co',
  'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_not_a_secret',
  '',
].join('\n');

test('a complete .env satisfies the guard even when process.env is empty', () => {
  withEnvDir(COMPLETE_ENV_FILE, (dir) => {
    const { code, output } = runGuard(dir, {});
    assert.equal(code, 0, `the guard failed on a complete .env:\n${output}`);
    assert.match(output, /client Supabase contract is satisfied/);
    assert.doesNotMatch(output, /Missing:/, 'a configured checkout must not be told it is missing variables');
  });
});

test('a production-context build from a .env-configured checkout is not refused', () => {
  withEnvDir(COMPLETE_ENV_FILE, (dir) => {
    const { code, output } = runGuard(dir, { CONTEXT: 'production' });
    assert.equal(code, 0, `CONTEXT=production failed on a complete .env:\n${output}`);
    assert.doesNotMatch(output, /FAIL/);
  });
});

test('without a .env a production build still refuses, and says what is missing', () => {
  withEnvDir(null, (dir) => {
    const { code, output } = runGuard(dir, { CONTEXT: 'production' });
    assert.equal(code, 1, 'the guard must still fail a genuinely unconfigured production build');
    assert.match(output, /Missing: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY/);
  });
});

test('a real environment variable is not overridden by a stale .env', () => {
  // Netlify supplies the variable in the build environment; a leftover .env in a
  // deploy image must not take precedence over it.
  withEnvDir('VITE_SUPABASE_URL=\n', (dir) => {
    const { code, output } = runGuard(dir, {
      CONTEXT: 'production',
      VITE_SUPABASE_URL: 'https://from-the-environment.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_from_the_environment',
    });
    assert.equal(code, 0, `the environment must win over .env:\n${output}`);
  });
});
