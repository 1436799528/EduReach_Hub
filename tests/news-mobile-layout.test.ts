import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('news empty and error states do not reserve desktop skeleton height on phones', () => {
  const css = read('src/styles/ux5-product.css');
  assert.match(css, /\.er-late-region--feed-page:has\(> \.hub-empty\)/);
  assert.match(css, /\.er-late-region--feed-page:has\(> \.hub-form-error\)/);
  assert.match(css, /\.er-late-region--simulators:has\(> \.er-empty\)/);
  assert.match(css, /--er-late-min: 0/, 'empty states collapse instead of leaving a blank feed-sized gap');
});

test('the desktop news side rail is hidden on phones so public pages share one column', () => {
  const css = read('src/styles/ux5-product.css');
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.hub-side-rail \{ display: none !important; \}/);
  assert.match(read('src/components/HubLayout.tsx'), /showRail/, 'the desktop rail still exists for wide screens');
});
