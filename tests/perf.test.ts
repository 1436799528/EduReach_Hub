import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
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

// ---------------------------------------------------------------------------
// Layout stability (the CLS half of PERF-1).
//
// The numbers here are the ones the browser measurement named: a placeholder
// that is not the height of the content it stands in for moves everything
// below it. These tests keep the geometry consistent, so the reservation
// cannot drift away from the rows it is reserving for.

function stylesheet(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

/** The declaration block for an exact selector (first match, so mobile overrides are separate). */
function declarations(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

function pxValue(block: string, property: string): number {
  const match = new RegExp(`${property}\\s*:\\s*(-?[\\d.]+)px`).exec(block);
  return match ? Number(match[1]) : Number.NaN;
}

test('a loading row is exactly the height of the row it stands in for', () => {
  const css = stylesheet('src/edu-portal.css');
  const skeletonRow = pxValue(declarations(css, '.er-skeleton-row'), 'padding') * 2
    + pxValue(declarations(css, '.er-skel-thumb'), 'height')
    + 2; // the 1px border top and bottom
  const newsRow = pxValue(declarations(css, '.er-news-row'), 'min-height') + 2;
  assert.equal(skeletonRow, newsRow, `skeleton row ${skeletonRow}px vs news row ${newsRow}px`);
});

test('the card placeholder uses the same grid as the cards it replaces', () => {
  const css = stylesheet('src/edu-portal.css');
  /** Every declaration block for a selector, in file order (mobile overrides included). */
  const blocks = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...css.matchAll(new RegExp(`${escaped}\\{([^}]*)\\}`, 'g'))].map((match) => match[1]);
  };
  const columns = (selector: string) => /grid-template-columns:\s*([^;}]+)/.exec(blocks(selector)[0])?.[1].trim();

  assert.equal(columns('.er-skeleton-grid'), columns('.er-library-grid'));
  const tile = blocks('.er-skeleton-tile').find((block) => block.includes('display:flex'));
  assert.ok(tile, 'the placeholder card rule still exists');
  assert.equal(pxValue(tile!, 'padding'), pxValue(blocks('.er-library-card')[0], 'padding'), 'the placeholder card and the real card are padded the same');
});

test('a region that fills in after the first paint reserves its footprint', () => {
  const css = stylesheet('src/edu-portal.css');
  assert.match(declarations(css, '.er-late-region'), /min-height:\s*var\(--er-late-min/);
  const floor = (selector: string) => pxValue(declarations(css, selector), '--er-late-min');
  const rows = (count: number, row: number) => count * row + (count - 1) * 10; // 10px gutter

  // 82px rows: the height .er-skeleton-row and .er-news-row share.
  assert.ok(floor('.er-late-region--feed') >= rows(6, 82), 'the home feed reserves its six rows');
  assert.ok(floor('.er-late-region--feed-page') >= rows(5, 82), 'the noticeboard reserves its five rows');
  assert.ok(floor('.er-late-region--library') >= 600, 'the question-bank grid reserves its cards');
});

test('the simulator section reserves its footprint while its catalogue loads', () => {
  const component = stylesheet('src/components/ExamSimulatorGrid.tsx');
  assert.match(component, /er-late-region--simulators/);
  assert.match(component, /<SkeletonTiles className="er-sim-grid"/, 'the placeholder uses the real grid, so it wraps and scrolls like the cards');
  assert.match(component, /!settled/, 'the pending state is its own state, not "nothing published yet"');

  const css = stylesheet('src/edu-portal.css');
  const blocks = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...css.matchAll(new RegExp(`${escaped}\\{([^}]*)\\}`, 'g'))].map((match) => match[1]);
  };
  assert.ok(pxValue(declarations(css, '.er-late-region--simulators'), '--er-late-min') >= 200);

  // The placeholder card is exactly as tall as the card it replaces, in the swipe layout.
  const mobileCard = blocks('.er-sim-card').find((block) => block.includes('flex-direction:row'));
  const placeholderHeights = blocks('.er-sim-grid .er-skeleton-tile').map((block) => pxValue(block, 'min-height'));
  assert.ok(mobileCard, 'the mobile simulator card rule still exists');
  assert.ok(
    placeholderHeights.includes(pxValue(mobileCard!, 'min-height')),
    `the swipe-layout placeholder is ${placeholderHeights.join('/')}px, the card is ${pxValue(mobileCard!, 'min-height')}px`,
  );
});

test('the pages the measurement named use the reservation', () => {
  const home = stylesheet('pages/HubHomePage.tsx');
  assert.match(home, /er-late-region--feed/);
  const rendered = Number(/news\.slice\(0, (\d+)\)/.exec(home)?.[1]);
  assert.ok(Number.isFinite(rendered), 'the home feed still renders a fixed number of rows');
  assert.match(home, new RegExp(`<SkeletonRows rows=\\{${rendered}\\}`), 'the skeleton shows as many rows as the feed');

  assert.match(stylesheet('pages/NewsPage.tsx'), /er-late-region--feed-page/);

  const library = stylesheet('pages/PastQuestionsPage.tsx');
  assert.match(library, /er-late-region--library/);
  assert.match(library, /<SkeletonTiles tiles=\{6\}/);
});
