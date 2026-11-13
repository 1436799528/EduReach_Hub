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
  const search = read('src/components/SiteSearch.tsx');
  assert.match(search, /navigateInApp\(normalized \? `\/search\?q=\$\{encodeURIComponent\(normalized\)\}` : '\/search'\)/, 'all search fields share the same route behavior');
});

test('the bar survives the widths the header search does not', () => {
  const portal = read('src/site-search.css');
  // The header form is hidden under 1040px; the home bar has no such rule, and
  // its field is allowed to shrink, which is what keeps it usable on a phone.
  assert.match(portal, /@media \(max-width: 1040px\) \{ \.site-search--header \{ display: none; \} \}/);
  assert.match(portal, /\.site-search--home \{[^}]*min-height: 48px/);
  assert.match(portal, /\.site-search input \{[^}]*min-width: 0/);
  assert.match(portal, /\.site-search > button\[type="submit"\] \{[^}]*min-height: 44px/);
  assert.match(portal, /@media \(max-width: 768px\)[\s\S]*?\.site-search--home, \.site-search--page, \.site-search--drawer \{ width: 100%; \}/);
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

test('the search page uses the shared matcher and reports incomplete live sources', () => {
  const page = read('pages/SearchPage.tsx');
  assert.match(page, /filterSearchItems\(catalog\?\.items \|\| \[\], query/, 'the shared matcher filters current catalogue items');
  assert.doesNotMatch(page, /value\.includes\(query\.toLowerCase\(\)\)/, 'the old substring comparison is gone');
  const catalog = read('src/lib/siteSearch.ts');
  assert.match(catalog, /Promise\.allSettled\(\[fetchNews\(\), fetchCbtExams\(\), fetchOpportunities\(\)\]\)/, 'live sources fail independently');
  assert.match(catalog, /partialFailure: settled\.some/, 'partial failures are retained');
  assert.match(page, /Some live results could not be loaded/, 'the page says the list may be incomplete');
  assert.match(page, /role="status"/, 'and announces it');
});

test('shared search supports a suggestion list, keyboard controls, and lazy catalogue loading', () => {
  const component = read('src/components/SiteSearch.tsx');
  assert.match(component, /role={suggestionsEnabled \? 'combobox' : undefined}/);
  assert.match(component, /const suggestionsEnabled = variant !== 'page'/, 'the full results page does not overlay its result cards');
  assert.match(component, /role="listbox"/);
  assert.match(component, /role="option"/);
  assert.match(component, /event\.key === 'ArrowDown' \? 1 : event\.key === 'ArrowUp' \? -1 : 0/);
  assert.match(component, /event\.key === 'Escape'/);
  assert.match(component, /import\('\.\.\/lib\/siteSearch'\)/, 'catalogue code is loaded only when needed');
  assert.match(component, /aria-activedescendant=/);
  assert.match(component, /if \(suggestionsEnabled && activeIndex >= 0 && visibleItems\[activeIndex\]\)/, 'Enter submits the active suggestion from the form handler');
});

test('search suggestions rank exact and title-prefix matches without sending query text', async () => {
  const { filterSearchItems } = await import('../src/lib/searchMatch');
  const items = [
    { title: 'Past questions', description: 'Study materials', category: 'Library', id: 'later' },
    { title: 'Physics', description: 'Subject', category: 'Practice', id: 'prefix' },
    { title: 'Physics practice', description: 'Timed session', category: 'CBT', id: 'exact' },
  ];
  assert.deepEqual(filterSearchItems(items, 'physics').map((item) => item.id), ['prefix', 'exact']);
  assert.deepEqual(filterSearchItems(items, 'study').map((item) => item.id), ['later']);
  assert.deepEqual(filterSearchItems(items, 'not-present'), []);
});
