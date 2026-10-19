import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// The design system asks for 44x44px controls on touch screens, while the
// compact layer deliberately renders 32px buttons for desktop density. This
// asserts the touch override exists and is scoped to coarse pointers, so a
// future density change cannot silently shrink every control on a phone.
const css = readFileSync(new URL('../src/styles/a11y.css', import.meta.url), 'utf8');

test('touch screens get 44px controls without changing desktop density', () => {
  const block = /@media\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(block, 'a coarse-pointer media block exists');
  assert.match(block[1], /\.hub-primary-btn[^{]*\{[^}]*min-height:\s*44px\s*!important/, 'primary controls are at least 44px tall');
  assert.match(block[1], /\.hub-nav a[^{]*\{[^}]*min-height:\s*44px/, 'navigation links keep a 44px target');
});
