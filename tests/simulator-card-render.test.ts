import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { buildSimulatorCards } from '../src/data/simulators';

/**
 * The shared simulator card, rendered.
 *
 * The catalogues' shape is asserted elsewhere; this file renders the actual
 * component so a broken prop name, a lost link or a dropped exam-type
 * attribute fails here instead of in a browser. It also proves the card the
 * homepage, Practice and the dashboard CBT tab mount produces the same markup
 * from the same catalogue row.
 */

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
const SimulatorCard = (await import('../src/components/SimulatorCard')).default;

const BANKS = [
  { id: 'bank-jamb', title: 'JAMB UTME Practice Bank', exam_body: 'JAMB', subject: 'Multiple subjects', description: 'A live JAMB bank.', duration_minutes: 120, question_count: 180, subject_count: 4 },
  { id: 'bank-waec', title: 'WAEC SSCE Practice Bank', exam_body: 'WAEC', subject: 'Mathematics', description: 'A live WAEC bank.', duration_minutes: 60, question_count: 40, subject_count: 4 },
];

function mount() {
  const container = dom.window.document.createElement('div');
  dom.window.document.body.append(container);
  return { container, root: createRoot(container) };
}

test('an available simulator renders as a link into its own workflow', () => {
  const cards = buildSimulatorCards(BANKS);
  const jamb = cards.find((card) => card.examType === 'jamb');
  assert.ok(jamb, 'the JAMB card is built from the catalogue');

  const { container, root } = mount();
  act(() => {
    root.render(createElement(SimulatorCard, { simulator: jamb! }));
  });

  const link = container.querySelector('a.er-sim-card');
  assert.ok(link, 'the card is a real link, so the app-level router intercepts it');
  assert.equal(link!.getAttribute('href'), '/cbt/setup/jamb?exam=bank-jamb', 'it carries the bank id into setup');
  assert.equal(link!.getAttribute('data-exam-type'), 'jamb', 'the tint is keyed on the canonical type');
  assert.ok(link!.className.includes('er-sim-jamb'), 'and the legacy class still matches');
  assert.match(container.textContent ?? '', /JAMB UTME/, 'the simulator is named');
  assert.match(container.textContent ?? '', /Timed practice · 1 question bank/, 'the card states what is behind it');
  assert.ok(container.querySelector('.er-sim-mark img'), 'the emblem sits in its fixed frame');
  assert.ok(container.querySelector('.er-card-arrow'), 'the only action is the thin arrow');
  assert.equal(container.querySelector('[aria-disabled]'), null, 'an available card is not marked disabled');

  act(() => root.unmount());
});

test('a bank that cannot serve a session is described, not linked', () => {
  const [thin] = buildSimulatorCards([
    { id: 'bank-thin', title: 'NECO Trial Bank', exam_body: 'NECO', subject: 'English', description: '', duration_minutes: 30, question_count: 2, subject_count: 1 },
  ]);
  assert.equal(thin.available, false, 'a two-question bank is not startable');

  const { container, root } = mount();
  act(() => {
    root.render(createElement(SimulatorCard, { simulator: thin }));
  });

  assert.equal(container.querySelector('a.er-sim-card'), null, 'there is no link to a session that cannot start');
  const card = container.querySelector('.er-sim-card[aria-disabled="true"]');
  assert.ok(card, 'the card is announced as unavailable');
  assert.match(container.textContent ?? '', /Questions being prepared/, 'and says why');
  assert.equal(container.querySelector('.er-card-arrow'), null, 'no arrow implies an action');

  act(() => root.unmount());
});

test('every published examination mounts without throwing and keeps its own type', () => {
  const cards = buildSimulatorCards([
    ...BANKS,
    { id: 'bank-neco', title: 'NECO SSCE Practice Bank', exam_body: 'NECO', subject: 'English', description: '', duration_minutes: 60, question_count: 40, subject_count: 4 },
    { id: 'bank-post', title: 'Post-UTME Bank', exam_body: 'POST-UTME', subject: 'General', description: '', duration_minutes: 45, question_count: 30, subject_count: 3 },
  ]);
  const { container, root } = mount();

  for (const card of cards) {
    act(() => {
      root.render(createElement(SimulatorCard, { simulator: card }));
    });
    const rendered = container.querySelector('.er-sim-card');
    assert.ok(rendered, `${card.label} renders`);
    assert.equal(rendered!.getAttribute('data-exam-type'), card.examType);
  }

  act(() => root.unmount());
});
