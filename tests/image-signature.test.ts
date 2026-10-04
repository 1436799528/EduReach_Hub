import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectImageKind, matchesDeclaredImageType } from '../lib/image-signature';

// P3-3: the upload endpoint must not trust the MIME type the client declares.
// A payload that is not the image it claims to be never reaches the public
// storage bucket.

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x24, 0x00, 0x00, 0x00, // size
  0x57, 0x45, 0x42, 0x50, // WEBP
  0x56, 0x50, 0x38, 0x20,
]);

test('each accepted image format is identified from its own bytes', () => {
  assert.equal(detectImageKind(PNG), 'png');
  assert.equal(detectImageKind(JPEG), 'jpeg');
  assert.equal(detectImageKind(GIF), 'gif');
  assert.equal(detectImageKind(WEBP), 'webp');
});

test('a payload that is not an image is not identified as one', () => {
  const html = new TextEncoder().encode('<!doctype html><script>alert(1)</script>');
  const zip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]); // PK..
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.equal(detectImageKind(html), null);
  assert.equal(detectImageKind(zip), null);
  assert.equal(detectImageKind(svg), null);
  assert.equal(detectImageKind(new Uint8Array(0)), null);
  // A RIFF container that is not WEBP (e.g. a WAV file).
  assert.equal(detectImageKind(Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
  ])), null);
});

test('bytes must match the type the client declared', () => {
  assert.equal(matchesDeclaredImageType(PNG, 'png'), true);
  assert.equal(matchesDeclaredImageType(JPEG, 'jpeg'), true);
  assert.equal(matchesDeclaredImageType(JPEG, 'jpg'), true, 'jpg and jpeg are the same format');
  assert.equal(matchesDeclaredImageType(GIF, 'gif'), true);
  assert.equal(matchesDeclaredImageType(WEBP, 'webp'), true);
});

test('a mislabelled payload is rejected', () => {
  const html = new TextEncoder().encode('<html></html>');
  // The exact bypass the finding described: claim PNG, send anything.
  assert.equal(matchesDeclaredImageType(html, 'png'), false);
  assert.equal(matchesDeclaredImageType(html, 'gif'), false);
  assert.equal(matchesDeclaredImageType(PNG, 'jpeg'), false);
  assert.equal(matchesDeclaredImageType(GIF, 'png'), false);
});
