import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// P3-5: 17 stylesheets are loaded on every route. The audit's complaint is not
// the count for its own sake — it is that the count grew unmanaged and nothing
// recorded why each sheet exists or which order they depend on. This test pins
// the load order contract so growth (and consolidation) is a deliberate edit to
// docs/architecture/STYLESHEET_LAYERS.md, not an accident.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'src/main.tsx'), 'utf8');

/** The sheets in import order, as recorded in the architecture note. */
const EXPECTED = [
  './hub.css',
  './card-system.css',
  './hub-portal-tuning.css',
  './dashboard-v2.css',
  './admin.css',
  './cbt-engine.css',
  './compact-portal.css',
  './image-card-system.css',
  './home-card-first.css',
  './myschool-clean.css',
  './styles/theme.css',
  './compact-design-system.css',
  './compact-structural.css',
  './edu-portal.css',
  './data-control.css',
  './styles/type-system.css',
  './styles/a11y.css',
];

function importedSheets(): string[] {
  return [...main.matchAll(/^import\s+'(\.[^']+\.css)';/gm)].map((match) => match[1]);
}

test('the stylesheet set and its order match the documented contract', () => {
  assert.deepEqual(
    importedSheets(),
    EXPECTED,
    'a stylesheet was added, removed or reordered — update docs/architecture/STYLESHEET_LAYERS.md and this test in the same change',
  );
  assert.equal(new Set(importedSheets()).size, EXPECTED.length, 'no sheet is imported twice');
});

test('a11y.css stays last so the focus-ring cascade cannot be overridden', () => {
  const sheets = importedSheets();
  assert.equal(sheets.at(-1), './styles/a11y.css');
});

test('the type system follows the component sheets it standardises', () => {
  const sheets = importedSheets();
  const typeSystem = sheets.indexOf('./styles/type-system.css');
  assert.ok(typeSystem > 0, 'the type system must be imported, not deleted');
  // Everything before it is a component sheet; everything after is only a11y.css.
  assert.deepEqual(sheets.slice(typeSystem + 1), ['./styles/a11y.css']);
});

test('every sheet named in the architecture note exists on disk', () => {
  for (const sheet of EXPECTED) {
    const path = join(root, 'src', sheet.replace(/^\.\//, ''));
    assert.doesNotThrow(() => readFileSync(path, 'utf8'), `${sheet} is documented but missing`);
  }
  const note = readFileSync(join(root, 'docs/architecture/STYLESHEET_LAYERS.md'), 'utf8');
  assert.match(note, /17 sheets → 8/, 'the consolidation target is recorded in the note');
});
