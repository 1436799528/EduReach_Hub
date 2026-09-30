import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// TEST-1: the CI gate must keep running the checks the repository depends on.
// These are static assertions — GitHub validates the YAML itself and reports the
// result on the check run — and they exist so a future edit cannot delete a
// required stage without a test failing first.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
  engines?: { node?: string };
};
const workflowPath = join(root, '.github/workflows/production-checks.yml');
const workflow = readFileSync(workflowPath, 'utf8');
const nvmrc = readFileSync(join(root, '.nvmrc'), 'utf8').trim();
const netlify = readFileSync(join(root, 'netlify.toml'), 'utf8');

/** Every check the authoritative gate must perform, in order. */
const REQUIRED_STAGES = ['typecheck', 'test', 'schema:audit', 'build'];

test('the authoritative gate script runs every required stage in order', () => {
  const ci = packageJson.scripts.ci;
  assert.ok(ci, 'package.json must define an authoritative `ci` script');
  const positions = REQUIRED_STAGES.map((stage) => {
    const index = ci.indexOf(stage === 'test' ? 'npm test' : `npm run ${stage}`);
    assert.ok(index >= 0, `npm run ci must run ${stage}`);
    return index;
  });
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(positions[i] > positions[i - 1], `${REQUIRED_STAGES[i]} must run after ${REQUIRED_STAGES[i - 1]}`);
  }
  // Browser tests need the build; the dependency audit is network-dependent and
  // therefore last.
  assert.match(ci, /npm run build && npm run test:e2e && npm run audit:ci$/);
});

test('check remains an alias so existing documentation keeps working', () => {
  assert.equal(packageJson.scripts.check, 'npm run ci');
  assert.equal(packageJson.scripts['audit:ci'], 'npm audit --audit-level=low');
});

test('the workflow installs deterministically and follows the repository Node version', () => {
  assert.match(workflow, /run: npm ci(\s|$)/m, 'the gate must install with npm ci');
  assert.doesNotMatch(workflow, /npm install(?!\s)/, 'npm install is not deterministic; use npm ci');
  assert.match(workflow, /node-version-file: \.nvmrc/);
  assert.ok(existsSync(join(root, '.nvmrc')), '.nvmrc is the single source of truth for the Node version');
});

test('the workflow runs the same stages as the authoritative gate', () => {
  for (const command of ['npm run typecheck', 'npm test', 'npm run schema:audit', 'npm run build', 'npm run test:e2e', 'npm run audit:ci']) {
    assert.ok(workflow.includes(command), `the workflow must run \`${command}\``);
  }
  // Named steps, so a failure names its stage in the check run.
  for (const step of ['name: Typecheck', 'name: Tests', 'name: Schema audit', 'name: Production build', 'name: Browser tests', 'name: Dependency audit']) {
    assert.ok(workflow.includes(step), `expected a \`${step}\` step`);
  }
});

test('the schema audit is required, not advisory', () => {
  // tests/schema.test.ts turns the audit's findings into failures; the workflow
  // runs both, so a broken migration cannot pass the gate.
  assert.ok(workflow.includes('npm run schema:audit'));
  assert.ok(existsSync(join(root, 'tests/schema.test.ts')));
  assert.ok(existsSync(join(root, 'scripts/schema-audit.ts')));
});

test('no required check is swallowed', () => {
  assert.doesNotMatch(workflow, /continue-on-error/);
  assert.doesNotMatch(workflow, /\|\|\s*true/);
  assert.doesNotMatch(workflow, /--if-present/);
  assert.doesNotMatch(workflow, /set \+e/);
  assert.doesNotMatch(workflow, /exit 0\s*#\s*ignore/i);
});

test('the workflow triggers on pull requests and pushes to the default branch', () => {
  assert.match(workflow, /^on:/m);
  assert.match(workflow, /pull_request:\s*\n\s+branches: \[main\]/);
  assert.match(workflow, /push:\s*\n\s+branches: \[main\]/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/, 'the workflow should not request write scope');
  assert.match(workflow, /cancel-in-progress: true/, 'a superseded run should be cancelled rather than duplicated');
});

test('a real PostgreSQL replay guards the BASE-1 claims', () => {
  assert.match(workflow, /migration-replay:/);
  assert.match(workflow, /image: postgres:16/);
  for (const mode of ['--setup', '--apply', '--verify']) {
    assert.ok(workflow.includes(`replay-migrations.sh ${mode}`), `the replay job must run ${mode}`);
  }
  for (const file of ['supabase/ci/platform-shims.sql', 'supabase/ci/verify-migrations.sql', 'scripts/replay-migrations.sh']) {
    assert.ok(existsSync(join(root, file)), `${file} is missing`);
  }
  const script = readFileSync(join(root, 'scripts/replay-migrations.sh'), 'utf8');
  assert.match(script, /ON_ERROR_STOP=1/, 'the replay must stop at the first failing statement');
});

test('Node requirements agree across the repository', () => {
  const major = (value: string) => /(\d+)/.exec(value)?.[1];
  const workflowMajor = major(nvmrc);
  assert.ok(workflowMajor, '.nvmrc must contain a version');
  assert.equal(major(packageJson.engines?.node ?? ''), workflowMajor, 'package.json engines must match .nvmrc');
  const netlifyNode = /NODE_VERSION\s*=\s*"([^"]+)"/.exec(netlify)?.[1];
  assert.equal(major(netlifyNode ?? ''), workflowMajor, 'netlify.toml NODE_VERSION must match .nvmrc');
});
