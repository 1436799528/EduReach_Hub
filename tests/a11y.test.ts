import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { blocking, findStylesheets, scanRepo, scanStyles } from '../scripts/a11y-audit';

// A11Y-1: the posture, and the behaviour the posture is supposed to produce.
//
// The first test is the gate: an unlabelled control, a dialog without focus
// management, a header cell without `scope`, a nested <main>, a missing skip
// link, an animation that ignores prefers-reduced-motion or a focus ring that
// the cascade can erase fails here, in `npm test`, on the machine of whoever
// introduced it. See docs/features/A11Y-1.md and scripts/a11y-audit.ts.
//
// The rest verify the two primitives by actually rendering them: a static scan
// can see `useModalDialog(...)` in the source, only a DOM can prove focus moves.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

test('the static accessibility posture has no blocking findings', () => {
  const findings = blocking(scanRepo(root));
  assert.deepEqual(
    findings.map((finding) => `${finding.rule} ${finding.file}:${finding.line} — ${finding.message}`),
    [],
  );
});

// The focus-indicator rule is the one rule that judges CSS the repository
// already contains, so it needs its own controls: one sheet that must fail it,
// one that must pass, and one that proves the walker sees a reset inside a media
// query rather than reading the `@media` prelude as the selector.
const coverageProbe = (sheet: string) => {
  const findings = scanStyles(
    new Map([...findStylesheets(root), ['src/styles/probe.css', sheet]]),
    read('index.html'),
    read('src/main.tsx'),
  );
  return findings.filter((finding) => finding.rule === 'focus-indicator-coverage');
};

test('an outline reset with no focus indicator behind it fails the audit', () => {
  const findings = coverageProbe('.fancy-widget { outline: none; }');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /\.fancy-widget/);
});

test('a reset inside a media query is judged on its own selector', () => {
  // A `selector { body }` regex cannot see past the `@media` block and would
  // silently miss this; the walker has to attribute it like any other reset.
  const findings = coverageProbe('@media (max-width: 600px) { .fancy-widget { outline: 0; } }');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /\.fancy-widget/);
});

test('resets the ring already covers, and hover-only resets, are attributed', () => {
  assert.deepEqual(coverageProbe(':where(input, select, textarea):focus { outline: 0; }'), []);
  assert.deepEqual(coverageProbe('.card:hover { outline: none; }'), []);
});

const contrastProbe = (sheet: string) =>
  scanStyles(
    new Map([...findStylesheets(root), ['src/styles/probe.css', sheet]]),
    read('index.html'),
    read('src/main.tsx'),
  ).filter((finding) => finding.rule === 'text-contrast');

test('a rule that states its own text and background colours is judged on them', () => {
  const findings = contrastProbe('.faint { color: #cbd5e1; background: #ffffff; }');
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /\.faint sets color:#cbd5e1 on background:#ffffff/);
});

test('the large-text allowance is read from the rule, including inside a media query', () => {
  // 3.06:1 is a failure for body text and a pass for 26px text — and the rule
  // has to be seen through the `@media` block to be judged at all.
  assert.deepEqual(contrastProbe('.mid { color: #8a94a6; background: #ffffff; }').length, 1);
  assert.deepEqual(contrastProbe('@media (max-width: 600px) { .big { color: #8a94a6; background: #ffffff; font-size: 26px; } }'), []);
});

test('a skip link exists in every shell and targets the shell main', () => {
  const shells = [
    'src/components/HubLayout.tsx',
    'pages/AdminLayout.tsx',
    'pages/StudentDashboardV2.tsx',
  ];
  for (const shell of shells) {
    const source = read(shell);
    assert.match(source, /<SkipLink\b/, `${shell} renders no skip link`);
    assert.match(source, /id="main-content"/, `${shell} has no #main-content target`);
    assert.match(source, /<main[^>]*id="main-content"[^>]*tabIndex=\{-1\}/, `${shell}: <main> must be focusable so the skip link can move focus, not just scroll`);
  }
});

test('every modal dialog manages focus through the shared hook', () => {
  const dialogs = [
    ['src/components/dashboard/SecurityModal.tsx', 'dash-modal'],
    ['pages/AdminNewsPage.tsx', 'admin-modal'],
    ['pages/AdminUsersPage.tsx', 'admin-modal'],
    ['pages/CbtPracticePage.tsx', 'er-exam-modal'],
  ];
  for (const [file, className] of dialogs) {
    const source = read(file);
    assert.match(source, /useModalDialog</, `${file} declares a modal dialog but never calls useModalDialog`);
    assert.match(source, new RegExp(`ref=\\{[a-zA-Z]+\\}[^>]*className="${className}"`), `${file} does not attach the dialog ref to .${className}`);
    assert.match(source, /tabIndex=\{-1\}/, `${file}: the dialog container must be focusable as a fallback`);
  }
});

test('the exam clock is announced at its thresholds', () => {
  const source = read('pages/CbtPracticePage.tsx');
  assert.match(source, /One minute remaining\./);
  assert.match(source, /Five minutes remaining\./);
  assert.match(source, /role="status"\{clockNotice\}|role="status">\{clockNotice\}/, 'the threshold notices need a live region');
});

test('answer options behave like the radio group they declare', () => {
  const source = read('pages/CbtPracticePage.tsx');
  assert.match(source, /role="radiogroup"/);
  assert.match(source, /tabIndex=\{isSelected \|\| isFirstWithoutAnswer \? 0 : -1\}/, 'roving tabindex is what makes a radiogroup usable with arrows');
  assert.match(source, /event\.key === 'ArrowDown' \|\| event\.key === 'ArrowRight'/);
});

test('failure messages that used to be silent are announced', () => {
  assert.match(read('pages/AuthPageV2.tsx'), /<div\s+role="alert"/, 'the sign-in/sign-up failure banner must be announced');
  assert.match(read('pages/ServiceApplyPage.tsx'), /id="service-apply-error" role="alert"/);
});

test('validated wizard fields are marked invalid and point at the message', () => {
  const source = read('pages/ServiceApplyPage.tsx');
  for (const field of ['fullName', 'phone', 'whatsapp', 'institution']) {
    assert.match(source, new RegExp(`aria-invalid=\\{errorField === '${field}' \\|\\| undefined\\}`), `${field} is never marked invalid`);
    assert.match(source, new RegExp(`aria-describedby=\\{errorField === '${field}' \\? 'service-apply-error' : undefined\\}`), `${field} is not associated with the error text`);
  }
});

// ---------------------------------------------------------------------------
// behaviour: a real DOM, the real hook
// ---------------------------------------------------------------------------

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
// Node defines `navigator` as a getter-only global, so assign explicitly. The
// Node one is enough for React; everything else comes from jsdom.
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  KeyboardEvent: dom.window.KeyboardEvent,
  MouseEvent: dom.window.MouseEvent,
  Node: dom.window.Node,
})) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
after(() => dom.window.close());

const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { useModalDialog } = await import('../src/lib/useModalDialog');
const SkipLink = (await import('../src/components/a11y/SkipLink')).default;

type DialogHarness = { onClose: () => void };
function Dialog({ onClose }: DialogHarness) {
  const ref = useModalDialog<HTMLDivElement>(true, onClose);
  return createElement(
    'div',
    { ref, tabIndex: -1, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Test dialog' },
    createElement('button', { type: 'button' }, 'First'),
    createElement('button', { type: 'button' }, 'Last'),
  );
}

test('a modal dialog takes focus, traps Tab, closes on Escape and restores focus', () => {
  const opener = dom.window.document.createElement('button');
  opener.textContent = 'Open';
  dom.window.document.body.append(opener);
  opener.focus();

  const container = dom.window.document.createElement('div');
  dom.window.document.body.append(container);
  const reactRoot = createRoot(container);

  let closed = 0;
  act(() => {
    reactRoot.render(createElement(Dialog, { onClose: () => { closed += 1; } }));
  });

  const [first, last] = Array.from(container.querySelectorAll('button'));
  assert.equal(dom.window.document.activeElement, first, 'focus should move to the first focusable element in the dialog');

  // Tab from the last element wraps to the first instead of walking the page behind.
  last.focus();
  act(() => {
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  });
  assert.equal(dom.window.document.activeElement, first, 'Tab must stay inside the dialog');

  // Shift+Tab from the first wraps back to the last.
  act(() => {
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  });
  assert.equal(dom.window.document.activeElement, last, 'Shift+Tab must stay inside the dialog');

  act(() => {
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
  assert.equal(closed, 1, 'Escape must close the dialog');

  act(() => {
    reactRoot.unmount();
  });
  assert.equal(dom.window.document.activeElement, opener, 'closing must return focus to the control that opened the dialog');
});

test('the skip link moves focus to main content', () => {
  const main = dom.window.document.createElement('main');
  main.id = 'main-content';
  main.tabIndex = -1;
  dom.window.document.body.append(main);

  const host = dom.window.document.createElement('div');
  dom.window.document.body.append(host);
  const reactRoot = createRoot(host);
  act(() => {
    reactRoot.render(createElement(SkipLink, {}));
  });

  const link = host.querySelector('a');
  assert.ok(link, 'the skip link renders an anchor so it works before hydration');
  assert.equal(link.textContent, 'Skip to main content');
  assert.equal(link.getAttribute('href'), '#main-content');

  act(() => {
    link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  assert.equal(dom.window.document.activeElement, main, 'activating the skip link must move focus into main, not only scroll');

  act(() => {
    reactRoot.unmount();
  });
});
