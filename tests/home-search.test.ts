import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// The portal search bar on the home page was removed once and put back. The
// text assertions in tests/site-experience.test.ts keep the markup; this file
// checks the half that markup alone cannot prove - that submitting the term
// writes one history entry, tells the router exactly once, and produces a URL
// the search page can read back.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://edureach.test/',
  pretendToBeVisual: true,
});
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  PopStateEvent: dom.window.PopStateEvent,
  URLSearchParams: dom.window.URLSearchParams,
})) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
after(() => dom.window.close());

const { navigateInApp } = await import('../src/lib/navigation');

test('a search submit writes one history entry and tells the router once', () => {
  const seen: string[] = [];
  const listener = (): void => {
    seen.push(`${dom.window.location.pathname}${dom.window.location.search}`);
  };
  dom.window.addEventListener('popstate', listener);

  // The home form trims, encodes, then navigates - so a term with a space and
  // an ampersand has to survive the trip intact.
  const typed = '  NELFUND & result checking  ';
  const term = typed.trim();
  assert.ok(term, 'a non-empty term is the only one that navigates');
  navigateInApp(`/search?q=${encodeURIComponent(term)}`);

  dom.window.removeEventListener('popstate', listener);

  assert.equal(dom.window.location.pathname, '/search', 'the search route is a client route');
  assert.equal(dom.window.location.search, '?q=NELFUND%20%26%20result%20checking', 'the term is encoded, not concatenated raw');
  assert.deepEqual(seen, ['/search?q=NELFUND%20%26%20result%20checking'], 'one event, not one per keystroke');
  assert.equal(new URLSearchParams(dom.window.location.search).get('q'), 'NELFUND & result checking', 'the page reads the term back unchanged');
});

test('the search page is the other end of that contract', () => {
  const page = read('pages/SearchPage.tsx');
  assert.match(page, /new URLSearchParams\(window\.location\.search\)\.get\('q'\)/, 'the page reads q from the URL');
  assert.match(page, /\.trim\(\) \|\| ''/, 'and treats a missing term as empty rather than crashing');
});

test('the bar survives the widths the header search does not', () => {
  const portal = read('src/edu-portal.css');
  // The header form is hidden under 1040px; the home bar has no such rule, and
  // its field is allowed to shrink, which is what keeps it usable on a phone.
  assert.match(portal, /@media\(max-width:1040px\)\{\.hub-global-search\{display:none\}\}/);
  const hidingRules = [...portal.matchAll(/@media\([^)]*\)\{[^@]*?\.er-search\{[^}]*display:none/g)];
  assert.deepEqual(hidingRules.map((match) => match[0]), [], 'the portal bar is never hidden by a breakpoint');
  assert.match(portal, /\.er-search\{[^}]*height:44px/, 'the bar keeps its 44px row');
  assert.match(portal, /\.er-search input\{[^}]*flex:1;/, 'the field takes the remaining width');
  assert.match(portal, /\.er-search input\{[^}]*min-width:0/, 'and can shrink below its content size');
  // A 34px button inside a 44px row with 4px padding is a 34px target, not 44;
  // the row is the touch target and the button fills its height.
  assert.match(portal, /\.er-search button\{[^}]*height:34px/, 'the submit keeps its authored height');
});

// ---------------------------------------------------------------------------
// Matching (Phase 10)
// ---------------------------------------------------------------------------

test('search matches words in any order and ignores punctuation', async () => {
  const { matchesSearch, normalizeSearchText, searchTokens } = await import('../src/lib/searchMatch');

  const slip = ['JAMB exam slip', 'Print your UTME examination slip from the JAMB portal.', 'Services'];
  assert.equal(matchesSearch(slip, 'jamb slip'), true, 'two words in a different order still match');
  assert.equal(matchesSearch(slip, 'JAMB?'), true, 'punctuation does not defeat the match');
  assert.equal(matchesSearch(slip, '  slip   jamb  '), true, 'whitespace is normalised');
  assert.equal(matchesSearch(slip, 'JAMB-SLIP'), true, 'a hyphen is a separator, not a character');
  assert.equal(matchesSearch(slip, 'waec'), false, 'a word that is not there is not a match');
  assert.equal(matchesSearch(slip, ''), true, 'an empty query matches the catalogue');
  assert.equal(matchesSearch([null, undefined, ''], 'jamb'), false, 'empty fields are not a false positive');
  assert.equal(matchesSearch(['Université de Lagos'], 'universite'), true, 'accents are folded');
  assert.equal(matchesSearch(['Result checking'], 'checking result'), true, 'token order is free');

  assert.equal(normalizeSearchText('  NELFUND — Loan & Grant! '), 'nelfund loan grant');
  assert.deepEqual(searchTokens('jamb jamb slip'), ['jamb', 'slip'], 'repeated words are one requirement');
});

test('the search page uses the matcher and admits a partial failure', () => {
  const page = read('pages/SearchPage.tsx');
  assert.match(page, /matchesSearch\(\[result\.title, result\.description, result\.category\], query\)/, 'the matcher is used, not includes()');
  assert.doesNotMatch(page, /value\.includes\(query\.toLowerCase\(\)\)/, 'the old substring comparison is gone');
  assert.match(page, /const guard = /, 'each live source fails independently');
  assert.match(page, /setPartialFailure\(failed\)/, 'the failure is recorded');
  assert.match(page, /Some live results could not be loaded/, 'the page says the list may be incomplete');
  assert.match(page, /role="status"/, 'and announces it');
});
