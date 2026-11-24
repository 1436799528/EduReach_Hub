import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { readRouteTable } from '../scripts/generate-route-paths';
import { classify, linksIn, PLACEHOLDER } from '../scripts/link-audit';

/**
 * The link audit, tested on the two things that decide its value: does it see
 * every kind of link the codebase writes, and does it call a bad target bad?
 *
 * A checker that quietly finds nothing is worse than no checker, because the
 * green tick is a lie. These cases pin both directions.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { paths, prefixes } = readRouteTable();
const pathSet = new Set(paths);

test('it reads every shape of link the codebase writes', () => {
  const source = [
    '<a href="/news">plain</a>',
    "<a href='/jobs'>single</a>",
    '<a href={"/scholarships"}>braced</a>',
    '<a href={`/schools/${slug}`}>template</a>',
    "const nav = { label: 'Practice', href: '/cbt' };",
    "navigate('/login');",
    "window.location.href = '/faq';",
  ].join('\n');

  const targets = linksIn('fixture.tsx', source).map((link) => link.target);
  assert.deepEqual(targets.sort(), [
    '/cbt',
    '/faq',
    '/jobs',
    '/login',
    '/news',
    '/scholarships',
    `/schools/${PLACEHOLDER}`,
  ]);
});

test('line numbers point at the link, not the file', () => {
  const source = ['const a = 1;', 'const b = 2;', '<a href="/nope">x</a>'].join('\n');
  const [link] = linksIn('fixture.tsx', source);
  assert.equal(link.line, 3);
});

test('a path the router knows is fine; one it does not is not', () => {
  assert.equal(classify('/news', pathSet, prefixes), 'route');
  assert.equal(classify('/this-page-does-not-exist', pathSet, prefixes), 'broken');
  assert.equal(classify('/news/', pathSet, prefixes), 'route', 'a trailing slash resolves to the same route');
  assert.equal(classify('/news?page=2', pathSet, prefixes), 'route', 'a query string is not part of the path');
  assert.equal(classify('/news#top', pathSet, prefixes), 'route', 'a fragment is not part of the path');
});

test('a template literal is judged by its static head', () => {
  assert.equal(classify(`/news/${PLACEHOLDER}`, pathSet, prefixes), 'route');
  assert.equal(classify(`/schools/${PLACEHOLDER}`, pathSet, prefixes), 'route');
  assert.equal(classify(`/nope/${PLACEHOLDER}`, pathSet, prefixes), 'broken');
  assert.equal(
    classify(PLACEHOLDER, pathSet, prefixes),
    'ignored',
    'a path built entirely at runtime has no static head to judge, so it is not guessed at',
  );
});

test('prefixes, static files and API paths are recognised', () => {
  assert.ok(prefixes.length > 0, 'the router must expose at least one prefix route');
  assert.equal(classify(`${prefixes[0]}/anything`, pathSet, prefixes), 'prefix');
  assert.equal(classify('/assets/app-1234.js', pathSet, prefixes), 'static');
  assert.equal(classify('/robots.txt', pathSet, prefixes), 'static');
  assert.equal(classify('/api/news', pathSet, prefixes), 'api');
});

test('non-navigational schemes are sorted, not guessed at', () => {
  assert.equal(classify('https://www.jamb.gov.ng/', pathSet, prefixes), 'external');
  assert.equal(classify('mailto:hello@edureach.example', pathSet, prefixes), 'ignored');
  assert.equal(classify('tel:+2348000000000', pathSet, prefixes), 'ignored');
  assert.equal(classify('#main', pathSet, prefixes), 'anchor');
  assert.equal(classify('javascript:void(0)', pathSet, prefixes), 'broken', 'a javascript: href is a link that cannot work');
});

test('the repository itself is clean, and CI runs the check', () => {
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/link-audit.ts'], {
    cwd: root,
    stdio: 'pipe',
  });
});
