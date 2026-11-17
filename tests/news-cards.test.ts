import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { NEWS_TONES, newsToneClass, newsToneFor } from '../src/lib/newsTone';
import { newsCategories } from '../src/data/newsCategories';

// NEWS-1: the news board goes back to the coloured card the rest of EduReach
// uses. The rules below are the ones a reader would notice if they regressed:
// a white square instead of the brand gradient, a card without its own image,
// two cramped cards per screen on a phone, or a gradient whose white type does
// not clear contrast.

const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const portal = read('src/edu-portal.css');
const product = read('src/styles/ux5-product.css');
const sections = read('src/components/NewsSections.tsx');
const newsPage = read('pages/NewsPage.tsx');
const cbtPage = read('pages/CbtPage.tsx');
const layout = read('src/components/HubLayout.tsx');

const newsBlock = portal.slice(
  portal.indexOf('/* NEWS-1 — the coloured news card is back.'),
  portal.indexOf('/* UI-7 — Post-UTME school selection'),
);

function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test('a news card is a gradient surface, not a white box', () => {
  assert.match(newsBlock, /\.er-news-card \{[\s\S]*?background: var\(--er-news-gradient\)/, 'the card paints its tone');
  assert.match(newsBlock, /--er-news-gradient: linear-gradient\(/, 'a gradient is defined');
  const base = /\.er-news-card \{([\s\S]*?)\}/.exec(newsBlock)?.[1] ?? '';
  assert.doesNotMatch(base, /background: #fff/, 'the white surface is gone');
  assert.doesNotMatch(base, /aspect-ratio: 1 \/ 1/, 'the 1:1 square is gone');
  assert.match(base, /color: #fff/, 'type on the gradient is white');
});

test('every tone clears contrast for headlines and secondary copy', () => {
  const tones = [...newsBlock.matchAll(/--er-news-gradient: linear-gradient\(150deg, (#[0-9a-f]{6}) 0%/gi)];
  assert.ok(tones.length >= NEWS_TONES.length, `expected a gradient per tone, found ${tones.length}`);
  for (const [, light] of tones) {
    // White headlines sit on the lightest pixel at the top-left of the card.
    assert.ok(contrast('#ffffff', light) >= 4.5, `white on ${light} is ${contrast('#ffffff', light).toFixed(2)}:1`);
    assert.ok(contrast('#e8eefc', light) >= 4.5, `secondary text on ${light} is ${contrast('#e8eefc', light).toFixed(2)}:1`);
  }
  assert.match(newsBlock, /--er-news-gradient: linear-gradient\(150deg, #2459c8 0%, #173d91 100%\);[\s\S]*?\.er-news-tone-indigo/, 'the default tone is the indigo pair');
});

test('colour comes from the category, never from row order', () => {
  for (const tone of NEWS_TONES) {
    assert.ok(newsBlock.includes(`.er-news-tone-${tone} {`), `${tone} has a rule`);
  }
  assert.match(sections, /newsToneClass\(item\.category\)/, 'the card asks for its tone');
  assert.doesNotMatch(newsBlock, /er-news-card:nth-child/, 'position in the grid cannot choose the colour');
  for (const category of newsCategories) {
    assert.equal(newsToneFor(category.slug), newsToneFor(category.slug), `${category.slug} is stable`);
    assert.ok(NEWS_TONES.includes(newsToneFor(category.slug)), `${category.slug} resolves to a known tone`);
  }
  // A category written in the newsroom tomorrow still renders as a real card.
  assert.ok(NEWS_TONES.includes(newsToneFor('a-category-added-tomorrow')));
  assert.equal(newsToneFor('a-category-added-tomorrow'), newsToneFor('a-category-added-tomorrow'));
  assert.equal(newsToneClass('jamb'), 'er-news-tone-indigo');
});

test('every card leads with the article image it actually has', () => {
  assert.match(sections, /<span className="er-news-card-media"><NewsImage item=\{item\} className="er-news-photo" \/><\/span>/);
  assert.match(newsBlock, /\.er-news-card-media \.er-news-photo \{[\s\S]*?object-fit: cover/, 'the photo fills its frame instead of letterboxing');
  assert.match(newsBlock, /\.er-news-card \.er-news-card-media \{[\s\S]*?aspect-ratio: 16 \/ 10/, 'the frame has a stable shape so the feed cannot jump');
  // A story without a picture gets a labelled panel on the same gradient, not a
  // borrowed stock photo.
  assert.match(newsBlock, /\.er-news-card-media \.er-news-noimage \{[\s\S]*?color: #e8eefc/, 'the placeholder is legible on the gradient');
  assert.match(sections, /element\.replaceWith\(placeholder\)/, 'a broken image swaps to the shared placeholder');
});

test('a phone shows one card per screen and snaps as it scrolls', () => {
  const mobile = /@media \(max-width: 640px\) \{([\s\S]*?)\n\}/.exec(newsBlock)?.[1] ?? '';
  assert.match(mobile, /\.er-news-card-grid \{[\s\S]*?display: flex/, 'the grid becomes a scroller');
  assert.match(mobile, /scroll-snap-type: x mandatory/, 'each card snaps');
  assert.match(mobile, /\.er-news-card-grid > \.er-news-card \{[\s\S]*?flex: 0 0 100%/, 'one card fills the screen');
  assert.match(mobile, /scroll-snap-align: start/, 'the snap is to the card start');
  assert.match(mobile, /aspect-ratio: 16 \/ 9/, 'the image frame is wider on a phone');
  // The homepage feed uses the same behaviour, and the square card system that
  // used to force 1:1 is explicitly taken back off news cards.
  assert.match(product, /\.er-square-grid > a\.er-news-card \{[\s\S]*?aspect-ratio: auto !important/, 'news leaves the square system');
  const homeMobile = product.slice(product.indexOf('@media (max-width: 640px) {', product.indexOf('NEWS-1 — news cards stop being white squares')));
  assert.match(homeMobile, /\.er-home-news \.er-square-grid \{[\s\S]*?scroll-snap-type: x mandatory/, 'the home feed snaps too');
  assert.match(homeMobile, /\.er-home-news \.er-square-grid > \.er-news-card \{[\s\S]*?flex: 0 0 100% !important/, 'and shows one card per screen');
});

test('the phone header keeps its brand and its menu on screen', () => {
  assert.match(layout, /className="hub-header"/, 'the header carries a stable hook');
  assert.match(layout, /className="hub-container hub-header-row"/, 'and so does its row');
  const header = /@media \(max-width: 640px\) \{\n  header\.hub-header \{([\s\S]*?)\n\}/.exec(portal)?.[1] ?? '';
  assert.ok(header.length > 0, 'the phone header rules exist');
  assert.match(header, /padding-top: env\(safe-area-inset-top/, 'a standalone window keeps the top edge clear');
  assert.match(header, /\.hub-header-row \{[\s\S]*?flex-wrap: nowrap/, 'the row cannot wrap into a second line');
  assert.match(header, /\.hub-brand-link img \{[\s\S]*?max-width: 132px/, 'the wordmark shrinks before anything is clipped');
  assert.match(header, /\.hub-menu-label \{ display: none; \}/, 'the Menu button loses its label but keeps its aria-label');
  assert.match(layout, /aria-label="Open mobile menu"/, 'and it is still named for assistive tech');
});

test('the practice page is one simulator hub, not a second card system', () => {
  // The white simulator tiles and the coloured bank rows were two lists of the
  // same banks. Practice now renders the shared simulator grid — the same card
  // the homepage and the dashboard CBT tab use.
  assert.match(cbtPage, /<ExamSimulatorGrid[^>]*showFilters/, 'one shared simulator grid is the way in');
  assert.doesNotMatch(cbtPage, /er-bank-card|setupPathForExam|Choose a question bank/, 'the duplicate bank list is gone');
  assert.match(read('pages/HubHomePage.tsx'), /<ExamSimulatorGrid \/>/, 'the home page uses the same component');
  assert.match(read('src/components/ExamSimulatorGrid.tsx'), /<SimulatorCard key=\{simulator\.key\}/, 'and the same card');
});

test('the news page keeps its cards, its images and its empty state', () => {
  assert.match(newsPage, /<NewsCard key=\{item\.id\} item=\{item\} \/>/, 'each story renders through the shared card');
  assert.match(newsPage, /<FeaturedNews items=\{orderedItems\} \/>/, 'featured stories use the same surface');
  assert.match(newsPage, /No news content available yet/, 'an empty board still says so');
  assert.match(newsPage, /er-news-card-grid/, 'the feed uses the responsive grid');
});
