import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPerf, imgElements, readPerfInput, type PerfInput } from '../scripts/perf-audit';

// PERF-1: the budget has to fail when the budget is broken.
//
// A check that only ever passes is not a check. Each test below breaks exactly
// one thing in a synthetic build and asserts that the matching check — and only
// that check — reports the failure. The last test runs the real audit against
// the real `dist/` when there is one, which is what CI does after `npm run
// build`; `npm test` runs before the build, so it is skipped there by design
// rather than made to depend on build order.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const KB = 1024;

function asset(name: string, gzipKb: number, text = '') {
  return { path: `dist/assets/${name}`, raw: gzipKb * KB * 3, gzip: gzipKb * KB, text };
}

/** A build that passes every budget, so each test can break one thing. */
function healthyInput(overrides: Partial<PerfInput> = {}): PerfInput {
  const base: PerfInput = {
    assets: new Map([
      ['index-aaa.js', asset('index-aaa.js', 90)],
      ['react-aaa.js', asset('react-aaa.js', 4)],
      ['supabase-aaa.js', asset('supabase-aaa.js', 56)],
      ['index-aaa.css', asset('index-aaa.css', 41)],
    ]),
    images: new Map([['public/news/photos/a.jpg', 60 * KB]]),
    indexHtml: [
      '<link rel="preconnect" href="https://fonts.googleapis.com" />',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..900&display=swap" />',
    ].join('\n'),
    headers: [
      '/index.html',
      '  Cache-Control: no-cache, no-store, must-revalidate',
      '',
      '/sw.js',
      '  Cache-Control: no-cache, no-store, must-revalidate',
      '',
      '/assets/*',
      '  Cache-Control: public, max-age=31536000, immutable',
      '',
    ].join('\n'),
    sources: new Map([['pages/Page.tsx', 'const a = <img src="/a.jpg" loading="lazy" />;']]),
  };
  return { ...base, ...overrides };
}

const check = (input: PerfInput, id: string) => auditPerf(input).find((entry) => entry.id === id);

test('a build inside every budget passes every check', () => {
  const failures = auditPerf(healthyInput()).filter((entry) => !entry.ok);
  assert.deepEqual(failures.map((entry) => `${entry.id}: ${entry.measured}`), []);
});

test('nothing is measured until there is something to measure', () => {
  const checks = auditPerf(healthyInput({ assets: new Map() }));
  assert.equal(checks.length, 1);
  assert.equal(checks[0].id, 'artefacts');
  assert.equal(checks[0].ok, false);
  assert.match(checks[0].detail ?? '', /npm run build/);
});

test('an entry chunk over budget fails, and names the measured value', () => {
  const input = healthyInput();
  input.assets.set('index-aaa.js', asset('index-aaa.js', 140));
  const entry = check(input, 'entry-js');
  assert.equal(entry?.ok, false);
  assert.match(entry?.measured ?? '', /140\.0 KB/);
  assert.equal(check(input, 'css')?.ok, true, 'only the chunk that grew should fail');
});

test('a render-blocking font import fails the chain check', () => {
  const input = healthyInput();
  input.assets.set('index-aaa.css', asset('index-aaa.css', 41, "@import url('https://fonts.googleapis.com/css2?family=Inter');"));
  const chain = check(input, 'font-chain');
  assert.equal(chain?.ok, false);
  assert.match(chain?.detail ?? '', /@import found/);
});

test('hashed assets without an immutable header fail the caching check', () => {
  const input = healthyInput({ headers: '/index.html\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/sw.js\n  Cache-Control: no-cache, no-store, must-revalidate\n' });
  const cache = check(input, 'asset-cache');
  assert.equal(cache?.ok, false);
  assert.match(cache?.measured ?? '', /assets not immutable/);
});

test('a cached shell fails the caching check even when assets are immutable', () => {
  const input = healthyInput({ headers: '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n' });
  const cache = check(input, 'asset-cache');
  assert.equal(cache?.ok, false);
  assert.match(cache?.measured ?? '', /index\.html cached/);
  assert.match(cache?.detail ?? '', /stale/);
});

test('an image that declares no loading strategy fails, with its file and line', () => {
  const input = healthyInput({ sources: new Map([['pages/Page.tsx', 'const a = <img src="/a.jpg" alt="A" />;']]) });
  const images = check(input, 'img-loading');
  assert.equal(images?.ok, false);
  assert.match(images?.detail ?? '', /pages\/Page\.tsx:1/);
});

test('an over-sized image fails on its own, however few of them there are', () => {
  const input = healthyInput({ images: new Map([['public/news/photos/huge.png', 200 * KB]]) });
  assert.equal(check(input, 'largest-image')?.ok, false);
  assert.equal(check(input, 'total-images')?.ok, true);
});

test('the image rule reads JSX through the parser, not a regex', () => {
  // The handler contains a `>`; a regex scan would truncate the tag before
  // `decoding` and report a false failure.
  const source = 'const a = <img src="/a.jpg" onClick={(event) => event.stopPropagation()} loading="lazy" decoding="async" />;';
  const [image] = imgElements(new Map([['pages/Page.tsx', source]]));
  assert.deepEqual(image.attributes.sort(), ['decoding', 'loading', 'onClick', 'src']);
  assert.equal(image.srcIsSvgOrData, false);
});

test('an inline SVG data URL is not treated as a raster image', () => {
  const source = 'const qr = <img src={`data:image/svg+xml;utf8,${encodeURIComponent(code)}`} width={150} height={150} decoding="async" />;';
  const [image] = imgElements(new Map([['pages/Page.tsx', source]]));
  assert.equal(image.srcIsSvgOrData, true);
});

test('the repository passes its own budget when a build is present', (context) => {
  if (!existsSync(join(root, 'dist/index.html'))) {
    context.skip('no dist/ — the gate checks this after `npm run build`');
    return;
  }
  const failures = auditPerf(readPerfInput(root)).filter((entry) => !entry.ok);
  assert.deepEqual(failures.map((entry) => `${entry.id}: ${entry.measured}`), []);
});
