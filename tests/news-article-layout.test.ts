import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../pages/NewsArticlePage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/edu-portal.css', import.meta.url), 'utf8');
const session = readFileSync(new URL('../pages/CbtSessionPage.tsx', import.meta.url), 'utf8');
const cbtCss = readFileSync(new URL('../src/cbt-engine.css', import.meta.url), 'utf8');
const adminCss = readFileSync(new URL('../src/admin.css', import.meta.url), 'utf8');

test('article uses layout grid with a related aside, rendered only when related exist', () => {
  assert.match(page, /er-article-layout/);
  assert.match(page, /related\.length > 0 && \(\s*<aside className="er-article-aside"/);
  assert.doesNotMatch(page, /advert|ad-slot|AdSlot/i, 'no invented advertising slot');
});
test('article layout collapses to one column below desktop and reserves hero ratio', () => {
  assert.match(css, /@media\(min-width:1024px\)\{\s*\.er-article-layout\{grid-template-columns:minmax\(0,1fr\) 320px\}/);
  assert.match(css, /\.er-article-layout\{display:grid;/); // single column by default
  assert.match(css, /\.er-article-layout \.er-news-hero\{aspect-ratio:16\/9/);
  assert.match(css, /\.er-article-aside\{position:sticky/);
});
test('mobile exam bar: End Test is labelled, keeps text and 44px target, wraps into view', () => {
  assert.match(session, /className="er-exam-end"/); assert.match(session, /aria-label="End test"/);
  assert.match(cbtCss, /\.er-exam-end \.er-exam-tool-label\{display:inline\}/);
  assert.match(cbtCss, /\.er-exam-end\{margin-left:auto\}/); assert.match(cbtCss, /min-height:44px/);
  assert.doesNotMatch(cbtCss, /\.er-exam-bar-controls\{[^}]*overflow-x:auto/, 'controls no longer scroll off-screen');
});
test('admin selected nav is the green surface; mobile nav is one scrollable row', () => {
  assert.match(adminCss, /\.admin-nav-link\.active \{ background: #174A3A;/);
  assert.match(adminCss, /@media\(max-width:780px\)[\s\S]*?\.admin-nav\{display:flex;[^}]*overflow-x:auto/);
  assert.match(adminCss, /\.admin-nav-link\{flex:0 0 auto;[^}]*min-height:44px/);
});
