import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { assertDisposableDatabase, assertDisposableEnvironment } from '../scripts/cbt-disposable-safety.mjs';

test('disposable preflight refuses hosted, credential, proxy and database environment', () => {
  const names = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'DATABASE_PUBLIC_URL', 'DB_HOST', 'PGHOST', 'PGSERVICE', 'PGOPTIONS', 'HTTP_PROXY', 'https_proxy', 'ALL_PROXY', 'NO_PROXY', 'GLOBAL_AGENT_HTTP_PROXY', 'npm_config_proxy', 'NODE_OPTIONS', 'NODE_USE_ENV_PROXY', 'NODE_EXTRA_CA_CERTS', 'DOTENV_CONFIG_PATH', 'AWS_SECRET_ACCESS_KEY', 'GH_TOKEN', 'NETLIFY', 'CBT_V2_LOCAL_REHEARSAL'];
  for (const name of names) assert.throws(() => assertDisposableEnvironment({ [name]: 'synthetic-unsafe' }), /refused/i, name);
  assert.throws(() => assertDisposableEnvironment({ NODE_ENV: 'production' }), /refused/i);
  assert.throws(() => assertDisposableEnvironment({ CONTEXT: 'production' }), /refused/i);
  assert.doesNotThrow(() => assertDisposableEnvironment({ NODE_ENV: 'test', PATH: '/usr/bin' }));
});

test('database identity requires exact fresh directory and private socket with TCP disabled', () => {
  const valid = { data_directory: '/tmp/fresh/db', socket_directories: '/tmp/fresh', listen_addresses: '', server_address: null, database_name: 'postgres' };
  assert.doesNotThrow(() => assertDisposableDatabase(valid, '/tmp/fresh/db', '/tmp/fresh'));
  for (const bad of [{ ...valid, data_directory: '/other/db' }, { ...valid, socket_directories: '/other/socket' }, { ...valid, listen_addresses: 'localhost' }, { ...valid, server_address: '127.0.0.1' }, { ...valid, database_name: 'production' }, null]) {
    assert.throws(() => assertDisposableDatabase(bad, '/tmp/fresh/db', '/tmp/fresh'), /refused/i);
  }
});

test('rehearsal refuses unsafe configuration before loading the supplied module', () => {
  for (const script of ['scripts/rehearse-cbt-protocol-fence.mjs', 'scripts/rehearse-cbt-writing-sessions.mjs', 'scripts/rehearse-cbt-http-boundary.mjs']) {
    for (const [name, value] of [['VITE_SUPABASE_URL', 'https://hosted.invalid'], ['PGHOST', 'unsafe-db'], ['HTTP_PROXY', 'http://unsafe-proxy.invalid'], ['SUPABASE_SERVICE_ROLE_KEY', 'synthetic-secret-do-not-print']]) {
      const result = spawnSync(process.execPath, [script, '/nonexistent/should-not-load.mjs'], { encoding: 'utf8', env: { PATH: process.env.PATH, [name]: value } });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Disposable CBT rehearsal refused/);
      assert.doesNotMatch(result.stderr, /should-not-load|synthetic-secret-do-not-print|unsafe-proxy|hosted\.invalid|unsafe-db/);
    }
  }
});
