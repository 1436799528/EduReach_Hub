import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// UI-4: the palette is only half of a design system. This file pins the
// interaction states - hover, press, border, focus, disabled, busy - to the
// same tokens, and checks the contrast of every pair the specification names.
//
// The rule the tests defend: a state is a token, not a hex value typed at the
// point of use. If a colour changes it changes once, in src/styles/theme.css.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

const theme = read('src/styles/theme.css');
const actions = read('src/styles/brand-actions.css');
const a11y = read('src/styles/a11y.css');

const token = (name: string): string => {
  const match = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(theme);
  assert.ok(match, `${name} is defined in src/styles/theme.css`);
  return match[1].toUpperCase();
};

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

test('every state colour in the specification is a token', () => {
  const expected: Record<string, string> = {
    '--er-primary': '#174A3A',
    '--er-primary-hover': '#123A2D',
    '--er-primary-active': '#0E3025',
    '--er-primary-border': '#123A2D',
    '--er-primary-border-hover': '#0F3025',
    '--er-primary-border-active': '#0B261E',
    '--er-primary-focus': '#174A3A',
    '--er-primary-soft': '#EDF5F0',
    '--er-primary-soft-border': '#D4E4DA',
    '--er-on-primary': '#FFFFFF',
    '--er-crimson': '#B14933',
    '--er-crimson-hover': '#963D2C',
    '--er-crimson-pressed': '#803222',
    '--er-secondary-border': '#D4E4DA',
    '--er-secondary-hover-bg': '#EDF5F0',
    '--er-secondary-hover-border': '#B5CBBF',
    '--er-secondary-active-bg': '#DCE9E1',
    '--er-secondary-active-border': '#A3BFAF',
    '--er-disabled-bg': '#E2E8F0',
    '--er-disabled-text': '#64748B',
    '--er-disabled-border': '#CBD5E1',
    '--er-disabled-surface': '#F8FAFC',
    '--er-nav-hover-bg': '#F1F5F9',
    '--er-nav-active-bg': '#EDF5F0',
    '--er-field-border-hover': '#94A3B8',
    '--er-field-valid': '#15803D',
    '--er-field-invalid': '#B91C1C',
    '--er-status-success': '#166534',
    '--er-status-success-bg': '#F0FDF4',
    '--er-status-success-border': '#BBF7D0',
    '--er-status-warning': '#92400E',
    '--er-status-warning-bg': '#FFFBEB',
    '--er-status-warning-border': '#FDE68A',
    '--er-status-error': '#B91C1C',
    '--er-status-error-bg': '#FEF2F2',
    '--er-status-error-border': '#FECACA',
    '--er-status-info': '#1D4ED8',
    '--er-status-info-bg': '#EFF6FF',
    '--er-status-info-border': '#BFDBFE',
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(token(name), value, `${name} keeps its specified value`);
  }
});

test('text clears AA on every surface the specification pairs it with', () => {
  const pairs: Array<[string, string, string]> = [
    ['#FFFFFF', '#174A3A', 'primary label at rest'],
    ['#FFFFFF', '#123A2D', 'primary label on hover'],
    ['#FFFFFF', '#0E3025', 'primary label while pressed'],
    ['#174A3A', '#FFFFFF', 'secondary label at rest'],
    ['#174A3A', '#EDF5F0', 'secondary label on hover'],
    ['#123A2D', '#DCE9E1', 'secondary label while pressed'],
    ['#174A3A', '#F1F5F9', 'navigation label on hover'],
    ['#174A3A', '#EDF5F0', 'navigation label when selected'],
    ['#FFFFFF', '#B14933', 'crimson control at rest'],
    ['#FFFFFF', '#963D2C', 'crimson control on hover'],
    ['#FFFFFF', '#803222', 'crimson control while pressed'],
    ['#166534', '#F0FDF4', 'success notice'],
    ['#92400E', '#FFFBEB', 'warning notice'],
    ['#B91C1C', '#FEF2F2', 'error notice'],
    ['#1D4ED8', '#EFF6FF', 'information notice'],
    ['#64748B', '#F8FAFC', 'disabled label on the disabled surface'],
  ];
  for (const [foreground, background, label] of pairs) {
    assert.ok(contrast(foreground, background) >= 4.5, `${label} clears 4.5:1`);
  }

  // Inactive controls are exempt from 1.4.3, but they still have to be
  // readable enough to explain why they are unavailable (3:1).
  assert.ok(contrast('#64748B', '#E2E8F0') >= 3, 'disabled label stays legible on its fill');

  // Boundaries that carry a state on their own clear 3:1.
  for (const [border, label] of [
    ['#174A3A', 'focused field'],
    ['#15803D', 'valid field'],
    ['#B91C1C', 'invalid field'],
  ] as const) {
    assert.ok(contrast(border, '#FFFFFF') >= 3, `the ${label} boundary clears 3:1`);
  }
});

test('a primary action has a disabled state and a busy state', () => {
  const disabled = /\.hub-primary-btn:disabled,[\s\S]*?\{([^}]*)\}/.exec(actions);
  assert.ok(disabled, 'primary buttons declare a disabled state');
  assert.match(disabled[1], /background: var\(--er-disabled-bg\) !important/);
  assert.match(disabled[1], /color: var\(--er-disabled-text\) !important/);
  assert.match(disabled[1], /border-color: var\(--er-disabled-border\) !important/);
  assert.match(disabled[1], /cursor: not-allowed/, 'a disabled control does not invite a click');
  for (const selector of ['.admin-btn:disabled', '.dash-btn-primary:disabled', '.auth-v2-submit:disabled', '.er-exam-submit-primary:disabled']) {
    assert.ok(disabled[0].includes(selector), `${selector} is part of the disabled group`);
  }

  const busy = /\[aria-busy="true"\]\s*\{([^}]*)\}/.exec(actions);
  assert.ok(busy, 'a busy action is styled separately from a disabled one');
  assert.match(busy[1], /background: var\(--er-primary\) !important/, 'busy keeps the action colour');
  assert.match(busy[1], /cursor: progress/);
  // The label swap is what says "working"; aria-busy says it to a screen reader.
  for (const file of [
    'pages/AdminCbtPage.tsx',
    'pages/AdminNewsPage.tsx',
    'pages/AdminSchoolsPage.tsx',
    'pages/AdminServicesPage.tsx',
  ]) {
    assert.match(read(file), /disabled=\{saving\} aria-busy=\{saving\}/, `${file} marks its save button busy`);
  }
});

test('secondary controls stay white with a green edge in every state', () => {
  const base = /\.hub-outline-btn,\s*\.dash-btn-secondary,[\s\S]*?\{([^}]*)\}/.exec(actions);
  assert.ok(base, 'secondary buttons have one shared rule');
  assert.match(base[1], /background: var\(--er-surface\)/, 'secondary is not filled with green');
  assert.match(base[1], /color: var\(--er-primary\)/);
  assert.match(base[1], /border-color: var\(--er-secondary-border\)/);

  for (const [state, bg, border] of [
    ['hover', '--er-secondary-hover-bg', '--er-secondary-hover-border'],
    ['active', '--er-secondary-active-bg', '--er-secondary-active-border'],
  ] as const) {
    const rule = new RegExp(`:is\\([^)]*\\):${state}\\s*\\{([^}]*)\\}`).exec(actions);
    assert.ok(rule, `secondary ${state} state exists`);
    assert.ok(rule[1].includes(`var(${bg})`), `secondary ${state} uses its surface token`);
    assert.ok(rule[1].includes(`var(${border})`), `secondary ${state} uses its border token`);
  }

  const disabled = /:is\([^)]*\):disabled\s*\{([^}]*)\}/.exec(actions);
  assert.ok(disabled, 'secondary buttons can be disabled');
  assert.match(disabled[1], /background: var\(--er-disabled-surface\)/);
  assert.match(disabled[1], /color: var\(--er-disabled-text\)/);
});

test('form fields declare hover, focus, invalid and disabled states', () => {
  assert.match(theme, /:where\(input, select, textarea\):hover:not\(:disabled\):not\(:focus\)\s*\{[^}]*--er-field-border-hover/);
  assert.match(theme, /:where\(input, select, textarea\):focus\s*\{[^}]*border-color: var\(--er-primary\)/);
  assert.match(theme, /:where\(input, select, textarea\)\[aria-invalid="true"\]\s*\{[^}]*--er-field-invalid/);
  assert.match(theme, /:where\(input, select, textarea\):disabled\s*\{[^}]*--er-disabled-surface/);
  // Native checkboxes and radios keep their geometry; only the fill is themed.
  assert.match(theme, /:where\(input\[type="checkbox"\], input\[type="radio"\]\)\s*\{\s*accent-color: var\(--er-primary\)/);
  // An invalid field is not explained by its border alone.
  assert.match(read('pages/ServiceApplyPage.tsx'), /aria-invalid=/);
});

test('the focus ring is the brand colour and keeps its white under-ring', () => {
  const ring = /:root :where\(a, button, input, select, textarea, summary, \[tabindex\], \[contenteditable\]\):focus-visible\s*\{([^}]*)\}/.exec(a11y);
  assert.ok(ring, 'a11y.css owns the focus indicator');
  assert.match(ring[1], /outline: 3px solid var\(--er-primary-focus, #174A3A\) !important/);
  assert.match(ring[1], /box-shadow: 0 0 0 2px #ffffff !important/, 'the ring stays separated from a green button');
  assert.match(a11y, /outline-color: #f8fafc !important/, 'dark surfaces keep the light ring');
  assert.ok(contrast('#174A3A', '#FFFFFF') >= 3, 'the ring clears 3:1 on white');
  assert.ok(contrast('#174A3A', '#EDF5F0') >= 3, 'the ring clears 3:1 on the selected surface');
});

test('navigation states use the shared tokens and keep the active route honest', () => {
  assert.match(actions, /\.er-mobile-bottom-nav a:hover\s*\{[^}]*var\(--er-nav-hover-bg\)/);
  assert.match(actions, /\.er-mobile-bottom-nav a\.active\s*\{[^}]*var\(--er-nav-active-bg\)/);
  const layout = read('src/components/HubLayout.tsx');
  assert.match(layout, /color: path === '\/' \? 'var\(--er-primary\)'/, 'the current route is green');
  assert.match(layout, /2px solid var\(--er-primary-soft-border\)/, 'its underline uses the soft border token');
  assert.doesNotMatch(layout, /'#b14933'/, 'no navigation colour is hard-coded');
  assert.match(layout, /aria-current=/, 'selection is not communicated by colour alone');
});

test('status colours are semantic, and used by the shared surfaces', () => {
  const types = read('src/styles/type-system.css');
  assert.match(types, /\.er-inline-notice\.is-warning\s*\{[^}]*--er-status-warning/);
  assert.match(types, /\.er-inline-notice\.is-danger\s*\{[^}]*--er-status-error/);
  assert.match(types, /\.er-inline-notice\.is-success\s*\{[^}]*--er-status-success/);
  assert.match(read('src/hub-portal-tuning.css'), /\.badge-submitted\{[^}]*--er-status-info/);
  assert.match(read('src/dashboard-v2.css'), /\.badge-processing\{[^}]*--er-status-warning/);
  assert.match(read('src/hub.css'), /\.hub-form-error\{[^}]*--er-status-error/);

  // The status ramp never coincides with the action ramp.
  assert.notEqual(token('--er-status-error'), token('--er-primary'));
  assert.notEqual(token('--er-status-success'), token('--er-primary'));
});
