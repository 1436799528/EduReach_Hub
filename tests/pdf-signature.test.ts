import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPdfBuffer } from '../lib/pdf-signature';

// Priority 3: server-side PDF %PDF- signature validation, preserving private
// storage and existing access controls. The upload endpoint already checks MIME
// and extension; this adds the missing bytes check and is tested here.

const VALID_PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const HTML_PAYLOAD = new TextEncoder().encode('<!doctype html><script>alert(1)</script>');
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EMPTY = new Uint8Array(0);
const TRUNCATED = Uint8Array.from([0x25, 0x50, 0x44]); // %PD only

test('a valid PDF header is recognised', () => {
  assert.equal(isPdfBuffer(VALID_PDF), true);
  // Minimal valid header alone must pass — length 5 is enough.
  assert.equal(isPdfBuffer(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
});

test('a payload without PDF magic is rejected', () => {
  assert.equal(isPdfBuffer(HTML_PAYLOAD), false);
  assert.equal(isPdfBuffer(PNG), false);
  assert.equal(isPdfBuffer(EMPTY), false);
  assert.equal(isPdfBuffer(TRUNCATED), false);
  // Wrong case or missing dash.
  assert.equal(isPdfBuffer(new TextEncoder().encode('%pdf-')), false);
  assert.equal(isPdfBuffer(new TextEncoder().encode('%PDF ')), false);
  assert.equal(isPdfBuffer(new TextEncoder().encode(' %PDF-')), false);
});

test('a mislabelled PDF (PDF MIME but HTML bytes) is rejected', () => {
  // The exact bypass this fixes: claim application/pdf, send HTML.
  // The MIME/extension checks pass, bytes check must fail.
  const fakePdfDataUrl = `data:application/pdf;base64,${Buffer.from('<html>not a pdf</html>').toString('base64')}`;
  const match = /^data:application\/pdf;base64,([A-Za-z0-9+/=\s]+)$/i.exec(fakePdfDataUrl);
  assert.ok(match);
  const buffer = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
  assert.equal(isPdfBuffer(buffer), false);
});
