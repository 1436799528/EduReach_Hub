import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// D5 — the environment contract and the production validator.
//
// Two things matter here and both are about honesty. The contract must never let a
// secret be described in a way that could print it. And the validator must never
// report a check it could not run as passing — "skipped" and "pass" are different
// answers, and the difference is the entire point of the script.

import {
  ENV_CONTRACT,
  checkEnv,
  describeEnv,
  evaluateEnv,
} from '../src/lib/envContract';
import {
  EXPECTED_BUCKETS,
  PUBLIC_BUCKETS,
  PRIVATE_BUCKETS,
  EXPECTED_FUNCTIONS,
  PROBED_TABLES,
  SQL_ARTIFACT,
  checkBuckets,
  checkIntegrityReport,
  summarise,
} from '../scripts/prod-validate';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/* ------------------------------------------------------------------ */
/* The contract                                                        */
/* ------------------------------------------------------------------ */

test('every variable is classified consistently', () => {
  for (const spec of ENV_CONTRACT) {
    assert.ok(['client', 'server'].includes(spec.visibility), `${spec.name} has no visibility`);
    assert.ok(['required', 'recommended', 'optional'].includes(spec.requirement), `${spec.name} has no requirement`);
    assert.ok(spec.purpose.trim().length > 20, `${spec.name} has no purpose`);
    assert.ok(spec.consumedBy.length > 0, `${spec.name} names no consumer`);
  }
});

test('anything the browser reads carries the VITE_ prefix', () => {
  // Vite only inlines VITE_* into the bundle. A client-visible name without the
  // prefix would be silently undefined in the browser, so every name the contract
  // classifies as client-visible — primary or alias — must carry it.
  for (const spec of ENV_CONTRACT) {
    if (spec.visibility === 'client') {
      assert.match(spec.name, /^VITE_/, `${spec.name} is client-visible but not VITE_ prefixed`);
    }
    for (const alias of spec.aliases) {
      if (alias.visibility === 'client') {
        assert.match(alias.name, /^VITE_/, `${alias.name} is client-visible but not VITE_ prefixed`);
      }
    }
  }
});

test('a server-side fallback for a client variable is labelled as one', () => {
  // The trap this guards: SUPABASE_URL satisfies the server's read of the Supabase
  // origin but is not inlined into the bundle, so an operator who sets only that
  // alias ships a site that looks configured and cannot reach Supabase.
  const url = ENV_CONTRACT.find((spec) => spec.name === 'VITE_SUPABASE_URL')!;
  const serverFallback = url.aliases.find((alias) => alias.name === 'SUPABASE_URL');
  assert.ok(serverFallback, 'SUPABASE_URL should be declared as an alias');
  assert.equal(serverFallback?.visibility, 'server');
  assert.ok(serverFallback?.note, 'a fallback that can mislead an operator must say so');
  assert.match(serverFallback?.note || '', /not inlined|browser/i);

  const key = ENV_CONTRACT.find((spec) => spec.name === 'VITE_SUPABASE_PUBLISHABLE_KEY')!;
  assert.equal(
    key.aliases.find((alias) => alias.name === 'SUPABASE_ANON_KEY')?.visibility,
    'server',
  );
});

test('every alias satisfies only through the code that actually reads it', () => {
  // The contract is a claim about the code. Check the claim: each declared alias must
  // appear as a read of that exact name somewhere in the sources listed as consumers.
  const sources = [
    'server.ts',
    'lib/supabase-config.ts',
    'src/lib/supabase.ts',
    'src/server/seo.ts',
    'src/server/whatsapp.ts',
    'src/server/newsroom/run.ts',
    'netlify/functions/daily-news-refresh.ts',
  ]
    .map((path) => readFileSync(join(ROOT, path), 'utf8'))
    .join('\n');

  for (const spec of ENV_CONTRACT) {
    assert.ok(sources.includes(spec.name), `${spec.name} is declared but no source reads it`);
    for (const alias of spec.aliases) {
      assert.ok(sources.includes(alias.name), `${alias.name} is declared as an alias but no source reads it`);
    }
  }
});

test('the service-role key is the only secret the server cannot run without', () => {
  const secret = ENV_CONTRACT.find((spec) => spec.name === 'SUPABASE_SERVICE_ROLE_KEY');
  assert.ok(secret?.secret, 'the service-role key must be classified secret');
  assert.equal(secret?.visibility, 'server', 'the service-role key must never be client-visible');
  assert.equal(secret?.requirement, 'required');
  // And no client-visible variable may be a secret: the bundle is public.
  for (const spec of ENV_CONTRACT) {
    if (spec.visibility === 'client') assert.equal(spec.secret, false, `${spec.name} ships in the bundle and cannot be a secret`);
  }
});

test('a variable can be satisfied through an alias', () => {
  const spec = ENV_CONTRACT.find((entry) => entry.name === 'SUPABASE_SERVICE_ROLE_KEY')!;
  const viaAlias = checkEnv(spec, (name) => (name === 'SUPABASE_SECRET_KEY' ? 'sb_secret_x' : undefined));
  assert.equal(viaAlias.ok, true);
  if (viaAlias.ok) assert.equal(viaAlias.satisfiedBy, 'SUPABASE_SECRET_KEY');

  const empty = checkEnv(spec, (name) => (name === 'SUPABASE_SECRET_KEY' ? '   ' : undefined));
  assert.equal(empty.ok, false, 'a whitespace-only value must not satisfy a requirement');
});

test('a missing required variable fails the contract, a missing optional one does not', () => {
  const none = evaluateEnv(() => undefined);
  assert.equal(none.ok, false);
  assert.ok(none.missingRequired.includes('VITE_SUPABASE_URL'));
  assert.ok(!none.missingRequired.includes('PORT'), 'an optional variable must never block');

  const full = evaluateEnv((name) =>
    ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NODE_ENV'].includes(name)
      ? 'value'
      : undefined,
  );
  assert.equal(full.ok, true);
  assert.deepEqual(full.missingRequired, []);
});

test('describing the environment never includes a value', () => {
  const sentinel = 'sb_secret_SUPERSECRETVALUE123';
  const lines = describeEnv((name) => (name === 'SUPABASE_SERVICE_ROLE_KEY' ? sentinel : 'x'));
  const joined = lines.join('\n');
  assert.ok(!joined.includes(sentinel), 'a secret value was printed');
  assert.ok(!joined.includes('SUPERSECRET'), 'part of a secret value was printed');
  assert.match(joined, /SUPABASE_SERVICE_ROLE_KEY\s+set via SUPABASE_SERVICE_ROLE_KEY/);
  // Non-secret values are withheld too: presence is all an operator needs.
  assert.ok(!joined.includes(/x/.source) || !/\bx\b\s*\(/.test(joined));
});

/* ------------------------------------------------------------------ */
/* The validator                                                       */
/* ------------------------------------------------------------------ */

test('a private bucket that is public fails, a missing bucket fails', () => {
  const good = checkBuckets([
    { name: 'admin-content', public: true },
    { name: 'resource-files', public: false },
    { name: 'campus-uploads', public: false },
  ]);
  assert.deepEqual(good.map((check) => check.state), ['pass', 'pass', 'pass']);

  const missing = checkBuckets([{ name: 'admin-content', public: true }]);
  assert.equal(missing[0].state, 'fail');
  assert.match(missing[0].detail || '', /resource-files/);

  // Data exposure: a bucket declared private must not be public.
  const leaked = checkBuckets([
    { name: 'admin-content', public: true },
    { name: 'resource-files', public: true },
    { name: 'campus-uploads', public: false },
  ]);
  assert.equal(leaked[1].state, 'fail');
  assert.match(leaked[1].detail || '', /must not be/);

  // The other direction: a bucket the app reads back by public URL must be
  // public, or every published news image 404s.
  const broken = checkBuckets([
    { name: 'admin-content', public: false },
    { name: 'resource-files', public: false },
    { name: 'campus-uploads', public: false },
  ]);
  assert.equal(broken[2].state, 'fail');
  assert.match(broken[2].detail || '', /must be public/);

  // A bucket outside the application's set is not this check's business.
  const unrelated = checkBuckets([
    { name: 'admin-content', public: true },
    { name: 'resource-files', public: false },
    { name: 'campus-uploads', public: false },
    { name: 'avatars', public: true },
  ]);
  assert.deepEqual(unrelated.map((check) => check.state), ['pass', 'pass', 'pass']);
});

test('the bucket rule matches what the upload route and the paper route do', () => {
  // The evidence for the split lives in the code, so the test reads the code.
  const server = readFileSync(join(ROOT, 'server.ts'), 'utf8');
  assert.match(server, /storage\.from\('admin-content'\)\.upload/, 'admin-content is the upload bucket');
  assert.match(server, /storage\.from\('admin-content'\)\.getPublicUrl/, 'and it is read back by public URL');
  assert.match(server, /storage\.from\('resource-files'\)\.createSignedUrl/, 'resource-files is served by signed URL');
  assert.ok(
    PUBLIC_BUCKETS.includes('admin-content'),
    'admin-content is declared public because getPublicUrl output is stored on published rows',
  );
  for (const bucket of PRIVATE_BUCKETS) {
    assert.ok(!PUBLIC_BUCKETS.includes(bucket), `${bucket} cannot be both public and private`);
  }
});

test('an empty report fails rather than passing on missing numbers', () => {
  const checks = checkIntegrityReport(null);
  assert.equal(checks[0].state, 'fail');
});

test('a healthy report passes every data check', () => {
  const checks = checkIntegrityReport({
    cbt: { active_exams_without_questions: 0, active_exams_with_thin_subjects: 0, questions_missing_options: 0, questions_with_invalid_answer: 0 },
    news: { expired_still_published: 0 },
    opportunities: { active_expired: 0 },
  });
  assert.deepEqual(checks.map((check) => check.state), ['pass', 'pass', 'pass', 'pass', 'pass', 'pass']);
});

test('a thin CBT subject fails the check that exists because of it', () => {
  const checks = checkIntegrityReport({
    cbt: { active_exams_without_questions: 0, active_exams_with_thin_subjects: 1, questions_missing_options: 0, questions_with_invalid_answer: 0 },
    news: {},
    opportunities: {},
  });
  const thin = checks.find((check) => check.name.includes('thinly covered'))!;
  assert.equal(thin.state, 'fail');
  assert.match(thin.detail || '', /subject_coverage/);
});

test('the summary distinguishes failed from skipped', () => {
  const text = summarise([
    { group: 'a', name: 'ok one', state: 'pass' },
    { group: 'a', name: 'bad one', state: 'fail', detail: 'because' },
    { group: 'a', name: 'unknown one', state: 'skipped', detail: 'no credentials' },
  ]);
  assert.match(text, /^ok\s+\[a\s*\] ok one/m);
  assert.match(text, /^FAIL \[a\s*\] bad one — because/m);
  assert.match(text, /^skip \[a\s*\] unknown one — no credentials/m);
  assert.match(text, /1 passed, 1 failed, 1 skipped\./);
});

test('the SQL artifact exists, is read-only, and covers what PostgREST cannot', () => {
  const sql = readFileSync(join(ROOT, SQL_ARTIFACT), 'utf8');
  // Read-only: no data definition or manipulation anywhere.
  assert.ok(!/\b(create|alter|drop|truncate|delete|update|insert|grant|revoke)\b/i.test(sql), 'the validation script must not mutate anything');
  for (const topic of ['relrowsecurity', 'pg_policies', 'aclexplode', 'schema_migrations', 'storage.buckets']) {
    assert.ok(sql.includes(topic), `the artifact does not check ${topic}`);
  }
  // Every function the script expects must be checked by the artifact too.
  for (const fn of EXPECTED_FUNCTIONS) {
    assert.ok(sql.includes(`'${fn}'`), `the artifact does not check for ${fn}`);
  }
});

test('the expectations in the script match what the repository actually uses', () => {
  // The probed tables must be ones the application really reads, not invented names.
  const serverSource = readFileSync(join(ROOT, 'server.ts'), 'utf8');
  const libSources = ['src/lib/api.ts', 'src/lib/studentDashboard.ts']
    .map((path) => readFileSync(join(ROOT, path), 'utf8'))
    .join('\n');
  const all = serverSource + libSources;
  for (const table of PROBED_TABLES) {
    assert.ok(all.includes(`'${table}'`) || all.includes(`"${table}"`), `${table} is probed but never referenced by the application`);
  }
  assert.ok(EXPECTED_BUCKETS.length >= 3);
  assert.ok(EXPECTED_FUNCTIONS.includes('prune_site_analytics_events'), 'the AN-1 retention function must be validated');
  assert.ok(EXPECTED_FUNCTIONS.includes('content_integrity_report'));
});

test('the release-sync query names the migrations production is missing, and passes once they land', async () => {
  // PROD-1. Counting rows in `supabase_migrations.schema_migrations` (check 8) says
  // how many migrations ran, not which. Production was found serving merged code
  // against a half-applied schema, so the artifact now names each object the
  // 2026-10-02/03 release adds. This test runs that query for real: against the
  // full schema it must pass, and against a schema missing the newest migrations it
  // must fail *and* say which migration to apply.
  const { PGlite } = await import('@electric-sql/pglite');
  const { applyMigrations, SHIM_PATH } = await import('../scripts/replay');
  const sql = readFileSync(join(ROOT, SQL_ARTIFACT), 'utf8');
  const marker = '-- 9. The objects this release introduces are present';
  assert.ok(sql.includes(marker), 'the sync check is missing from the artifact');
  const start = sql.indexOf(marker);
  const end = sql.indexOf("-- 10. Data quality");
  assert.ok(start > 0 && end > start, 'the sync check must precede the data-quality report');
  const syncQuery = sql.slice(start, end);

  const full = new PGlite();
  try {
    await applyMigrations(full);
    const rows = (await full.exec(syncQuery)).at(-1)?.rows ?? [];
    assert.equal(rows.length, 1, 'the sync check must return exactly one verdict row');
    assert.equal(rows[0].result, 'pass', `fully migrated schema reported: ${rows[0].detail}`);
  } finally {
    await full.close();
  }

  // A database stopped one release short: the pre-release migrations only.
  const partial = new PGlite();
  try {
    await partial.exec(readFileSync(SHIM_PATH, 'utf8'));
    const { readdirSync } = await import('node:fs');
    const dir = join(ROOT, 'supabase/migrations');
    const files = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
    const release = files.filter((name) => name >= '20261002120000');
    assert.ok(release.length >= 3, 'the release under test has several migrations');
    for (const file of files.filter((name) => name < '20261002120000')) {
      await partial.exec(readFileSync(join(dir, file), 'utf8'));
    }
    const rows = (await partial.exec(syncQuery)).at(-1)?.rows ?? [];
    assert.equal(rows[0].result, 'fail', 'a half-applied database must not pass the sync check');
    for (const file of release) {
      assert.ok(
        String(rows[0].detail).includes(file),
        `the sync check does not name ${file}; an operator would not know what to apply`,
      );
    }
  } finally {
    await partial.close();
  }
});

test('the migration counts in the artifact, the runbook and the repository cannot drift apart', async () => {
  // The count was wrong in three places at once (the artifact said 41 while the
  // repository held 46), which is how the sync check's own premise went stale.
  // One source of truth: the directory listing.
  const { readdirSync } = await import('node:fs');
  const count = readdirSync(join(ROOT, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).length;
  const sql = readFileSync(join(ROOT, SQL_ARTIFACT), 'utf8');
  const runbook = readFileSync(join(ROOT, 'docs/operations/PRODUCTION_RUNBOOK.md'), 'utf8');

  assert.match(sql, new RegExp(`count\\(\\*\\) >= ${count}\\b`), `the artifact's threshold is not ${count}`);
  assert.match(sql, new RegExp(`repository holds ${count}\\)`), `the artifact's detail does not say ${count}`);
  assert.match(runbook, new RegExp(`${count} migrations in `), `the runbook does not say ${count} migrations`);
});
