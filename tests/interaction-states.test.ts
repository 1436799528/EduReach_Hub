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
    '--er-primary': '#0A3E83',
    '--er-primary-hover': '#083570',
    '--er-primary-active': '#062B5C',
    '--er-primary-border': '#083570',
    '--er-primary-border-hover': '#072F64',
    '--er-primary-border-active': '#05264F',
    '--er-primary-focus': '#0A3E83',
    '--er-primary-soft': '#EDF4FB',
    '--er-primary-soft-border': '#CCE0F3',
    '--er-on-primary': '#FFFFFF',
    '--er-crimson': '#B14933',
    '--er-crimson-hover': '#963D2C',
    '--er-crimson-pressed': '#803222',
    '--er-secondary-border': '#CCE0F3',
    '--er-secondary-hover-bg': '#EDF4FB',
    '--er-secondary-hover-border': '#A9C8E8',
    '--er-secondary-active-bg': '#DCEAF8',
    '--er-secondary-active-border': '#8FB7DE',
    '--er-disabled-bg': '#E2E8F0',
    '--er-disabled-text': '#64748B',
    '--er-disabled-border': '#CBD5E1',
    '--er-disabled-surface': '#F8FAFC',
    '--er-nav-hover-bg': '#F1F5F9',
    '--er-nav-active-bg': '#EDF4FB',
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
    ['#FFFFFF', '#0A3E83', 'primary label at rest'],
    ['#FFFFFF', '#083570', 'primary label on hover'],
    ['#FFFFFF', '#062B5C', 'primary label while pressed'],
    ['#0A3E83', '#FFFFFF', 'secondary label at rest'],
    ['#0A3E83', '#EDF4FB', 'secondary label on hover'],
    ['#083570', '#DCEAF8', 'secondary label while pressed'],
    ['#0A3E83', '#F1F5F9', 'navigation label on hover'],
    ['#0A3E83', '#EDF4FB', 'navigation label when selected'],
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
    ['#0A3E83', 'focused field'],
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

test('secondary controls stay white with a blue edge in every state', () => {
  const base = /\.hub-outline-btn,\s*\.dash-btn-secondary,[\s\S]*?\{([^}]*)\}/.exec(actions);
  assert.ok(base, 'secondary buttons have one shared rule');
  assert.match(base[1], /background: var\(--er-surface\)/, 'secondary is not filled with the brand colour');
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
  assert.match(theme, /:where\(input, select, textarea\):focus\s*\{[^}]*border-color: var\(--color-brand-primary\)/);
  assert.match(theme, /:where\(input, select, textarea\)\[aria-invalid="true"\]\s*\{[^}]*--color-error/);
  assert.match(theme, /:where\(input, select, textarea\):disabled\s*\{[^}]*--color-bg-disabled/);
  // Native checkboxes and radios keep their geometry; only the fill is themed.
  assert.match(theme, /:where\(input\[type="checkbox"\], input\[type="radio"\]\)\s*\{\s*accent-color: var\(--color-brand-primary\)/);
  // An invalid field is not explained by its border alone.
  assert.match(read('pages/ServiceApplyPage.tsx'), /aria-invalid=/);
});

test('the focus ring is the brand colour, thin and follows the control', () => {
  const ring = /:root :where\(a, button, input, select, textarea, summary, \[tabindex\], \[contenteditable\]\):focus-visible\s*\{([^}]*)\}/.exec(a11y);
  assert.ok(ring, 'a11y.css owns the focus indicator');
  assert.match(ring[1], /outline: 2px solid var\(--color-focus, #0A3E83\) !important/);
  assert.match(ring[1], /outline-offset: 0/, 'the ring hugs the control instead of floating away from it');
  assert.match(ring[1], /box-shadow: none !important/, 'no second ink line doubles the ring');
  assert.match(a11y, /\.site-search[^}]*input[^}]*:focus-visible[\s\S]*outline: 0 !important/, 'search fields defer the ring to their rounded container');
  assert.match(a11y, /outline-color: #f8fafc !important/, 'dark surfaces keep the light ring');
  assert.ok(contrast('#0A3E83', '#FFFFFF') >= 3, 'the ring clears 3:1 on white');
  assert.ok(contrast('#0A3E83', '#EDF4FB') >= 3, 'the ring clears 3:1 on the selected surface');
});

test('mobile inputs avoid browser zoom and coarse-pointer controls have thumb-sized targets', () => {
  assert.ok(a11y.includes('@media (max-width: 640px)'));
  assert.ok(a11y.includes('input:not([type="checkbox"]):not([type="radio"]),'));
  assert.ok(a11y.includes('font-size: 16px !important;'));
  assert.match(a11y, /@media \(pointer: coarse\)[\s\S]*button,\s*select,\s*summary,[\s\S]*\{\s*min-height: 44px !important/);
  const portal = read('src/edu-portal.css');
  assert.match(portal, /\.er-mobile-bottom-nav a\{[^}]*height:48px/);
  assert.match(portal, /padding-bottom:calc\(62px \+ env\(safe-area-inset-bottom\)\)/);
});

test('semantic design tokens map to the EduReach palette and shared scales', () => {
  for (const [semantic, legacy] of [
    ['--color-bg-primary', '--er-bg'],
    ['--color-bg-surface', '--er-surface'],
    ['--color-text-primary', '--er-text-primary'],
    ['--color-brand-primary', '--er-primary'],
    ['--color-brand-accent', '--er-crimson'],
    ['--color-error', '--er-status-error'],
  ] as const) {
    assert.ok(theme.includes(`${semantic}: var(${legacy})`), `${semantic} reuses ${legacy}`);
  }
  assert.match(theme, /--er-space-1:\s*4px/);
  assert.match(theme, /--er-space-5:\s*24px/);
  assert.match(theme, /--er-space-8:\s*64px/);
  assert.match(theme, /--er-type-size-display:\s*48px/);
  assert.match(read('src/styles/type-system.css'), /\.er-type-body\s*\{\s*font-size: var\(--er-type-size-compact-body\)/);
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
