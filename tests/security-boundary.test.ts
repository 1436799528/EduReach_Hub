import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import {
  ENV_CONTRACT,
  serverOnlyEnvNames,
  validateEnvContract,
  type EnvClassification,
} from '../src/lib/envContract';
import { findClientExposures, hasPrivilegedClientValue } from '../scripts/client-secret-guard';
import { globToRegExp, loadAllowlist, scanRepository } from '../scripts/security-scan';
import { scanArtifactText, scanDirectory, serverOnlyValues } from '../scripts/dist-secret-scan';
import { looksHighEntropy, maskValue } from '../scripts/security/patterns';

// The 2026-11-23 security boundary. Two failures motivated this file:
//
//  1. A production deploy failed because an audit document contained a live
//     deployment value (a project origin and an administrative email address).
//     Nothing in the test suite noticed that documented values are public output.
//  2. The client-side guard refused privileged *Supabase* keys but had no opinion
//     about a SendGrid key, an OAuth client secret, a database URL with a
//     password, or a variable whose *name* promised an administrative identity.
//
// Each test below corresponds to a way the boundary can be crossed again.

const ROOT = resolve(import.meta.dirname, '..');

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

// --- 1. The classification table -------------------------------------------

test('the environment contract is internally consistent', () => {
  assert.deepEqual(validateEnvContract(), []);
});

test('every VITE_ variable is classified PUBLIC', () => {
  // Vite inlines these into the bundle. A non-public classification is a lie the
  // build cannot detect, so the contract itself refuses it.
  for (const spec of ENV_CONTRACT) {
    for (const name of [spec.name, ...spec.aliases.map((alias) => alias.name)]) {
      if (!name.startsWith('VITE_')) continue;
      assert.equal(spec.classification, 'PUBLIC', `${name} must be PUBLIC`);
    }
  }
});

test('the admin bootstrap address is sensitive operational configuration, not public config', () => {
  const spec = ENV_CONTRACT.find((entry) => entry.name === 'EDUREACH_ADMIN_BOOTSTRAP_EMAIL');
  assert.ok(spec, 'the bootstrap address must be declared');
  assert.equal(spec?.classification, 'SENSITIVE_OPERATIONAL');
  assert.equal(spec?.visibility, 'server');
  assert.equal(spec?.scope, 'function', 'it belongs to the function that reads it, not the build');
  assert.ok(!spec?.name.startsWith('VITE_'));
});

test('no server-only variable is declared client-visible or build-scoped by accident', () => {
  const forbidden: EnvClassification[] = ['SECRET', 'SENSITIVE_OPERATIONAL'];
  for (const spec of ENV_CONTRACT.filter((entry) => forbidden.includes(entry.classification))) {
    assert.equal(spec.visibility, 'server', `${spec.name} must be server-visible only`);
    assert.notEqual(spec.scope, 'build', `${spec.name} must not be scoped to the build`);
  }
  const serverOnly = serverOnlyEnvNames();
  assert.ok(serverOnly.includes('EDUREACH_ADMIN_BOOTSTRAP_EMAIL'));
  assert.ok(serverOnly.includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert.ok(!serverOnly.includes('VITE_SUPABASE_URL'), 'the public origin is not server-only');
});

// --- 2. The client guard ----------------------------------------------------

test('the guard refuses every credential class, not only Supabase keys', () => {
  const base = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' };
  const cases: Array<[string, string]> = [
    ['VITE_SUPABASE_SERVICE_ROLE_KEY', 'anything'],
    ['VITE_SENDGRID', `SG.${'a'.repeat(20)}.${'b'.repeat(20)}`],
    ['VITE_GOOGLE', `GOCSPX-${'c'.repeat(24)}`],
    // Assembled rather than written literally: the repository secret scan treats a
    // credential-bearing database URL as a finding, and a test fixture must not
    // teach the scanner to make an exception that a real leak could hide behind.
    ['VITE_DB', ['postgres', '://', 'user', ':', 'password', '@db.example.co:5432/postgres'].join('')],
    ['VITE_ADMIN_BOOTSTRAP_EMAIL', 'someone@example.test'],
    ['VITE_SMTP_PASSWORD', 'not-a-real-password'],
    ['VITE_KEY', `-----BEGIN ${'RSA '}PRIVATE KEY-----`],
  ];
  for (const [name, value] of cases) {
    assert.equal(hasPrivilegedClientValue({ ...base, [name]: value }), true, `${name} must be refused`);
  }
});

test('the guard still accepts genuinely public configuration', () => {
  const safe = {
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
    VITE_SUPPORT_EMAIL: 'support@edureach.example',
    VITE_SITE_URL: 'https://edureach.example',
    SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_server_only_value',
  };
  assert.deepEqual(findClientExposures(safe), []);
});

test('a guard finding never contains the value it reports', () => {
  const secret = `SG.${'z'.repeat(24)}.${'y'.repeat(24)}`;
  const exposures = findClientExposures({ VITE_MAIL: secret });
  assert.equal(exposures.length > 0, true);
  for (const exposure of exposures) {
    assert.ok(!exposure.evidence.includes(secret), 'the full value must not appear in the finding');
    assert.ok(!JSON.stringify(exposure).includes(secret));
  }
});

test('the build runs the artefact scan between bundling and publishing the server', () => {
  const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
  assert.match(scripts.build, /vite build && tsx scripts\/dist-secret-scan\.ts && esbuild/);
  assert.match(scripts.ci, /npm run security:scan/);
});

// --- 3. The artefact scan ---------------------------------------------------

function withDist<T>(files: Record<string, string>, run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'edureach-dist-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      const full = join(dir, name);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, body, 'utf8');
    }
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a clean publish directory passes', () => {
  withDist({ 'index.html': '<html></html>', 'assets/app.js': 'console.log("ok")' }, (dir) => {
    const report = scanDirectory(dir, () => undefined);
    assert.deepEqual(report.findings, []);
    assert.equal(report.scanned, 2);
  });
});

test('a server-only variable value in the bundle fails the scan', () => {
  const value = 'sb_secret_a_realistic_server_only_value';
  withDist({ 'assets/app.js': `const k = ${JSON.stringify(value)};` }, (dir) => {
    const report = scanDirectory(dir, (name) => (name === 'SUPABASE_SERVICE_ROLE_KEY' ? value : undefined));
    assert.equal(report.findings.length > 0, true);
    assert.ok(report.findings.some((finding) => finding.rule === 'server_value:SUPABASE_SERVICE_ROLE_KEY'));
    assert.ok(report.findings.some((finding) => finding.rule === 'supabase_secret_key'));
  });
});

test('the admin bootstrap address in the bundle fails the scan', () => {
  const address = 'bootstrap-owner@example.test';
  withDist({ 'assets/app.js': `const admin = ${JSON.stringify(address)};` }, (dir) => {
    const report = scanDirectory(dir, (name) => (name === 'EDUREACH_ADMIN_BOOTSTRAP_EMAIL' ? address : undefined));
    assert.ok(report.findings.some((finding) => finding.rule === 'server_value:EDUREACH_ADMIN_BOOTSTRAP_EMAIL'));
  });
});

test('artefacts that must never be published are refused by name', () => {
  withDist(
    {
      '.env.production': 'A=1',
      'assets/app.js.map': '{}',
      'backup.dump': 'binary',
      'assets/old.bak': 'binary',
      'docs/audit/report.md': 'internal',
      'migration.sql': 'select 1;',
    },
    (dir) => {
      const report = scanDirectory(dir, () => undefined);
      const rules = report.findings.map((finding) => finding.rule).sort();
      assert.deepEqual(rules, [
        'forbidden_file:backup_archive',
        'forbidden_file:database_dump',
        'forbidden_file:env_file',
        'forbidden_file:internal_docs',
        'forbidden_file:source_map',
        'forbidden_file:sql_script',
      ]);
    },
  );
});

test('a missing publish directory is a failure, not a silent pass', () => {
  assert.throws(() => scanDirectory(join(tmpdir(), 'edureach-not-built-at-all'), () => undefined), /Build first/);
});

test('server-only values are collected by declared classification, not by prefix', () => {
  const values = serverOnlyValues((name) =>
    ({ SUPABASE_SECRET_KEY: 'sb_secret_x_y_z_padding', EDUREACH_ADMIN_BOOTSTRAP_EMAIL: 'owner@example.test' })[name],
  );
  assert.deepEqual(
    values.map((entry) => entry.variable).sort(),
    ['EDUREACH_ADMIN_BOOTSTRAP_EMAIL', 'SUPABASE_SECRET_KEY'],
  );
});

test('a short value is not attributed to a variable', () => {
  // A one-character or numeric value would match everywhere and turn the scan
  // into noise that gets suppressed.
  assert.deepEqual(serverOnlyValues((name) => (name === 'SENTRY_DSN' ? 'short' : undefined)), []);
});

test('scan text reports a credential without echoing it', () => {
  const key = `SG.${'q'.repeat(22)}.${'r'.repeat(22)}`;
  const findings = scanArtifactText('assets/app.js', `a\nconst k="${key}";\n`, {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
  assert.ok(!findings[0].evidence.includes(key));
});

test('the entropy heuristic accepts minified code and rejects short values', () => {
  assert.equal(looksHighEntropy('short-but-random-1'), false);
  // A 64-character base64 alphabet table is the benign case the heuristic must not
  // fire on: it has few classes and low entropy per character.
  assert.equal(looksHighEntropy('A'.repeat(64)), false);
  assert.equal(maskValue('abcdefghijklmnop'), 'abcd…(16 chars)');
});

// --- 4. The repository and history scan ------------------------------------

test('the repository scan finds no unexplained credential and no contract violation', () => {
  const report = scanRepository(ROOT, join(ROOT, '.security/secret-scan-allowlist.json'));
  assert.deepEqual(
    report.violations.map((finding) => `${finding.file}:${finding.line} ${finding.rule}`),
    [],
  );
  assert.deepEqual(report.contractViolations, []);
  assert.deepEqual(report.staleAllowlist, []);
});

test('allowlist entries are narrow, explained and never a whole public tree', () => {
  const entries = loadAllowlist(join(ROOT, '.security/secret-scan-allowlist.json'));
  assert.ok(entries.length > 0, 'fixtures need documented exceptions');
  for (const entry of entries) {
    assert.ok(entry.reason.length > 20, `${entry.path} needs a real reason`);
    assert.notEqual(entry.path, '**', 'a whole-repository entry is a disabled scan');
    assert.doesNotMatch(entry.path, /^(docs|src|public|server\.ts)/, `${entry.path} is public code and data`);
    assert.doesNotMatch(entry.path, /^\.env/, 'an environment file must never be allowlisted');
  }
});

test('the allowlist glob is path-scoped, not prefix-scoped', () => {
  assert.equal(globToRegExp('tests/**').test('tests/a/b.test.ts'), true);
  assert.equal(globToRegExp('tests/**').test('src/tests/a.ts'), false);
  assert.equal(globToRegExp('scripts/tests/**').test('scripts/tests/x.mjs'), true);
  assert.equal(globToRegExp('scripts/tests/**').test('scripts/x.mjs'), false);
});

// --- 5. Documentation is public output -------------------------------------

function markdownFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) markdownFiles(relative, acc);
    else if (entry.name.endsWith('.md')) acc.push(relative);
  }
  return acc;
}

test('no document publishes a live Supabase project hostname', () => {
  // The value that failed the production deploy. A documentation placeholder is
  // `<project-ref>.supabase.co`; a real one is a 20-character reference.
  for (const file of ['README.md', ...markdownFiles('docs')]) {
    const text = read(file);
    const match = text.match(/https:\/\/([a-z]{20})\.supabase\.(co|in)/);
    assert.equal(match, null, `${file} publishes a live project hostname; use <project-ref>`);
  }
});

test('no document publishes a personal email address', () => {
  // Support addresses on the product's own domain are intentional; a mailbox at a
  // consumer provider is somebody's identity.
  for (const file of ['README.md', ...markdownFiles('docs')].filter((path) => !path.startsWith('docs/backend-handoff'))) {
    const text = read(file);
    const match = text.match(/[A-Za-z0-9._%+-]+@(?:gmail|yahoo|outlook|hotmail|icloud|protonmail)\.[a-z]{2,}/i);
    assert.equal(match, null, `${file} publishes a personal email address`);
  }
});

test('the audit directory states what may be published', () => {
  const policy = read('docs/audit/README.md');
  assert.match(policy, /Never allowed/);
  assert.match(policy, /value of any environment variable/i);
});

test('SECURITY.md exists, is public-safe, and routes reports to a private channel', () => {
  assert.ok(existsSync(join(ROOT, 'SECURITY.md')));
  const policy = read('SECURITY.md');
  assert.match(policy, /Do not open a public GitHub issue/i);
  assert.match(policy, /Security Advisories/i);
  assert.match(policy, /Never include a real credential/i);
  // It must not name a live project or an internal finding identifier.
  assert.doesNotMatch(policy, /[a-z]{20}\.supabase\.co/);
});

// --- 6. The database migration that closes the findings -------------------

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('the hardening migration revokes public and anon execution on the audited functions', () => {
  const sql = read('supabase/migrations/20261123150000_security_boundary_hardening.sql');
  for (const fn of [
    'public.plan_cbt_paper(uuid, text[], integer, jsonb)',
    'public.enforce_cbt_subject_combination()',
    'public.guard_referenced_news_placeholder_delete()',
  ]) {
    assert.match(sql, new RegExp(`revoke all on function ${escapeRegExp(fn)} from anon`));
    assert.match(sql, new RegExp(`revoke all on function ${escapeRegExp(fn)} from public`));
  }
  // The student workflow keeps its grant: a fix that breaks CBT is not a fix.
  assert.match(sql, /grant execute on function public\.plan_cbt_paper[^;]+ to authenticated/);
  // No policy is added to silence an advisor warning.
  assert.doesNotMatch(sql, /create policy/i);
});

test('the production validation script checks the function execution surface', () => {
  const sql = read('supabase/ci/production-validation.sql');
  assert.match(sql, /SECURITY DEFINER executable by anon/);
  assert.match(sql, /function with no pinned search_path/);
});

test('the RLS matrix explains why a table with no policy is not a defect', () => {
  const doc = read('docs/security/RLS-POLICY-MATRIX.md');
  assert.match(doc, /deny-all/i);
  for (const table of ['admin_audit_logs', 'cbt_bank_security', 'exam_questions', 'question_imports']) {
    assert.match(doc, new RegExp(table));
  }
  assert.match(doc, /Do not add a policy/i);
});
