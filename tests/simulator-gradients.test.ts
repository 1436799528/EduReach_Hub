import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * The four CBT simulator gradients.
 *
 * The point of this file is not that a gradient string exists somewhere in the
 * repository — it is that each gradient is bound to a *canonical exam type*,
 * so re-ordering or filtering the question-bank catalogue cannot repaint a
 * card, and that white type still clears AA on the lightest stop of each pair.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const product = read('src/styles/ux5-product.css');
const myschool = read('src/myschool-clean.css');
const grid = read('src/components/ExamSimulatorGrid.tsx');

/** The four gradients, exactly as the task specifies them. */
const EXPECTED: Record<string, { from: string; to: string }> = {
  jamb: { from: '#123f5a', to: '#1d6585' },
  waec: { from: '#14532d', to: '#16803f' },
  neco: { from: '#4c1d95', to: '#6d28d9' },
  'post-utme': { from: '#7c2d12', to: '#c2410c' },
};

/** Leaf rules of a stylesheet as [selector, declarations] pairs. */
function rules(css: string): Array<[string, string]> {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Array<[string, string]> = [];
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push([match[1].trim(), match[2]]);
  }
  return out;
}

function gradientRules(): Array<[string, string]> {
  return rules(product).filter(
    ([selector, body]) => selector.includes('er-sim-card') && /linear-gradient\(115deg/.test(body),
  );
}

test('the four simulator gradients are the MySchool-inspired pairs', () => {
  for (const [type, stops] of Object.entries(EXPECTED)) {
    const expected = `linear-gradient(115deg, ${stops.from}, ${stops.to})`;
    const found = gradientRules().some(
      ([selector, body]) =>
        (selector.includes(`[data-exam-type='${type}']`) || selector.includes(`.er-sim-${type}`)) &&
        body.replace(/\s+/g, ' ').toLowerCase().includes(expected.toLowerCase()),
    );
    assert.ok(found, `the ${type} simulator card must carry ${expected}`);
    // The same pair is the one the MySchool tile treatment uses. Whitespace is
    // ignored: the stylesheet minifies the stops as `#123f5a,#1d6585`.
    const squashed = (value: string) => value.replace(/\s+/g, '').toLowerCase();
    assert.ok(
      squashed(myschool).includes(squashed(expected)),
      `${expected} must be the MySchool .ms-top-tile gradient, not a new colour`,
    );
  }
});

test('colour follows the exam type, not the card position', () => {
  for (const [selector] of gradientRules()) {
    assert.doesNotMatch(
      selector,
      /nth-child|nth-of-type|first-child|last-child/,
      `a gradient must not depend on card order: ${selector}`,
    );
    for (const [otherType] of Object.entries(EXPECTED)) {
      if (selector.includes(`'${otherType}'`) || selector.includes(`.er-sim-${otherType}`)) continue;
    }
  }
  assert.doesNotMatch(
    product,
    /\.er-sim-card:nth-child/,
    'no positional selector assigns a simulator colour',
  );
});

test('the grid emits a canonical exam type for each card', () => {
  assert.match(grid, /data-exam-type=\{examType \?\? undefined\}/, 'each card carries its canonical exam type');
  assert.match(grid, /export function simulatorExamType\(/, 'the type comes from one normalizer');
  assert.match(grid, /SIMULATOR_EXAM_TYPES/, 'the four types are declared once');
  assert.doesNotMatch(grid, /nth-child/, 'the component does not colour by position');
});

test('exam spellings collapse onto the canonical four', async () => {
  const { simulatorExamType } = await import('../src/components/ExamSimulatorGrid');
  assert.equal(simulatorExamType('JAMB'), 'jamb');
  assert.equal(simulatorExamType('UTME'), 'jamb');
  assert.equal(simulatorExamType('  waec '), 'waec');
  assert.equal(simulatorExamType('NECO'), 'neco');
  assert.equal(simulatorExamType('Post-UTME'), 'post-utme');
  assert.equal(simulatorExamType('POSTUTME'), 'post-utme');
  assert.equal(simulatorExamType('Post UTME'), 'post-utme');
  // A bank EduReach does not have a gradient for keeps the neutral surface
  // rather than taking whichever colour happens to be fourth today.
  assert.equal(simulatorExamType('NABTEB'), null);
  assert.equal(simulatorExamType(''), null);
});

test('white type clears AA on the lightest stop of every gradient', () => {
  const channel = (value: number) => {
    const ratio = value / 255;
    return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) => {
    const value = hex.replace('#', '');
    const r = Number.parseInt(value.slice(0, 2), 16);
    const g = Number.parseInt(value.slice(2, 4), 16);
    const b = Number.parseInt(value.slice(4, 6), 16);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

  for (const [type, stops] of Object.entries(EXPECTED)) {
    const ratio = contrastWithWhite(stops.to);
    assert.ok(ratio >= 4.5, `white on the lightest ${type} stop (${stops.to}) is ${ratio.toFixed(2)}:1, below 4.5:1`);
  }
});

test('the gradients stay on the simulator cards', () => {
  // Every selector that receives one of the four gradients must be a simulator
  // card. News, opportunities, admin and service cards keep their own palette.
  for (const [selector] of gradientRules()) {
    assert.match(selector, /er-sim-card/, `a gradient was applied outside the simulator cards: ${selector}`);
    assert.doesNotMatch(selector, /news|opportunity|admin|hub-card|service/, `${selector} must not be a news or service card`);
  }
});

test('the news palette is untouched by this change', () => {
  const newsRules = rules(product).filter(([selector]) => selector.includes('er-news-card'));
  assert.ok(newsRules.length > 0, 'news card rules still exist');
  for (const [selector, body] of newsRules) {
    for (const stops of Object.values(EXPECTED)) {
      assert.ok(
        !body.toLowerCase().includes(stops.from) && !body.toLowerCase().includes(stops.to),
        `${selector} must not borrow a simulator gradient colour`,
      );
    }
    assert.ok(!/linear-gradient\(115deg/.test(body), `${selector} keeps its own tone system`);
  }
});

test('the card keeps its own layout, link and interaction', () => {
  assert.match(product, /\.er-sim-card \{\s[^}]*min-height: 148px/, 'the desktop card keeps its height');
  assert.match(product, /\.er-sim-card \{\s[^}]*padding: var\(--er-space-4\)/, 'and its padding');
  assert.match(product, /@media \(max-width: 640px\) \{\s*\.er-sim-grid/, 'the phone layout is still defined');
  assert.match(grid, /simulatorStartHref\(exam\.mode, exam\.id\)/, 'each card still routes to its own bank');
  assert.match(product, /prefers-reduced-motion[\s\S]*?\.er-sim-card:hover \{\s*transform: none/, 'motion stays optional');
});

test('the logo keeps a legible light plate and the overlay stays translucent', () => {
  const logoRules = rules(product).filter(
    ([selector, body]) => selector.includes('.er-sim-top img') && body.includes('rgba(255, 255, 255'),
  );
  assert.ok(logoRules.length > 0, 'the brand mark sits on a translucent light surface');
  const overlay = rules(product).filter(
    ([selector, body]) => selector.includes('.er-sim-card') && selector.includes('::before') && body.includes('linear-gradient(105deg'),
  );
  assert.ok(overlay.length > 0, 'the MySchool-style sheen overlay is present');
  for (const [, body] of overlay) {
    assert.match(body, /pointer-events: none/, 'the sheen never swallows a tap');
  }
});
