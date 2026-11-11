import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { evaluateClientEnv } from '../scripts/client-env-check';

const root = resolve(import.meta.dirname, '..');
const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const config = join(root, 'vite.config.ts');
const opaque = 'sb_secret_synthetic_test_value_only';
const serviceJwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
const anonJwt = `header.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`;

test('client environment guard rejects privileged values even in preview and unused VITE variables', () => {
  for (const value of [opaque, serviceJwt]) {
    const result = evaluateClientEnv({ VITE_SUPABASE_URL: 'https://example.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', VITE_UNUSED: value });
    assert.equal(result.ok, false);
    assert.equal(result.enforced, true);
    assert.equal(result.privilegedClientValue, true);
    assert.equal(evaluateClientEnv({ VITE_SUPABASE_URL: 'https://example.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', VITE_EMBEDDED: `url?key=${value}&other=1` }).ok, false);
  }
  assert.equal(evaluateClientEnv({ VITE_SUPABASE_URL: 'https://example.test', VITE_SUPABASE_PUBLISHABLE_KEY: anonJwt }).ok, true);
  assert.equal(evaluateClientEnv({ VITE_SUPABASE_URL: 'https://example.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: opaque }).ok, true);
  for (const name of ['VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE', 'VITE_SUPABASE_SECRET_KEY', 'VITE_SUPABASE_SERVICE_KEY', 'VITE_PRIVATE_KEY', 'VITE_CLIENT_SECRET']) {
    assert.equal(evaluateClientEnv({ VITE_SUPABASE_URL: 'https://example.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', [name]: 'unrecognized-synthetic-value' }).ok, false, name);
  }
  assert.equal(evaluateClientEnv({ VITE_SUPABASE_URL: 'https://example.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', VITE_SUPABASE_SECRET_KEY: '' }).ok, true);
  assert.equal(evaluateClientEnv({ CONTEXT: opaque, VERCEL_ENV: 'production' }).reason, 'Vercel production build');
  assert.equal(evaluateClientEnv({ CONTEXT: 'production' }).reason, 'Vercel production build');
});

test('direct Vite build and dev refuse privileged process and mode-file values before emitting client assets', () => {
  for (const [command, fromFile, value] of [['build', false, opaque], ['build', true, serviceJwt], ['dev', true, opaque]] as const) {
    const dir = mkdtempSync(join(tmpdir(), 'edureach-client-secret-test-'));
    try {
      if (fromFile) writeFileSync(join(dir, '.env.testmode.local'), `VITE_ANOTHER_SETTING=${value}\n`);
      const env = { PATH: process.env.PATH, HOME: process.env.HOME, ...(fromFile ? {} : { VITE_SUPABASE_ANON_KEY: value }) };
      const outputDir = join(dir, 'output');
      const args = command === 'build'
        ? [vite, 'build', dir, '--mode', 'testmode', '--config', config, '--outDir', outputDir]
        : [vite, dir, '--mode', 'testmode', '--config', config];
      const result = spawnSync(process.execPath, args, { cwd: dir, env, encoding: 'utf8', timeout: 20000 });
      assert.equal(result.status, 1, `${command} must fail before serving or building`);
      const output = `${result.stdout}${result.stderr}`;
      assert.match(output, /privileged Supabase key/i);
      assert.ok(!output.includes(value), 'the diagnostic must not print the key');
      assert.equal(existsSync(outputDir), false, 'no client assets should be emitted');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('production refuses secret-like public names, and resolved mode values follow Vite precedence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'edureach-production-env-'));
  try {
    writeFileSync(join(dir, 'index.html'), '<script type="module" src="/main.js"></script>');
    writeFileSync(join(dir, 'main.js'), 'document.body.textContent = JSON.stringify(import.meta.env);');
    writeFileSync(join(dir, '.env.production'), `VITE_OTHER=${opaque}\n`);
    const args = [vite, 'build', dir, '--mode', 'production', '--config', config, '--outDir', join(dir, 'output')];
    const baseEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
    const bad = spawnSync(process.execPath, args, { cwd: dir, env: baseEnv, encoding: 'utf8', timeout: 20000 });
    assert.equal(bad.status, 1);
    assert.match(`${bad.stdout}${bad.stderr}`, /privileged Supabase key/i);
    assert.ok(!`${bad.stdout}${bad.stderr}`.includes(opaque));
    const named = spawnSync(process.execPath, args, { cwd: dir, env: { ...baseEnv, VITE_OTHER: 'safe-value', VITE_SUPABASE_SERVICE_ROLE_KEY: 'unknown_synthetic' }, encoding: 'utf8', timeout: 20000 });
    assert.equal(named.status, 1);
    assert.ok(!`${named.stdout}${named.stderr}`.includes('unknown_synthetic'));
    const safe = spawnSync(process.execPath, args, { cwd: dir, env: { ...baseEnv, VITE_OTHER: 'safe-value', SUPABASE_SERVICE_ROLE_KEY: opaque }, encoding: 'utf8', timeout: 20000 });
    assert.equal(safe.status, 0, `${safe.stdout}${safe.stderr}`);
    const assets = join(dir, 'output', 'assets');
    const bundle = readdirSync(assets).map(name => readFileSync(join(assets, name), 'utf8')).join('\n');
    assert.ok(!bundle.includes(opaque), 'the server-only key and overridden mode-file key never enter the bundle');
    assert.ok(bundle.includes('safe-value'), 'the process value wins over the mode file');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('application development startup refuses a synthetic privileged client value', () => {
  const loader = join(root, 'node_modules', 'tsx', 'dist', 'loader.mjs');
  const result = spawnSync(process.execPath, ['--import', loader, join(root, 'server.ts')], {
    cwd: root,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'development', DISABLE_HMR: 'true', VITE_SUPABASE_SERVICE_ROLE_KEY: opaque },
    encoding: 'utf8', timeout: 20000,
  });
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(result.status, 1, 'development server must not start');
  assert.match(output, /privileged Supabase key/i);
  assert.doesNotMatch(output, /EduReach server running on port/);
  assert.ok(!output.includes(opaque));
});

test('the pre-build script refuses a synthetic secret without printing it', () => {
  const loader = join(root, 'node_modules', 'tsx', 'dist', 'loader.mjs');
  const result = spawnSync(process.execPath, ['--import', loader, join(root, 'scripts', 'client-env-check.ts')], {
    cwd: root,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, VITE_SUPABASE_URL: 'https://example.test', VITE_SUPABASE_PUBLISHABLE_KEY: opaque },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, /privileged Supabase key/i);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(opaque));
  const missing = spawnSync(process.execPath, ['--import', loader, join(root, 'scripts', 'client-env-check.ts')], {
    cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME, CONTEXT: opaque, VERCEL_ENV: 'production' }, encoding: 'utf8',
  });
  assert.equal(missing.status, 1);
  assert.ok(!`${missing.stdout}${missing.stderr}`.includes(opaque));
});
