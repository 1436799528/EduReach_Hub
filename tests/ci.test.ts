import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// TEST-1: the CI gate must keep running the checks the repository depends on.
//
// The contract is "the workflow executes the authoritative gate", not "the YAML
// has a particular shape". These assertions accept either form GitHub runs
// today — a single `npm run ci` step, or the same stages spelled out as separate
// named steps — and fail if a stage disappears, if the two definitions drift
// apart, or if a required check is softened. YAML syntax itself is GitHub's job
// (it reports that on the check run).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
  engines?: { node?: string };
};
const workflow = readFileSync(join(root, '.github/workflows/production-checks.yml'), 'utf8');
const nvmrc = readFileSync(join(root, '.nvmrc'), 'utf8').trim();
const netlify = readFileSync(join(root, 'netlify.toml'), 'utf8');

/** Every check the authoritative gate must perform, in order. */
const REQUIRED_STAGES: Array<[stage: string, command: string]> = [
  ['typecheck', 'npm run typecheck'],
  ['tests', 'npm test'],
  ['schema audit', 'npm run schema:audit'],
  ['build', 'npm run build'],
  ['performance budget', 'npm run perf:audit'],
];

/** The stages the workflow actually executes, whether directly or via the gate script. */
function stagesRunByWorkflow(): string[] {
  const delegates = /npm run (ci|check)\b/.test(workflow);
  return REQUIRED_STAGES
    .filter(([, command]) => delegates || workflow.includes(command))
    .map(([stage]) => stage);
}

test('the authoritative gate script runs every required stage in order', () => {
  const ci = packageJson.scripts.ci;
  assert.ok(ci, 'package.json must define an authoritative `ci` script');
  const positions = REQUIRED_STAGES.map(([, command]) => {
    const index = ci.indexOf(command);
    assert.ok(index >= 0, `npm run ci must run \`${command}\``);
    return index;
  });
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(positions[i] > positions[i - 1], `${REQUIRED_STAGES[i][0]} must run after ${REQUIRED_STAGES[i - 1][0]}`);
  }
  // Both the performance budget and the browser tests need the build; the
  // dependency audit is network-dependent and therefore last.
  assert.match(ci, /npm run build && npm run perf:audit && npm run test:e2e && npm run audit:ci$/);
});

test('the workflow executes every stage the gate defines', () => {
  const stages = stagesRunByWorkflow();
  assert.deepEqual(stages, REQUIRED_STAGES.map(([stage]) => stage), 'the workflow must run every required stage');
  assert.match(workflow, /run: npm ci(\s|$)/m, 'the gate must install with npm ci');
  assert.doesNotMatch(workflow, /npm install(?!\s)/, 'npm install is not deterministic; use npm ci');
});

test('when the workflow spells out stages, it names them so a failure is attributable', () => {
  // The gate may delegate to `npm run ci` (npm prints which sub-command failed)
  // or enumerate stages. When it enumerates them, each needs a readable step name.
  const delegates = /run: npm run (ci|check)\b/.test(workflow);
  if (delegates) {
    assert.match(workflow, /name: [^\n]*gate/i, 'the delegating step should say that it is the quality gate');
    return;
  }
  for (const step of ['name: Typecheck', 'name: Tests', 'name: Schema audit', 'name: Production build']) {
    assert.ok(workflow.includes(step), `expected a \`${step}\` step`);
  }
});

test('check remains an alias so existing documentation keeps working', () => {
  assert.equal(packageJson.scripts.check, 'npm run ci');
  assert.equal(packageJson.scripts['audit:ci'], 'npm audit --audit-level=low');
});

test('the schema audit is required, not advisory', () => {
  // tests/schema.test.ts turns the audit's findings into failures; the gate runs
  // both, so a broken migration cannot pass.
  assert.ok(packageJson.scripts.ci.includes('schema:audit'));
  assert.ok(stagesRunByWorkflow().includes('schema audit'));
  assert.ok(existsSync(join(root, 'tests/schema.test.ts')));
  assert.ok(existsSync(join(root, 'scripts/schema-audit.ts')));
});

test('no required check is swallowed', () => {
  assert.doesNotMatch(workflow, /continue-on-error/);
  assert.doesNotMatch(workflow, /\|\|\s*true/);
  assert.doesNotMatch(workflow, /--if-present/);
  assert.doesNotMatch(workflow, /set \+e/);
});

test('the workflow triggers on pull requests and pushes to the default branch', () => {
  assert.match(workflow, /^on:/m);
  assert.match(workflow, /pull_request:\s*\n\s+branches: \[main\]/);
  assert.match(workflow, /push:\s*\n\s+branches: \[main\]/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/, 'the workflow should not request write scope');
});

test('a real PostgreSQL replay guards the BASE-1 claims', () => {
  // The replay runs inside `npm test`, so it gates every run of `npm run ci`.
  assert.ok(packageJson.scripts.test.includes('tests/*.test.ts'));
  assert.ok(packageJson.scripts.ci.includes('npm test'));
  for (const file of ['tests/migrations.test.ts', 'supabase/ci/platform-shims.sql', 'supabase/ci/verify-migrations.sql']) {
    assert.ok(existsSync(join(root, file)), `${file} is missing`);
  }
  const replay = readFileSync(join(root, 'scripts/replay.ts'), 'utf8');
  assert.match(replay, /platform-shims\.sql/, 'the replay helper must load the Supabase platform shim');
  assert.match(replay, /readdirSync\(MIGRATIONS_DIR\)/, 'the replay helper must read the migration directory itself');
  const migrationsTest = readFileSync(join(root, 'tests/migrations.test.ts'), 'utf8');
  assert.match(migrationsTest, /applyMigrations/, 'the schema test must use the shared replay helper');
  assert.match(migrationsTest, /verify-migrations\.sql/, 'the replay must run the post-apply assertions');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { devDependencies?: Record<string, string> };
  assert.ok(pkg.devDependencies?.['@electric-sql/pglite'], 'the replay engine must be a declared dev dependency');
});

test('Node requirements agree across the repository', () => {
  const major = (value: string) => /(\d+)/.exec(value)?.[1];
  const workflowMajor = major(nvmrc);
  assert.ok(workflowMajor, '.nvmrc must contain a version');
  assert.equal(major(packageJson.engines?.node ?? ''), workflowMajor, 'package.json engines must match .nvmrc');
  const netlifyNode = /NODE_VERSION\s*=\s*"([^"]+)"/.exec(netlify)?.[1];
  assert.equal(major(netlifyNode ?? ''), workflowMajor, 'netlify.toml NODE_VERSION must match .nvmrc');
  // Either the workflow reads .nvmrc (preferred) or pins the same major.
  const inline = /node-version:\s*['"]?([\d.]+x?)/.exec(workflow)?.[1];
  if (!workflow.includes('node-version-file: .nvmrc')) {
    assert.equal(major(inline ?? ''), workflowMajor, `the workflow pins ${inline}, which must match .nvmrc`);
  }
});
