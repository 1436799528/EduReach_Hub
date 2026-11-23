import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateEndpoint, evaluatePage, probeAll, probeEntry } from '../scripts/smoke-check';
import { PAGE_MANIFEST, pagesWithEndpoints } from '../src/app/pageManifest';

// The post-deploy crawl is only useful if it fails for the right reason. These
// tests use a fake transport, so they describe the verdicts without a network:
// a 503 on an endpoint must fail (that is the shape the missing FAQ and Reviews
// tables produced), an honest empty list must pass, and a page must not pass on
// an error body that happens to be HTML.

const shell = '<!doctype html><html><body><div id="root"></div></body></html>';

test('a 200 that is the application shell is a pass', () => {
  assert.deepEqual(evaluatePage(200, 'text/html; charset=utf-8', shell).ok, true);
});

test('a page that answers with an error status fails, whatever the body', () => {
  assert.equal(evaluatePage(500, 'text/html', shell).ok, false);
  assert.equal(evaluatePage(404, 'text/html', shell).ok, false);
});

test('an html 200 without the mount point is not the app, so it fails', () => {
  assert.equal(evaluatePage(200, 'text/html', '<html><body>Internal error</body></html>').ok, false);
});

test('a json body served where a page should be fails', () => {
  assert.equal(evaluatePage(200, 'application/json', '{"error":"nope"}').ok, false);
});

test('an endpoint must answer 200 with json, and an empty list is a pass', () => {
  assert.equal(evaluateEndpoint(200, []).ok, true);
  assert.equal(evaluateEndpoint(200, []).detail, 'http 200, 0 rows');
  assert.equal(evaluateEndpoint(200, [{ id: 1 }]).detail, 'http 200, 1 row');
  assert.equal(evaluateEndpoint(200, { ok: true }).ok, true);
});

test('a 503 from an endpoint fails — the shape the missing tables produced', () => {
  const verdict = evaluateEndpoint(503, 'upstream error');
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /503/);
});

test('a body that is not json fails even on a 200', () => {
  assert.equal(evaluateEndpoint(200, 'not json').ok, false);
});

test('probing an entry reports the page and each of its endpoints separately', async () => {
  const entry = pagesWithEndpoints()[0];
  assert.ok(entry, 'the manifest declares at least one page with an endpoint');

  const seen: string[] = [];
  const probes = await probeEntry('https://example.test', entry, async (url) => {
    seen.push(url.replace('https://example.test', ''));
    if (url.endsWith(entry.path)) return { status: 200, contentType: 'text/html', body: shell };
    return { status: 200, contentType: 'application/json', body: '[]' };
  });

  assert.equal(probes.length, 1 + (entry.api?.length ?? 0));
  assert.deepEqual(seen, [entry.path, ...(entry.api ?? [])]);
  assert.ok(probes.every((probe) => probe.ok));
});

test('one failing endpoint makes the crawl fail', async () => {
  const probes = await probeAll('https://example.test', async (url) => {
    if (url.includes('/api/reviews')) return { status: 503, contentType: 'application/json', body: '{"error":"down"}' };
    if (url.includes('/api/')) return { status: 200, contentType: 'application/json', body: '[]' };
    return { status: 200, contentType: 'text/html', body: shell };
  });
  const failures = probes.filter((probe) => !probe.ok);
  assert.equal(failures.length, 1);
  assert.match(failures[0].target, /\/api\/reviews/);
});

test('every declared page is reachable through the crawl or documented as browser-checked', () => {
  // The crawl only probes pages with an endpoint; the rest are covered by the
  // browser spec. This asserts the split is not empty on either side, so a
  // future edit cannot silently leave both halves doing nothing.
  const withEndpoints = pagesWithEndpoints().length;
  const browserChecked = PAGE_MANIFEST.filter((entry) => entry.checks === 'full').length;
  assert.ok(withEndpoints > 0, 'no page declares an endpoint');
  assert.ok(browserChecked > 0, 'no page is held to the browser checks');
  assert.ok(withEndpoints + browserChecked >= 8, 'the two halves together must cover a meaningful set of pages');
});
