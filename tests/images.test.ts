import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  IMAGE_CDN_PATH,
  NEUTRAL_IMAGE_PLACEHOLDER,
  buildSrcSet,
  imageCacheControl,
  imageCdnEnabled,
  isLocalImagePath,
  isRemoteImage,
  placeholderFor,
  safeImageUrl,
  sizesFor,
  transformedImageUrl,
  widthsFor,
} from '../src/lib/imagePipeline';

// IMG-1: one image pipeline. The rules that matter to a student on a phone are
// "the card does not download a 2000px photograph", "the fallback is a drawing,
// not a stock photo of another campus", and "we never claim to own somebody
// else's image".

const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const component = read('src/components/OptimizedImage.tsx');

test('only same-origin paths are transformed, and only in production', () => {
  assert.equal(isLocalImagePath('/news/photos/a.jpg'), true);
  assert.equal(isLocalImagePath('https://example.edu.ng/logo.png'), false);
  assert.equal(isLocalImagePath('//cdn.example.com/a.jpg'), false, 'a protocol-relative URL is not ours');

  assert.equal(imageCdnEnabled({ production: true, hostname: 'edureach.ng' }), true);
  assert.equal(imageCdnEnabled({ production: true, hostname: 'localhost' }), false, 'the dev server has no image CDN');
  assert.equal(imageCdnEnabled({ production: true, hostname: '3000-abc.e2b.app' }), false, 'nor does the preview host');
  assert.equal(imageCdnEnabled({ production: false, hostname: 'edureach.ng' }), false);
  assert.equal(imageCdnEnabled({ production: true, hostname: 'edureach.ng', disabled: true }), false, 'VITE_IMAGE_CDN=off wins');
  assert.equal(imageCdnEnabled({ production: true, hostname: null }), false, 'no window, no transformation');
});

test('a transformed URL names the source, the size, the fit and the format', () => {
  const url = transformedImageUrl('/news/photos/graduates.jpg', { width: 640, height: 400, format: 'webp' });
  const parsed = new URL(url, 'https://example.test');
  assert.equal(parsed.pathname, IMAGE_CDN_PATH);
  assert.equal(parsed.searchParams.get('url'), '/news/photos/graduates.jpg');
  assert.equal(parsed.searchParams.get('w'), '640');
  assert.equal(parsed.searchParams.get('h'), '400');
  assert.equal(parsed.searchParams.get('fit'), 'cover');
  assert.equal(parsed.searchParams.get('fm'), 'webp');
  assert.equal(parsed.searchParams.get('q'), '72');
  assert.ok(url.startsWith('/.netlify/images?'), 'the CDN path is first');

  const natural = transformedImageUrl('/news/photos/graduates.jpg', { width: 320 });
  assert.ok(!natural.includes('h='), 'no crop when no height is requested');
  assert.match(natural, /fit=max/);

  assert.equal(
    transformedImageUrl('https://example.edu.ng/logo.png', { width: 64 }),
    'https://example.edu.ng/logo.png',
    'a remote image is never handed to our CDN',
  );
});

test('the source set never asks for a bigger file than the slot needs', () => {
  const card = widthsFor(300);
  assert.deepEqual(card, [300, 600], 'a 300px card asks for 300px and a 2× variant');

  const hero = widthsFor(960);
  assert.deepEqual(hero, [480, 960], 'a hero asks for half-size and its own size; the dense variant is capped away');
  assert.ok(Math.max(...widthsFor(4000)) <= 1600, 'nothing above 1600px is generated');

  const srcSet = buildSrcSet('/news/photos/graduates.jpg', card, { format: 'avif' });
  assert.equal(srcSet.split(', ').length, 2);
  for (const entry of srcSet.split(', ')) {
    assert.match(entry, /^\/\.netlify\/images\?url=%2Fnews%2Fphotos%2Fgraduates\.jpg&w=\d+/);
    assert.match(entry, /fm=avif/);
    assert.match(entry, / \d+w$/, 'each candidate declares its width');
  }

  assert.equal(buildSrcSet('https://example.edu.ng/logo.png', card), '', 'no source set for a remote image');
  assert.match(sizesFor('card'), /min-width: 1024px/);
  assert.equal(sizesFor('row'), '112px');
});

test('only safe image URLs survive validation', () => {
  assert.equal(safeImageUrl('/news/photos/a.jpg'), '/news/photos/a.jpg');
  assert.equal(safeImageUrl(' https://example.edu.ng/logo.png '), 'https://example.edu.ng/logo.png');
  assert.equal(safeImageUrl('http://example.edu.ng/logo.png'), null, 'mixed content is refused');
  assert.equal(safeImageUrl('data:image/png;base64,AAAA'), null, 'an image hidden in a string is refused');
  assert.equal(safeImageUrl('javascript:alert(1)'), null);
  assert.equal(safeImageUrl('//evil.example.com/a.jpg'), null);
  assert.equal(safeImageUrl('/news/photos/a b.jpg'), null, 'a path with whitespace is refused');
  assert.equal(safeImageUrl(''), null);
  assert.equal(safeImageUrl(null), null);
  assert.equal(isRemoteImage('/news/a.jpg'), false);
  assert.equal(isRemoteImage('https://example.edu.ng/logo.png'), true);
});

test('immutable is claimed only for content-hashed or transformed URLs', () => {
  assert.equal(imageCacheControl('/assets/index-BHSp5PmR.js'), 'public, max-age=31536000, immutable');
  assert.equal(imageCacheControl('/.netlify/images?url=%2Fa.jpg&w=300'), 'public, max-age=31536000, immutable');
  assert.match(imageCacheControl('/news/photos/graduates.jpg'), /max-age=3600/, 'an unhashed file can change, so it is not immutable');
  assert.doesNotMatch(imageCacheControl('/news/photos/graduates.jpg'), /immutable/);
  assert.equal(imageCacheControl('https://example.edu.ng/logo.png'), 'no-store', 'another site sets its own policy');
  assert.equal(imageCacheControl(null), 'no-store');
});

test('the placeholder is a drawing, and it is bundled', () => {
  assert.equal(placeholderFor('/anything.png'), NEUTRAL_IMAGE_PLACEHOLDER);
  const svg = read('public/images/neutral-placeholder.svg');
  assert.match(svg, /^<svg/, 'the placeholder is an SVG');
  assert.doesNotMatch(svg, /photo|flickr|unsplash|campus/i, 'it is not presented as a photograph');
});

test('the component renders both modern formats and lazy-loads by default', () => {
  assert.match(component, /<picture>/);
  assert.match(component, /type="image\/avif"/);
  assert.match(component, /type="image\/webp"/);
  assert.match(component, /decoding="async"/);
  assert.match(component, /loading=\{priority \? 'eager' : 'lazy'\}/, 'lazy is the default, eager is opt-in');
  assert.match(component, /fetchPriority=\{priority \? 'high' : 'auto'\}/);
  assert.match(component, /width=\{width\}/);
  assert.match(component, /height=\{height\}/, 'intrinsic dimensions prevent layout shift');
  assert.match(component, /referrerPolicy=\{remote \? 'no-referrer' : undefined\}/, 'a remote image is linked, not claimed');
  assert.match(component, /attribution/, 'the component can name the owner of an image');
  assert.doesNotMatch(component, /onError=\{[\s\S]{0,80}document\.createElement/, 'no DOM surgery: state decides the fallback');
});

test('the news surfaces use the shared pipeline', () => {
  const news = read('src/components/NewsSections.tsx');
  assert.match(news, /import OptimizedImage from '\.\/OptimizedImage'/);
  assert.match(news, /<OptimizedImage[\s\S]{0,240}src=\{item\.image_url\}/);
  assert.doesNotMatch(news, /<img\b/, 'no raw <img> is left in the news components');
  assert.match(news, /placeholderLabel=\{label\}/);
});

test('the admin editor previews an image through the same validation', () => {
  const editor = read('src/components/admin/InstitutionReviewEditor.tsx');
  assert.ok(editor.includes('safeImageUrl') || editor.includes('OptimizedImage'), 'the editor does not embed an unvalidated URL');
});
