import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// UI-3: deep green is the colour of an action; crimson is the brand accent.
//
// The palette had drifted into "crimson is the default button", set
// independently by five component sheets. This file pins the replacement rules
// so the drift cannot restart: the tokens, the selectors that may be recoloured,
// the selectors that must not be, and the contrast of each state.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

const theme = read('src/styles/theme.css');
const actions = read('src/styles/brand-actions.css');

const luminance = (hex: string): number => {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (a: string, b: string): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

test('the palette is defined once, in the token layer', () => {
  const token = (name: string): string => {
    const match = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(theme);
    assert.ok(match, `${name} is defined in src/styles/theme.css`);
    return match[1].toUpperCase();
  };

  assert.equal(token('--er-primary'), '#174A3A', 'primary action is deep green');
  assert.equal(token('--er-on-primary'), '#FFFFFF', 'text on a primary action is white');
  assert.equal(token('--er-crimson'), '#B14933', 'crimson stays the brand accent');

  // Hover and pressed must darken, not lighten: white text has to keep its
  // contrast as the fill changes.
  assert.equal(token('--er-primary-hover'), '#123A2D', 'hover steps down one shade');
  assert.equal(token('--er-primary-active'), '#0E3025', 'press steps down again');
  assert.equal(token('--er-primary-soft'), '#EDF5F0', 'the selected surface is pale green');
  assert.equal(token('--er-primary-soft-border'), '#D4E4DA', 'the selected edge is pale green');

  const hover = token('--er-primary-hover');
  const active = token('--er-primary-active');
  assert.ok(luminance(hover) < luminance('#174A3A'), 'hover is darker than rest');
  assert.ok(luminance(active) < luminance(hover), 'pressed is darker than hover');
});

test('the action colour clears AA at every state', () => {
  for (const [fill, label] of [
    ['#174A3A', 'resting'],
    ['#123A2D', 'hover'],
    ['#0E3025', 'pressed'],
  ] as const) {
    assert.ok(contrast('#ffffff', fill) >= 4.5, `white text on the ${label} fill`);
  }
  // The primary is also used as a link and icon colour on light surfaces.
  assert.ok(contrast('#174A3A', '#ffffff') >= 4.5, 'primary text on white');
  assert.ok(contrast('#174A3A', '#f7f9fc') >= 4.5, 'primary text on the page background');
  // Crimson remains readable where it is kept.
  assert.ok(contrast('#b14933', '#ffffff') >= 4.5, 'crimson brand accent on white');
});

test('only the action surfaces are recoloured by the final layer', () => {
  // A curated list, on purpose: adding a selector here is a decision to change
  // a component's colour, and it should be reviewed as one.
  const expected = [
    '.hub-primary-btn',
    '.hub-primary-btn:hover',
    '.hub-primary-btn:active',
    '.hub-primary-btn:disabled, .admin-btn:disabled, .dash-btn-primary:disabled, .auth-v2-submit:disabled, .er-exam-submit-primary:disabled, .er-exam-next:disabled, .er-exam-end:disabled',
    ':is(.hub-primary-btn, .admin-btn, .dash-btn-primary, .auth-v2-submit, .er-exam-submit-primary)[aria-busy="true"]',
    '.admin-btn',
    '.admin-btn:hover',
    '.dash-btn-primary',
    '.dash-btn-primary:hover:not(:disabled)',
    '.auth-v2-submit',
    '.auth-v2-submit:hover',
    '.hub-outline-btn, .dash-btn-secondary, .er-exam-ghost, .admin-page-header .admin-btn.secondary, .admin-card .admin-btn.secondary, .admin-inline-form .admin-btn.secondary',
    ':is(.hub-outline-btn, .dash-btn-secondary, .er-exam-ghost, .admin-page-header .admin-btn.secondary, .admin-card .admin-btn.secondary, .admin-inline-form .admin-btn.secondary):hover',
    ':is(.hub-outline-btn, .dash-btn-secondary, .er-exam-ghost, .admin-page-header .admin-btn.secondary, .admin-card .admin-btn.secondary, .admin-inline-form .admin-btn.secondary):active',
    ':is(.hub-outline-btn, .dash-btn-secondary, .er-exam-ghost, .admin-page-header .admin-btn.secondary, .admin-card .admin-btn.secondary, .admin-inline-form .admin-btn.secondary):disabled',
    '.er-pill:hover',
    '.er-pill.active',
    '.er-library-tabs button:hover',
    '.er-library-tabs button.active',
    '.er-setup-duration-option:hover',
    '.er-setup-duration-option.is-selected',
    '.er-mode-option.is-selected',
    '.hub-stepper > div.active',
    '.hub-stepper > div.active span',
    '.hub-card-link, .hub-section-heading.compact > a, .hub-auth-switch, .dash-card-link',
    '.dash-card-link:hover',
    ':is(.hub-card-link, .hub-section-heading.compact > a, .hub-auth-switch, .hub-home-section-title > a, .er-inline-notice-action):hover',
    ':is(.hub-card-link, .hub-section-heading.compact > a, .hub-auth-switch, .hub-home-section-title > a):active',
    '.er-route-progress',
    '.home-resume-kicker',
    '.home-resume-bar',
    '.home-resume-bar span',
    '.er-exam-subject-tab.is-current',
    '.er-exam-subject-tab.is-current span',
    '.er-exam-subject-name',
    '.er-exam-option:hover',
    '.er-exam-option.is-selected',
    '.er-exam-option.is-selected .er-exam-option-letter',
    '.er-exam-submit-primary',
    '.er-exam-submit-primary:hover',
    '.er-exam-submit-primary:active',
    '.er-exam-palette-cell.is-current',
    '.er-exam-ghost:hover',
    '.er-exam-tool:hover',
    '.er-setup-subject-chip input',
    '.hub-global-search:focus-within',
    '.edureach-dash-search input:focus',
    '.er-admin-view-banner button',
    '.er-admin-view-banner button:hover',
    '.hub-home-section-title > a',
    '.hub-home-tool-icon',
    '.hub-mobile-search button, .er-site-search-page-form button',
    '.hub-mobile-search button:hover, .er-site-search-page-form button:hover',
    '.target-track span',
    '.wallet-presets button.selected, .preset-grid button.selected',
    '.hub-desktop-nav a:hover',
    '.er-mobile-bottom-nav a:hover',
    '.er-mobile-bottom-nav a.active',
    '.er-sim-cta:hover',
  ];

  const selectors = [...actions.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)]
    .map((match) => match[1].trim().replace(/\s+/g, ' '))
    .filter((selector) => selector && !selector.startsWith('@'));
  assert.deepEqual(selectors, expected, 'the recolour surface is exactly this list');
});

test('the layer never touches a card, tile, banner or exam identity', () => {
  const forbidden = /-card\b|-tile\b|banner|identity|sim-card|service-card|news-row|hero|surface/;
  const selectors = [...actions.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)]
    .map((match) => match[1].trim());
  // Judge the subject of the selector - the element whose colour changes -
  // not its ancestors: `.er-admin-view-banner button` recolours a button that
  // happens to sit in a banner, it does not restyle the banner.
  const subjectOf = (selector: string): string => selector.split(/\s+/).at(-1) ?? selector;
  const offenders = selectors.filter((selector) => {
    const subject = subjectOf(selector);
    if (/^(button|a|input|svg)\b/.test(subject)) return false;
    return forbidden.test(subject) && !subject.includes('link');
  });
  assert.deepEqual(offenders, [], 'no card surface is restyled by the action layer');

  // Spot-check the card treatments that must survive untouched.
  const hub = read('src/hub.css');
  const banner = /\.hub-service-banner\{([^}]*)\}/.exec(hub);
  assert.ok(banner && banner[1].includes('background:var(--hub-blue)'), 'the service card banner keeps its own fill');
  assert.match(hub, /\.hub-service-profile-card\{[^}]*border:1px solid var\(--hub-border\)/, 'the service card keeps its border');
  const portal = read('src/edu-portal.css');
  assert.match(portal, /\.er-sim-card/, 'exam tiles still have their own identity colours');
});

test('crimson is no longer the default fill of any primary action', () => {
  const actionSheets = ['src/styles/brand-actions.css', 'src/styles/theme.css', 'src/home-card-first.css'];
  const offenders: string[] = [];
  for (const sheet of actionSheets) {
    const css = read(sheet);
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = match[1].trim();
      const declarations = match[2];
      const isAction = /primary-btn|submit|home-cta|admin-btn(?!\.)|dash-btn-primary/.test(selector);
      if (!isAction) continue;
      if (/--er-crimson|#b14933|#B14933|#B3331A/i.test(declarations)) offenders.push(`${sheet} → ${selector}`);
    }
  }
  assert.deepEqual(offenders, [], 'no primary action is filled with crimson');
});

test('inline action styles reference the token instead of a literal', () => {
  // Inline styles beat class rules, so a literal here would silently defeat the
  // palette. Every primary action in JSX uses var(--er-primary).
  const files = [
    'pages/AuthPageV2.tsx',
    'pages/ComingSoonPage.tsx',
    'pages/NotFoundPage.tsx',
    'pages/ServiceApplyPage.tsx',
    'src/components/HubLayout.tsx',
    'src/app/ErrorBoundary.tsx',
  ];
  const offenders: string[] = [];
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/background:\s*'(#[0-9A-Fa-f]{6})'/g)) {
      if (['#b14933', '#B14933', '#B3331A', '#2563eb', '#1d4ed8'].includes(match[1])) offenders.push(`${file}: ${match[1]}`);
    }
  }
  assert.deepEqual(offenders, [], 'no inline primary fill is hard-coded');
});
