import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Secondary admin buttons were styled for the dark sidebar (white text,
// transparent fill, full width). Reusing that class in a white page header or
// card made the label invisible. This pins the content-area variant.
const css = readFileSync(new URL('../src/admin.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../pages/AdminLayout.tsx', import.meta.url), 'utf8');
const kit = readFileSync(new URL('../src/components/admin/AdminKit.tsx', import.meta.url), 'utf8');

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

test('admin shell keeps key shortcuts visible and uses a focus-managed mobile drawer', () => {
  assert.match(layout, /<a href="\/admin"[^>]*>Overview<\/a>/);
  assert.match(layout, /<a href="\/" aria-label="Open EduReach student site">/);
  assert.match(layout, /useModalDialog<HTMLElement>\(mobileNavOpen/);
  assert.match(layout, /aria-expanded={mobileNavOpen}/);
  assert.match(css, /\.admin-workspace \{[\s\S]*?overflow: hidden/);
  assert.match(css, /\.admin-main \{[\s\S]*?overflow-y: auto/);
  assert.match(css, /\.admin-sidebar \{[\s\S]*?overflow-y: auto/);
});

test('admin data summaries distinguish absent values and counters omit zero', () => {
  assert.match(kit, /export function AdminCountBadge/);
  assert.match(kit, /count <= 0/);
  assert.match(kit, /export function AdminStatusDot/);
  assert.match(kit, /aria-label={description} title={description}/);
  assert.match(css, /\.admin-count-badge/);
});

test('admin summary and mobile drawer respect reduced motion', () => {
  assert.match(css, /\.admin-summary \{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
