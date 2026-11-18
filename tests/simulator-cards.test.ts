import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * The shared CBT simulator card.
 *
 * The point of this file is not that a tint exists somewhere in the repository.
 * It is that:
 *
 *   * there is ONE card component, mounted by the homepage, the public Practice
 *     page and the dashboard CBT tab;
 *   * colour is bound to a canonical exam type, not to a card's position;
 *   * the treatment is a faint tinted surface — no gradient, no white-on-fill
 *     panel — and the title still clears AA on its own tint.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const product = read('src/styles/ux5-product.css');
const portal = read('src/edu-portal.css');
const card = read('src/components/SimulatorCard.tsx');
const grid = read('src/components/ExamSimulatorGrid.tsx');
const data = read('src/data/simulators.ts');

/** Leaf rules of a stylesheet as [selector, declarations] pairs. */
function rules(css: string): Array<[string, string]> {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Array<[string, string]> = [];
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push([match[1].trim(), match[2]]);
  }
  return out;
}

/** The tint and title tone each examination declares, read from the sheet. */
const EXPECTED: Record<string, { tint: string; title: string; accent: string }> = {
  jamb: { tint: '#f4f8f2', title: '#17332c', accent: '#174A3A' },
  waec: { tint: '#f2f6fb', title: '#1b3c57', accent: '#1f4e78' },
  neco: { tint: '#f9f7ee', title: '#403a12', accent: '#5f5417' },
  'post-utme': { tint: '#fbf4f0', title: '#4d2418', accent: '#7d3a26' },
};

function tintRule(type: string): string {
  const found = rules(product).find(
    ([selector]) =>
      selector.includes(`[data-exam-type='${type}']`) && selector.includes('er-sim-card'),
  );
  assert.ok(found, `the ${type} simulator must declare its own tint`);
  return found![1];
}

test('each examination keeps its own faint tint, bound to its canonical type', () => {
  for (const [type, tone] of Object.entries(EXPECTED)) {
    const body = tintRule(type).replace(/\s+/g, ' ');
    assert.ok(
      body.toLowerCase().includes(`--er-sim-tint: ${tone.tint}`.toLowerCase()),
      `${type} must carry the faint tint ${tone.tint}`,
    );
    assert.ok(
      body.toLowerCase().includes(`--er-sim-title: ${tone.title}`.toLowerCase()),
      `${type} must carry its readable title tone`,
    );
    assert.ok(
      body.toLowerCase().includes(`--er-sim-accent: ${tone.accent}`.toLowerCase()),
      `${type} must carry its accent`,
    );
    // Faint means faint: every channel of the tint stays above 0.9 brightness.
    const [r, g, b] = [1, 3, 5].map((offset) => Number.parseInt(tone.tint.slice(offset, offset + 2), 16));
    assert.ok(
      [r, g, b].every((channel) => channel >= 235),
      `${tone.tint} is a light surface, not a fill`,
    );
  }
});

test('the simulator surface is a tint, not a gradient', () => {
  for (const [selector, body] of rules(product)) {
    if (!selector.includes('er-sim')) continue;
    assert.doesNotMatch(body, /linear-gradient|radial-gradient/, `${selector} must stay a flat surface`);
  }
  for (const [selector, body] of rules(portal)) {
    if (!selector.includes('er-sim')) continue;
    assert.doesNotMatch(body, /linear-gradient|radial-gradient/, `${selector} must stay a flat surface`);
  }
  // The old exam gradients are gone from the sheets that own the simulator
  // cards, not merely overridden further down the cascade.
  for (const sheet of ['src/styles/ux5-product.css', 'src/edu-portal.css']) {
    const css = read(sheet);
    for (const stops of ['#123f5a', '#1d6585', '#4c1d95', '#6d28d9', '#7c2d12', '#c2410c']) {
      assert.ok(
        !new RegExp(`linear-gradient\\([^)]*${stops}`, 'i').test(css),
        `${sheet} no longer paints a heavy exam gradient (${stops})`,
      );
    }
  }
});

test('colour follows the exam type, not the card position', () => {
  for (const [selector, body] of rules(product)) {
    if (!selector.includes('er-sim')) continue;
    if (!/--er-sim-(tint|accent):/.test(body)) continue;
    assert.doesNotMatch(
      selector,
      /nth-child|nth-of-type|first-child|last-child/,
      `a simulator tint must not depend on card order: ${selector}`,
    );
  }
  assert.doesNotMatch(product, /\.er-sim-card:nth-child/, 'no positional selector assigns a tint');
});

test('the grid emits a canonical exam type for each card', () => {
  assert.match(card, /data-exam-type=\{simulator\.examType \?\? undefined\}/, 'each card carries its canonical exam type');
  assert.match(data, /export function simulatorExamType\(/, 'the type comes from one normalizer');
  assert.match(data, /SIMULATOR_EXAM_TYPES/, 'the four types are declared once');
  assert.doesNotMatch(card, /nth-child/, 'the component does not colour by position');
});

test('exam spellings collapse onto the canonical four', async () => {
  const { simulatorExamType } = await import('../src/data/simulators');
  assert.equal(simulatorExamType('JAMB'), 'jamb');
  assert.equal(simulatorExamType('UTME'), 'jamb');
  assert.equal(simulatorExamType('  waec '), 'waec');
  assert.equal(simulatorExamType('NECO'), 'neco');
  assert.equal(simulatorExamType('Post-UTME'), 'post-utme');
  assert.equal(simulatorExamType('POSTUTME'), 'post-utme');
  assert.equal(simulatorExamType('Post UTME'), 'post-utme');
  // A bank EduReach has no profile for keeps the neutral surface rather than
  // taking whichever tint happens to be fourth today.
  assert.equal(simulatorExamType('NABTEB'), null);
  assert.equal(simulatorExamType(''), null);
});

test('one card component is mounted by every surface that offers a simulator', () => {
  for (const surface of ['pages/HubHomePage.tsx', 'pages/CbtPage.tsx', 'pages/StudentDashboardV2.tsx']) {
    assert.match(read(surface), /ExamSimulatorGrid/, `${surface} renders the shared simulator grid`);
  }
  assert.match(grid, /import SimulatorCard from '\.\/SimulatorCard'/, 'the grid renders the shared card');
  assert.match(grid, /<SimulatorCard key=\{simulator\.key\}/, 'every card is the shared component');
  assert.match(data, /export function buildSimulatorCards/, 'the cards are built from the published catalogue');
  // No second card implementation clones the simulator markup.
  for (const surface of ['pages/HubHomePage.tsx', 'pages/CbtPage.tsx', 'pages/StudentDashboardV2.tsx']) {
    assert.doesNotMatch(read(surface), /className="er-sim-card/, `${surface} does not hand-roll a simulator card`);
  }
});

test('title ink clears AA on its own faint tint', () => {
  const channel = (value: number) => {
    const ratio = value / 255;
    return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) => {
    const value = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const contrast = (a: string, b: string) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };

  for (const [type, tone] of Object.entries(EXPECTED)) {
    const ratio = contrast(tone.title, tone.tint);
    assert.ok(ratio >= 4.5, `the ${type} title tone is ${ratio.toFixed(2)}:1 on its tint, below 4.5:1`);
    const accent = contrast(tone.accent, tone.tint);
    assert.ok(accent >= 4.5, `the ${type} accent is ${accent.toFixed(2)}:1 on its tint, below 4.5:1`);
  }
});

test('the card keeps its own layout, link and interaction', () => {
  assert.match(product, /\.er-sim-card \{\s[^}]*min-height: 148px/, 'the desktop card keeps its height');
  assert.match(product, /\.er-sim-card \{\s[^}]*padding: var\(--er-space-4\)/, 'and its padding');
  assert.match(product, /@media \(max-width: 640px\) \{\s*\.er-sim-grid/, 'the phone layout is still defined');
  assert.match(card, /href=\{simulator\.href\}/, 'each card still routes to its own simulator');
  assert.match(product, /prefers-reduced-motion[\s\S]*?\.er-sim-card:hover \{\s*transform: none/, 'motion stays optional');
});

test('one compact geometry replaces the old square cards', () => {
  const base = rules(product).find(([selector]) => selector === '.er-sim-card');
  assert.ok(base, 'the desktop card has one base rule');
  assert.match(base![1], /aspect-ratio: auto/, 'the retired square ratio cannot set the height');
  assert.match(base![1], /min-height: 148px/, 'the desktop card keeps its compact floor');
  assert.match(base![1], /height: 219px/, 'every desktop surface uses the same fixed row height');
  assert.match(base![1], /justify-content: flex-start/, 'content is aligned, not spread by a legacy rule');

  const mobile = /@media \(max-width: 640px\) \{\s*\.er-sim-grid[\s\S]*?\.er-sim-card \{([^}]*)\}/.exec(product);
  assert.ok(mobile, 'the phone card has its own contract');
  assert.match(mobile![1], /aspect-ratio: auto/, 'a phone row is never a square');
  assert.match(mobile![1], /height: 84px/, 'and stays one fixed compact row');
  assert.match(mobile![1], /min-height: 84px/, 'with the same touch-sized floor');
  assert.match(mobile![1], /flex-direction: row/, 'logo, title and arrow share the row');
  const phoneSkeleton = /\.er-sim-grid \.er-skeleton-tile \{([^}]*)\}/.exec(
    product.slice(product.indexOf('@media (max-width: 640px) {\n  .er-sim-grid')),
  );
  assert.ok(phoneSkeleton, 'the phone placeholder has its own rule');
  assert.match(phoneSkeleton![1], /height: 84px/, 'the loading placeholder reserves the same compact row');
  assert.match(phoneSkeleton![1], /aspect-ratio: auto/, 'and drops the old square tile');
  const desktopSkeleton = /\.er-sim-grid \.er-skeleton-tile \{([^}]*)\}/.exec(product);
  assert.ok(desktopSkeleton, 'the desktop placeholder has its own rule');
  assert.match(desktopSkeleton![1], /height: 219px/, 'desktop placeholder matches the finished card');
});

test('the card hover animates content, not the grid footprint', () => {
  const hover = rules(product).find(([selector]) => selector === '.er-sim-card:hover');
  assert.ok(hover, 'the hover state is defined once');
  assert.match(hover![1], /transform: translateY\(-8px\)/, 'the card lifts 8px');
  assert.doesNotMatch(hover![1], /scale\(/, 'the whole card never scales');

  const base = rules(product).find(([selector]) => selector === '.er-sim-card');
  assert.match(base![1], /transition: border-color 200ms ease-out/, 'the lift uses one 200ms beat');
  assert.match(base![1], /box-shadow: 0 1px 2px[^;]*,\s*0 8px 24px/, 'two shadows define the resting surface');
  assert.match(card, /className="er-sim-mark"/, 'the emblem has a fixed frame');
  assert.match(product, /\.er-sim-mark \{[\s\S]*?overflow: hidden/, 'the emblem frame clips the zoom');
  assert.match(product, /\.er-sim-card:hover \.er-sim-mark img \{\s*transform: scale\(1\.05\)/, 'only the image presses outward');
  assert.match(product, /transition-delay: 60ms/, 'the revealed arrow follows the metadata by 60ms');
  assert.match(product, /@media \(hover: hover\) and \(pointer: fine\)/, 'hover state stays off touch screens');
});

test('the hover is restrained and the border is hairline', () => {
  const hover = rules(product).find(([selector]) => selector === '.er-sim-card:hover');
  assert.ok(hover, 'the hover state is defined once');
  assert.match(hover![1], /border-color: var\(--er-sim-accent\)/, 'the edge takes the exam accent');
  assert.doesNotMatch(hover![1], /background/, 'the fill does not change on hover');
  const base = rules(product).find(([selector]) => selector === '.er-sim-card');
  assert.ok(base, 'the base card rule exists');
  assert.match(base![1], /box-shadow: 0 1px 2px/, 'the resting card is almost flat');
  assert.match(base![1], /transition: border-color/, 'only cheap properties animate');
});

test('a bank that cannot serve a session is described, not linked', () => {
  assert.match(card, /if \(!simulator\.available\)/, 'availability decides the element');
  assert.match(card, /aria-disabled="true"/, 'the unstartable card is announced as unavailable');
  assert.match(data, /Questions being prepared/, 'the catalogue states why the bank cannot start');
  assert.match(card, /\{simulator\.meta\}/, 'the card prints that state instead of an arrow');
});

test('the card family is not a second colour system for other cards', () => {
  // Every rule that receives a tint token must be a simulator card. News,
  // opportunities, admin and service cards keep their own palette.
  for (const [selector, body] of rules(product)) {
    if (!body.includes('--er-sim-tint:')) continue;
    assert.match(selector, /er-sim/, `a simulator tint was applied outside the simulator cards: ${selector}`);
  }
  const newsRules = rules(product).filter(([selector]) => selector.includes('er-news-card'));
  assert.ok(newsRules.length > 0, 'news card rules still exist');
  for (const [selector, body] of newsRules) {
    for (const tone of Object.values(EXPECTED)) {
      assert.ok(
        !body.toLowerCase().includes(tone.tint) && !body.toLowerCase().includes(tone.accent.toLowerCase()),
        `${selector} must not borrow a simulator tint`,
      );
    }
  }
});

test('an exam hub deep link opens Practice on that examination', () => {
  const practice = read('pages/CbtPage.tsx');
  const hub = read('pages/ExamHubPage.tsx');

  assert.match(
    practice,
    /new URLSearchParams\(window\.location\.search\)\.get\('mode'\)/,
    'Practice reads the examination the hub asked for',
  );
  assert.match(practice, /initialFilter=\{requestedMode\}/, 'and hands it to the shared grid');
  assert.match(practice, /onFilterChange=\{syncModeToUrl\}/, 'while keeping the address in step with the pill row');
  assert.match(grid, /useState\(\(\) => simulatorExamType\(initialFilter\) \?\? 'ALL'\)/, 'the grid normalises any spelling onto the canonical four');

  for (const mode of ['jamb', 'waec', 'neco', 'post-utme']) {
    assert.ok(hub.includes(`/cbt?mode=${mode}`), `the ${mode} hub links to its filtered simulator list`);
  }
  assert.doesNotMatch(hub, /Question Banks', href: '\/cbt\?mode=/, 'the old unfiltered bank wording is gone');
});
