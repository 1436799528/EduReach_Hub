import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CANONICAL_ALIASES, isIndexablePath } from '../src/lib/seoMeta';
import { PAGE_MANIFEST, fullCoveragePages, pagesWithEndpoints } from '../src/app/pageManifest';

// The manifest is only worth having if it cannot drift. These tests are the
// drift alarm: they fail when a route exists without a manifest row, when a
// manifest row names a route that no longer exists, or when the indexable flag
// stops agreeing with the SEO rules that actually decide what gets crawled.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const routesSource = readFileSync(join(root, 'src/app/routes.tsx'), 'utf8');

/** Paths the router matches exactly. */
function exactRoutes(): string[] {
  return [...routesSource.matchAll(/path === '([^']+)'/g)].map((match) => match[1]);
}

/**
 * Routes that need a session or belong to the console. They are deliberately
 * outside the manifest: they cannot be anonymous-crawled and their quality is
 * covered by the admin and dashboard specs instead.
 */
const PRIVATE_PREFIXES = [
  '/admin',
  '/dashboard',
  '/profile',
  '/settings',
  '/u',
  '/services/track',
  '/track',
  '/cbt/session',
  '/cbt/practice',
  '/cbt/results',
];

function isPrivate(path: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

test('every manifest row names a route the router actually matches', () => {
  const routes = new Set(exactRoutes());
  const missing = PAGE_MANIFEST.filter((entry) => entry.path !== '/' && !routes.has(entry.path)).map((entry) => entry.path);
  assert.deepEqual(missing, [], `manifest rows with no matching route: ${missing.join(', ')}`);
});

test('every public route is either in the manifest or a declared alias', () => {
  // A new public page must be declared, because that declaration is what puts it
  // in the browser coverage, the post-deploy crawl and the overflow checks.
  // Aliases are exempt: they render a page that is already declared, and the
  // alias table is the one place that says so.
  const declared = new Set(PAGE_MANIFEST.map((entry) => entry.path));
  const aliases = new Set(Object.keys(CANONICAL_ALIASES));
  const uncovered = [...new Set(exactRoutes())]
    .filter((path) => path !== '/')
    .filter((path) => !isPrivate(path))
    .filter((path) => !declared.has(path) && !aliases.has(path))
    .sort();
  assert.deepEqual(uncovered, [], `public routes missing from src/app/pageManifest.ts: ${uncovered.join(', ')}`);
});

test('the manifest never lists the same path twice', () => {
  const paths = PAGE_MANIFEST.map((entry) => entry.path);
  assert.equal(new Set(paths).size, paths.length, 'duplicate manifest path');
});

test('the indexable flag agrees with the SEO rules that decide what is crawled', () => {
  const disagreements = PAGE_MANIFEST
    .filter((entry) => entry.indexable !== isIndexablePath(entry.path))
    .map((entry) => `${entry.path}: manifest says indexable=${entry.indexable}, seoForPath says ${isIndexablePath(entry.path)}`);
  assert.deepEqual(disagreements, [], disagreements.join('\n'));
});

test('an alias never points at a page that is not declared', () => {
  const declared = new Set(PAGE_MANIFEST.map((entry) => entry.path));
  const dangling = Object.entries(CANONICAL_ALIASES)
    .filter(([alias]) => !isPrivate(alias))
    .filter(([, target]) => !declared.has(target))
    .map(([alias, target]) => `${alias} -> ${target}`);
  assert.deepEqual(dangling, [], `aliases pointing at an undeclared page: ${dangling.join(', ')}`);
});

test('every page held to the browser checks is public and has a name', () => {
  for (const entry of fullCoveragePages()) {
    assert.ok(entry.public, `${entry.path} is held to the browser checks but is not public`);
    assert.ok(entry.name.trim().length > 0, `${entry.path} has no name for the test title`);
  }
});

test('endpoint probes use relative paths, so one crawl can run against any deployment', () => {
  for (const entry of pagesWithEndpoints()) {
    for (const endpoint of entry.api ?? []) {
      assert.match(endpoint, /^\/api\/[a-z0-9/_-]+$/, `${entry.path} probes ${endpoint}, which is not a relative API path`);
    }
  }
});
