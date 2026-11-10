// Pure configuration tests only; these never contact Auth, PostgREST or PostgreSQL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { realSupabaseConfig } from '../cbt-real-supabase-safety.mjs';

const base = {
  CBT_REAL_TARGET: 'local', CBT_REAL_DISPOSABLE_ACK: 'DEDICATED_EMPTY_DISPOSABLE_PROJECT',
  CBT_REAL_ROLLBACK_ACK: 'BACKUP_VERIFIED_AND_ROLLBACK_AUTHORIZED',
  CBT_REAL_MIGRATIONS_ACK: 'RECONCILED_ALL_MIGRATION_FILES_AND_DUPLICATE_VERSIONS',
  CBT_REAL_SUPABASE_URL: 'http://127.0.0.1:54321',
  CBT_REAL_DATABASE_URL: 'postgresql://postgres:test-only@127.0.0.1:54322/postgres',
  CBT_REAL_DB_SYSTEM_ID: '1234567890123456789', CBT_REAL_ANON_KEY: 'test-anon-key',
  CBT_REAL_SERVICE_KEY: 'test-service-key', CBT_REAL_PG_MODULE: '/tmp/pg/lib/index.js',
};
const refuse = overrides => assert.throws(() => realSupabaseConfig({ ...base, ...overrides }), /preflight refused/);

test('valid explicit loopback configuration parses without network', () => {
  assert.equal(realSupabaseConfig(base).mode, 'local');
});
test('requires both acknowledgements and distinct keys', () => {
  for (const key of ['CBT_REAL_DISPOSABLE_ACK', 'CBT_REAL_ROLLBACK_ACK', 'CBT_REAL_MIGRATIONS_ACK', 'CBT_REAL_DB_SYSTEM_ID', 'CBT_REAL_PG_MODULE']) refuse({ [key]: '' });
  refuse({ CBT_REAL_SERVICE_KEY: base.CBT_REAL_ANON_KEY });
});
test('refuses remote, ambiguous, overridden or incorrectly named local targets', () => {
  refuse({ CBT_REAL_SUPABASE_URL: 'http://localhost:54321' });
  refuse({ CBT_REAL_SUPABASE_URL: 'http://127.0.0.1:54321/path' });
  refuse({ CBT_REAL_DATABASE_URL: 'postgresql://postgres:x@localhost:54322/postgres' });
  refuse({ CBT_REAL_DATABASE_URL: 'postgresql://postgres:x@127.0.0.1:54322/other' });
  refuse({ CBT_REAL_DATABASE_URL: 'postgresql://postgres:x@127.0.0.1:54322/postgres?host=elsewhere' });
  refuse({ CBT_REAL_DATABASE_URL: 'postgresql://postgres:x@127.0.0.1:54322/postgres?sslmode=disable&sslmode=require' });
});
test('rejects ambient injection and production mode', () => {
  for (const env of [{ PGHOST: 'remote' }, { DATABASE_URL: 'remote' }, { HTTPS_PROXY: 'remote' }, { NODE_OPTIONS: '--require=x' }, { NODE_ENV: 'production' }, { CONTEXT: 'production' }]) refuse(env);
});
test('staging requires a matching nonproduction ref, full TLS and explicit hosted permission', () => {
  const ref = 'abcdefghijklmnopqrst';
  const staging = { ...base, CBT_REAL_TARGET: 'staging', CBT_REAL_STAGING_REF: ref,
    CBT_REAL_SUPABASE_URL: `https://${ref}.supabase.co`,
    CBT_REAL_DATABASE_URL: `postgresql://postgres:test-only@db.${ref}.supabase.co:5432/postgres?sslmode=verify-full`,
    CBT_REAL_HOSTED_AUTHORIZATION: 'SEPARATELY_AUTHORIZED_HOSTED_TEST_AND_ROLLBACK' };
  assert.equal(realSupabaseConfig(staging).mode, 'staging');
  for (const change of [
    { CBT_REAL_HOSTED_AUTHORIZATION: '' }, { CBT_REAL_STAGING_REF: 'gjdfatwcoosyuhakrrhh' },
    { CBT_REAL_STAGING_REF: 'differentproject0000' }, { CBT_REAL_SUPABASE_URL: 'https://gjdfatwcoosyuhakrrhh.supabase.co' },
    { CBT_REAL_DATABASE_URL: `postgresql://postgres:x@db.${ref}.supabase.co/postgres?sslmode=require` },
    { CBT_REAL_DATABASE_URL: 'postgresql://postgres:x@127.0.0.1:54322/postgres?sslmode=verify-full' },
  ]) assert.throws(() => realSupabaseConfig({ ...staging, ...change }), /preflight refused/);
});
test('runner with clean empty environment fails before network and does not report success', () => {
  const result = spawnSync(process.execPath, ['scripts/rehearse-cbt-real-supabase.mjs'], { cwd: process.cwd(), env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '' }, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /preflight refused: missing CBT_REAL_TARGET/);
  assert.doesNotMatch(result.stdout, /PASS:/);
});
test('real runner fails closed if its explicitly supplied PostgreSQL driver is unavailable', () => {
  const result = spawnSync(process.execPath, ['scripts/rehearse-cbt-real-supabase.mjs'], { cwd: process.cwd(), env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '', ...base, CBT_REAL_PG_MODULE: '/nonexistent/cbt-pg-driver.js' }, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /FAILED at load PostgreSQL driver/);
  assert.doesNotMatch(result.stdout, /PASS:/);
});
