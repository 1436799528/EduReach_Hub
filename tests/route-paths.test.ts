import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isAppRoute, APP_ROUTE_PATHS, APP_ROUTE_PREFIXES } from '../src/app/routePaths.generated';
import { buildArtifacts, readRouteTable } from '../scripts/generate-route-paths';
import { PAGE_MANIFEST } from '../src/app/pageManifest';

// Soft 404s: every unknown URL used to answer 200 with a "Page Not Found"
// screen. The fix is a route table generated from the router, used by both the
// Netlify catch-all and the Express fallback. These tests are what makes that
// safe — if the table drifts from the router, a real page would start answering
// 404 in production, so drift has to be impossible, not merely unlikely.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const routesSource = readFileSync(join(root, 'src/app/routes.tsx'), 'utf8');

test('the generated table contains every path the router matches', () => {
  const table = readRouteTable(routesSource);
  const missing = table.paths.filter((path) => !APP_ROUTE_PATHS.includes(path));
  assert.deepEqual(missing, [], `router paths missing from the generated table: ${missing.join(', ')}`);
});

test('the generated table contains every prefix the router matches', () => {
  const table = readRouteTable(routesSource);
  const missing = table.prefixes.filter((prefix) => !APP_ROUTE_PREFIXES.includes(prefix));
  assert.deepEqual(missing, [], `router prefixes missing from the generated table: ${missing.join(', ')}`);
});

test('the generated table invents nothing the router does not match', () => {
  const table = readRouteTable(routesSource);
  const extraPaths = APP_ROUTE_PATHS.filter((path) => !table.paths.includes(path));
  const extraPrefixes = APP_ROUTE_PREFIXES.filter((prefix) => !table.prefixes.includes(prefix));
  assert.deepEqual(extraPaths, []);
  assert.deepEqual(extraPrefixes, []);
});

test('both generated artifacts match the scripts that produce them', () => {
  const { module, toml } = buildArtifacts();
  assert.equal(
    readFileSync(join(root, 'src/app/routePaths.generated.ts'), 'utf8'),
    module,
    'src/app/routePaths.generated.ts is stale — run `npm run routes:generate`',
  );
  assert.equal(
    readFileSync(join(root, 'netlify.toml'), 'utf8'),
    toml,
    'netlify.toml redirect block is stale — run `npm run routes:generate`',
  );
});

test('a declared route is never treated as unknown', () => {
  const wrong = PAGE_MANIFEST.filter((entry) => !isAppRoute(entry.path)).map((entry) => entry.path);
  assert.deepEqual(wrong, [], `manifest pages the route table calls unknown: ${wrong.join(', ')}`);
});

test('real routes are known, with or without a trailing slash and query string', () => {
  for (const path of ['/', '/faq', '/faq/', '/news', '/dashboard', '/login', '/tools/cgpa-calculator']) {
    assert.equal(isAppRoute(path), true, `${path} must be a known route`);
  }
  assert.equal(isAppRoute('/faq?ref=nav'), true);
});

test('dynamic routes are known by prefix', () => {
  for (const path of ['/news/some-slug', '/schools/abc', '/jobs/abc', '/u/someone', '/cbt/session/x']) {
    assert.equal(isAppRoute(path), true, `${path} must match a prefix`);
  }
});

test('a path that only shares a prefix boundary is not known', () => {
  // `/newsletter` starts with `/news` but is not under `/news/`.
  assert.equal(isAppRoute('/newsletter'), false);
  assert.equal(isAppRoute('/faqs'), false);
  assert.equal(isAppRoute('/this-page-does-not-exist'), false);
});

test('netlify serves unknown paths with a 404, not a 200 shell', () => {
  const toml = readFileSync(join(root, 'netlify.toml'), 'utf8');
  const blocks = toml.split('[[redirects]]').slice(1);

  const catchingAll = blocks.filter((block) => block.includes('from = "/*"'));
  assert.equal(catchingAll.length, 1, 'exactly one catch-all rule');
  assert.match(catchingAll[0], /to = "\/404\.html"/);
  assert.match(catchingAll[0], /status = 404/);

  const shellForEverything = blocks.filter(
    (block) => block.includes('from = "/*"') && block.includes('to = "/index.html"'),
  );
  assert.deepEqual(shellForEverything, [], 'no rule may answer the shell with a 200 for every path');
});

test('the API, robots and sitemap rules still come before the generated block', () => {
  const toml = readFileSync(join(root, 'netlify.toml'), 'utf8');
  const apiIndex = toml.indexOf('from = "/api/*"');
  const generatedIndex = toml.indexOf('# BEGIN GENERATED ROUTES');
  assert.ok(apiIndex > -1 && generatedIndex > -1);
  assert.ok(apiIndex < generatedIndex, 'the API rewrite must be matched before the page routes');
});
