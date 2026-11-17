import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// NEWS-3: the news board is one calm surface. The rules a reader would notice if
// they regressed: a page of category gradients, a card that is not a single
// click target, a card with no image of its own, two cramped cards per screen on
// a phone, or a headline that is smaller than the label above it.

const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const portal = read('src/edu-portal.css');
const product = read('src/styles/ux5-product.css');
const sections = read('src/components/NewsSections.tsx');
const newsPage = read('pages/NewsPage.tsx');
const articlePage = read('pages/NewsArticlePage.tsx');
const cbtPage = read('pages/CbtPage.tsx');
const layout = read('src/components/HubLayout.tsx');

const newsBlock = portal.slice(
  portal.indexOf('/* NEWS-3 — one calm card for every story.'),
  portal.indexOf('/* UI-7 — Post-UTME school selection'),
);
assert.ok(newsBlock.length > 0, 'the NEWS-3 block exists');

/** A rule body from the news block, or '' when the rule is not there. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped} \\{([\\s\\S]*?)\\}`).exec(newsBlock)?.[1] ?? '';
}

test('a news card is one neutral surface, not a category gradient', () => {
  const card = rule('.er-news-card');
  assert.match(card, /background: var\(--er-surface, #fff\)/, 'the card is the plain surface');
  assert.match(card, /color: var\(--er-text-primary/, 'dark type on white');
  assert.match(card, /border: 1px solid var\(--er-border/, 'a thin border does the separating');
  assert.doesNotMatch(newsBlock, /--er-news-gradient/, 'no gradient variable survives');
  assert.doesNotMatch(newsBlock, /er-news-tone-/, 'no category tone classes survive');
  assert.doesNotMatch(newsBlock, /background: #fff !important/, 'the surface is not forced over the card reset');
  // Colour is not chosen by position, either.
  assert.doesNotMatch(newsBlock, /er-news-card:nth-child/);
  assert.doesNotMatch(newsBlock, /linear-gradient\(150deg/);
});

test('the tone system is gone from the code, not just from the stylesheet', () => {
  assert.doesNotMatch(sections, /newsTone/, 'the card no longer asks for a tone');
  assert.doesNotMatch(sections, /er-news-tone/, 'and never writes a tone class');
  assert.doesNotMatch(sections, /er-identity-card|identityClassFor/, 'nor borrows the identity-card tints');
  assert.throws(() => read('src/lib/newsTone.ts'), 'the tone module is deleted rather than orphaned');
});

test('every card leads with its own image, in a stable frame', () => {
  const media = rule('.er-news-card .er-news-card-media');
  assert.match(media, /aspect-ratio: 16 \/ 10/, 'the frame has a stable shape so the feed cannot jump');
  assert.match(media, /overflow: hidden/);
  assert.match(rule('.er-news-card-media .er-news-photo,\n.er-news-card-media .er-image img'), /object-fit: cover/, 'the photo fills its frame instead of letterboxing');
  assert.match(sections, /<span className="er-news-card-media"><NewsImage item=\{item\} className="er-news-photo" \/><\/span>/, 'the card renders the article image through the shared component');
  assert.match(sections, /<OptimizedImage[\s\S]{0,260}src=\{item\.image_url\}/, 'the image comes from the article itself');
  assert.match(sections, /placeholderLabel=\{label\}/, 'a missing or broken image renders the neutral placeholder');
  assert.match(read('src/components/OptimizedImage.tsx'), /onError=\{\(\) => setFailed\(true\)\}/, 'a failed load falls back to that placeholder');
});

test('the type has an order: label, headline, summary, source', () => {
  const kicker = rule('.er-news-card .er-news-card-kicker');
  const headline = rule('.er-news-card .er-news-card-body > strong');
  const summary = rule('.er-news-card .er-news-card-summary');
  assert.match(kicker, /color: var\(--er-text-muted/, 'the label is quiet');
  assert.match(kicker, /font-size: 11px/, 'and smaller than the headline');
  assert.match(headline, /font-size: 15\.5px/, 'the headline is the loudest line');
  assert.match(headline, /-webkit-line-clamp: 3/, 'it is clamped, not truncated mid-sentence');
  assert.match(summary, /font-size: 12\.5px/);
  assert.match(summary, /color: var\(--er-text-secondary/, 'the summary is secondary to the headline');
  const foot = rule('.er-news-card .er-news-card-foot');
  assert.match(foot, /margin-top: auto/, 'the source sits on the floor of every card');
  // The markup order matches the reading order.
  const body = /<span className="er-news-card-body">([\s\S]*?)<\/span>\n    <\/a>/.exec(sections)?.[1] ?? '';
  assert.ok(body.indexOf('er-news-card-kicker') < body.indexOf('<strong>'), 'label before headline');
  assert.ok(body.indexOf('<strong>') < body.indexOf('er-news-card-summary'), 'headline before summary');
  assert.ok(body.indexOf('er-news-card-summary') < body.indexOf('er-news-card-foot'), 'summary before source');
});

test('the whole card is the click target, and it says where it goes', () => {
  assert.match(sections, /<a className=\{`er-news-card is-\$\{freshness\.state\}`\} href=\{articleHref\(item\)\}>/, 'the anchor wraps the card');
  assert.match(rule('.er-news-card:focus-visible'), /outline: 3px solid/, 'the card shows focus');
  assert.match(sections, /er-news-card-read[\s\S]*?Read /, 'the foot carries the action, not a fake button');
  assert.doesNotMatch(sections, /<button[^>]*er-news-card/, 'a card is a link, not a button');
});

test('a phone shows one card per screen and snaps as it scrolls', () => {
  const mobile = /@media \(max-width: 640px\) \{([\s\S]*?)\n\}/.exec(newsBlock)?.[1] ?? '';
  assert.match(mobile, /\.er-news-card-grid \{\s*display: flex/, 'the grid becomes a scroller');
  assert.match(mobile, /scroll-snap-type: x mandatory/, 'each card snaps');
  assert.match(mobile, /\.er-news-card-grid > \.er-news-card \{[^}]*flex: 0 0 100%/, 'one card fills the screen');
  assert.match(mobile, /scroll-snap-align: start/, 'the snap is to the card start');
  assert.match(mobile, /\.er-news-card \.er-news-card-media \{ aspect-ratio: 16 \/ 9; \}/, 'the image frame is wider on a phone');
  assert.match(mobile, /\.er-news-card \.er-news-card-body > strong \{ font-size: 16\.5px/, 'the headline grows rather than shrinks');
  // The homepage feed uses the same behaviour, and the square card system that
  // used to force 1:1 is explicitly taken back off news cards.
  assert.match(product, /\.er-square-grid > a\.er-news-card \{[\s\S]*?aspect-ratio: auto !important/, 'news leaves the square system');
  assert.match(product, /\.er-square-grid > a\.er-news-card \{[\s\S]*?background: var\(--er-surface/, 'and keeps the neutral surface there too');
  const homeMobile = product.slice(product.indexOf('@media (max-width: 640px) {', product.indexOf('NEWS-1 / NEWS-3 — news cards leave the square system')));
  assert.match(homeMobile, /\.er-home-news \.er-square-grid \{[^}]*scroll-snap-type: x mandatory/, 'the home feed snaps too');
  assert.match(homeMobile, /\.er-home-news \.er-square-grid > \.er-news-card \{[^}]*flex: 0 0 100% !important/, 'and shows one card per screen');
});

test('the phone header keeps its brand and its menu on screen', () => {
  assert.match(layout, /className="hub-header"/, 'the header carries a stable hook');
  assert.match(layout, /className="hub-container hub-header-row"/, 'and so does its row');
  const header = /@media \(max-width: 640px\) \{\n  header\.hub-header \{([\s\S]*?)\n\}/.exec(portal)?.[1] ?? '';
  assert.ok(header.length > 0, 'the phone header rules exist');
  assert.match(header, /padding-top: env\(safe-area-inset-top/, 'a standalone window keeps the top edge clear');
  assert.match(header, /\.hub-header-row \{[^}]*flex-wrap: nowrap/, 'the row cannot wrap into a second line');
  assert.match(header, /\.hub-brand-link img \{[^}]*max-width: 132px/, 'the wordmark shrinks before anything is clipped');
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

test('the article hero uses the same image component as the cards', () => {
  assert.match(articlePage, /<OptimizedImage[\s\S]{0,300}layout="article"/, 'one image component, hero size');
  assert.match(articlePage, /priority/, 'the hero is above the fold, so it loads eagerly');
  assert.match(articlePage, /placeholderLabel=\{`\$\{newsCategoryLabel\(item\.category\)\} · no photo on file`\}/, 'no photo is stated, not faked');
  assert.doesNotMatch(articlePage, /<img\b/, 'no raw <img> is left on the article page');
  assert.doesNotMatch(articlePage, /document\.createElement\('div'\)/, 'no DOM surgery in the render path');
});
