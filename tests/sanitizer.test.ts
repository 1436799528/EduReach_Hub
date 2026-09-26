import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { sanitizeRichHtml } from '../src/lib/html-sanitize';
const dom = new JSDOM('');
Object.assign(globalThis, { document: dom.window.document, DOMParser: dom.window.DOMParser });
after(() => dom.window.close());
const parse = (html: string) => new dom.window.DOMParser().parseFromString(sanitizeRichHtml(html), 'text/html').body;

test('rich HTML strips executable tags and event handlers', () => {
  const body = parse('<p onclick="alert(1)">Hi<strong>Student</strong><script>alert(1)</script><iframe src="https://example.com"></iframe><svg onload="alert(1)"></svg></p>');
  assert.equal(body.querySelector('script,iframe,svg,[onclick],[onload]'), null);
  assert.equal(body.querySelector('strong')?.textContent, 'Student');
});
for (const href of ['javascript:alert(1)', 'data:text/html,hi', '//evil.example', '/\\evil.example', '/\nevil.example', 'http://insecure.example']) {
  test(`rich HTML rejects unsafe href ${JSON.stringify(href)}`, () => assert.equal(parse(`<a href="${href}">link</a>`).querySelector('a'), null));
}
test('safe links retain enforced target/rel regardless of original attribute order', () => {
  for (const html of ['<a href="https://example.com" target="_self" rel="opener">link</a>', '<a target="_self" rel="opener" href="/news">link</a>']) {
    const link = parse(html).querySelector('a')!;
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer nofollow');
  }
});
test('images and inline styles are allowlisted', () => {
  const body = parse('<img src="data:image/svg+xml,evil" onerror="evil()"><img src="/icons/logo.png" alt="logo" width="40" onerror="evil()"><p style="color: red; position: fixed; text-align: center">text</p>');
  assert.equal(body.querySelectorAll('img').length, 1);
  assert.equal(body.querySelector('[onerror]'), null);
  assert.equal(body.querySelector('p')?.style.position, '');
  assert.equal(body.querySelector('p')?.style.color, 'red');
});
