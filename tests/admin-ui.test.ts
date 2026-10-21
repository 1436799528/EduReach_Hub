import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Secondary admin buttons were styled for the dark sidebar (white text,
// transparent fill, full width). Reusing that class in a white page header or
// card made the label invisible. This pins the content-area variant.
const css = readFileSync(new URL('../src/admin.css', import.meta.url), 'utf8');

test('secondary admin buttons remain visible outside the dark sidebar', () => {
  assert.match(
    css,
    /\.admin-page-header \.admin-btn\.secondary,[\s\S]*?\.admin-card \.admin-btn\.secondary,[\s\S]*?\{[^}]*color:\s*var\(--admin-navy\)/,
    'content-area secondary buttons use dark text',
  );
  assert.match(
    css,
    /\.admin-inline-form \.admin-btn\.secondary\s*\{[^}]*width:\s*auto/,
    'a secondary action does not stretch the whole row',
  );
});
