import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// UI-2: the loader only appears for a request that is genuinely pending, and
// it never announces twice. The rules are asserted here rather than only
// described in the design document, because both are easy to undo by accident:
// a smaller spinner can be swapped in, or a live region can start competing
// with the button label beside it.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

test('the loader is a small dependency-free SVG and waveform', () => {
  const component = read('src/components/WaveLoader.tsx');
  assert.match(component, /viewBox="0 0 24 24"/, 'the ring is inline SVG, not an image or a library');
  assert.equal((component.match(/className="er-wave-arc/g) ?? []).length >= 2, true, 'two arcs, not one');
  assert.match(component, /className="er-wave-bars"/);
  assert.doesNotMatch(component, /import .*from '(motion|framer-motion|react-spinners|lottie)/, 'no animation dependency');

  const css = read('src/styles/type-system.css');
  assert.match(css, /@keyframes er-wave-turn/, 'the ring animates through the shared stylesheet');
  assert.match(css, /@keyframes er-wave-bar/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.er-wave-arc, \.er-wave-bars i \{ animation: none; \}/, 'reduced motion stops both loops');
});

// ---------------------------------------------------------------------------
// behaviour
// ---------------------------------------------------------------------------

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
})) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
after(() => dom.window.close());

const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { usePendingPhase } = await import('../src/lib/usePendingPhase');
const WaveLoader = (await import('../src/components/WaveLoader')).default;

function mount() {
  const container = dom.window.document.createElement('div');
  dom.window.document.body.append(container);
  return { container, root: createRoot(container) };
}

test('the loader announces itself once and stays silent inside a labelled button', () => {
  const { container, root: reactRoot } = mount();

  act(() => {
    reactRoot.render(createElement(WaveLoader, { label: 'Loading questions…' }));
  });
  const status = container.querySelector('[role="status"]');
  assert.ok(status, 'a standalone loader is a live region');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.match(container.textContent ?? '', /Loading questions…/);
  assert.equal(container.querySelectorAll('circle').length, 3, 'track plus two arcs');
  assert.equal(container.querySelectorAll('.er-wave-bars i').length, 4, 'four waveform bars');

  act(() => {
    reactRoot.render(createElement(WaveLoader, { variant: 'inline', decorative: true }));
  });
  assert.equal(container.querySelector('[role="status"]'), null, 'a button that already says “Starting…” does not announce twice');
  assert.ok(container.querySelector('.er-wave[aria-hidden="true"]'), 'the decorative form is hidden from assistive technology');

  act(() => reactRoot.unmount());
});

function PhaseProbe({ pending }: { pending: boolean }) {
  const phase = usePendingPhase(pending, { slowAfter: 30, stalledAfter: 90 });
  return createElement('span', null, phase);
}

test('the pending phase follows the request and never invents progress', async () => {
  const { container, root: reactRoot } = mount();

  act(() => {
    reactRoot.render(createElement(PhaseProbe, { pending: true }));
  });
  assert.equal(container.textContent, 'pending', 'a young request is still a skeleton, not a spinner');

  await act(async () => { await new Promise((done) => setTimeout(done, 50)); });
  assert.equal(container.textContent, 'slow', 'a named wait appears once the request is old enough');

  await act(async () => { await new Promise((done) => setTimeout(done, 60)); });
  assert.equal(container.textContent, 'stalled', 'waiting has a ceiling');

  act(() => {
    reactRoot.render(createElement(PhaseProbe, { pending: false }));
  });
  assert.equal(container.textContent, 'idle', 'settling resets immediately');

  // A new request starts from the beginning, not from the old stall.
  act(() => {
    reactRoot.render(createElement(PhaseProbe, { pending: true }));
  });
  assert.equal(container.textContent, 'pending');

  act(() => reactRoot.unmount());
});
