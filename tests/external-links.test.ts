import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkTarget,
  classifyStatus,
  dedupe,
  isPassing,
  normalise,
  renderReport,
  staticTargets,
  type LinkResult,
} from '../scripts/external-link-check';

/**
 * The pure half of the external link check.
 *
 * The network half is proved by running the script; these cases pin the parts
 * that decide what a failure even is. Getting them wrong in the forgiving
 * direction is the dangerous one: a checker that treats 404 as a pass is a
 * green tick over a dead scholarship.
 */

test('the static sources are the reviewed seed and the channel, deduplicated', () => {
  const targets = staticTargets();
  assert.ok(targets.length >= 6, `expected the seeded scholarships, found ${targets.length}`);
  const urls = targets.map((target) => target.url);
  assert.ok(urls.some((url) => url.includes('whatsapp')), 'the WhatsApp channel is checked');
  assert.ok(urls.some((url) => url.includes('totalenergies')), 'the TotalEnergies scholarship is checked');
  assert.equal(new Set(urls.map(normalise)).size, urls.length, 'no URL is checked twice');
  for (const target of targets) {
    assert.match(target.url, /^https:\/\//, `${target.url} must be https`);
    assert.ok(target.source.length > 0, 'every URL says where it came from');
  }
});

test('normalising ignores what does not change the destination', () => {
  assert.equal(normalise('https://Portal.Scholarship.ng/apply/'), normalise('https://portal.scholarship.ng/apply'));
  assert.equal(normalise('https://portal.scholarship.ng/apply#form'), normalise('https://portal.scholarship.ng/apply'));
  assert.notEqual(normalise('https://portal.scholarship.ng/a'), normalise('https://portal.scholarship.ng/b'));
});

test('dedupe drops repeats, non-http values and placeholders', () => {
  const targets = dedupe([
    { url: 'https://portal.scholarship.ng/apply', source: 'a' },
    { url: 'https://PORTAL.scholarship.ng/apply/', source: 'b' },
    { url: 'mailto:hello@scholarship.ng', source: 'c' },
    { url: 'https://example.com/lorem', source: 'placeholder' },
    { url: 'https://localhost:3000/dev', source: 'local' },
  ]);
  assert.deepEqual(targets.map((target) => target.url), ['https://portal.scholarship.ng/apply']);
  assert.equal(targets[0].source, 'a', 'the first source naming a URL wins');
});

test('status classification does not flatter a dead link', () => {
  assert.equal(classifyStatus(200), 'ok');
  assert.equal(classifyStatus(204), 'ok');
  assert.equal(classifyStatus(301), 'redirect');
  assert.equal(classifyStatus(308), 'redirect');
  assert.equal(classifyStatus(403), 'client-error');
  assert.equal(classifyStatus(404), 'client-error');
  assert.equal(classifyStatus(429), 'client-error');
  assert.equal(classifyStatus(500), 'server-error');
  assert.equal(classifyStatus(503), 'server-error');
  assert.equal(classifyStatus(0), 'unreachable');

  assert.equal(isPassing('ok'), true);
  assert.equal(isPassing('redirect'), true);
  for (const status of ['client-error', 'server-error', 'unreachable'] as const) {
    assert.equal(isPassing(status), false, `${status} must fail the check`);
  }
});

test('an unreachable host is a failure, not an exception', async () => {
  const result = await checkTarget({ url: 'http://127.0.0.1:9/nothing-listens-here', source: 'test' }, 1500);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'unreachable');
  assert.equal(result.code, 0);
});

test('the report names the failures and the source to fix', () => {
  const results: LinkResult[] = [
    { url: 'https://ok.example.org', source: 'seed:a', status: 'ok', code: 200, detail: 'OK', ok: true },
    { url: 'https://dead.example.org', source: 'seed:b', status: 'client-error', code: 404, detail: 'Not Found', ok: false },
  ];
  const report = renderReport(results, '2026-11-23T00:00:00.000Z');
  assert.match(report, /Checked 2 URLs; 1 failing/);
  assert.match(report, /## Failing/);
  assert.match(report, /\| https:\/\/dead\.example\.org \| `seed:b` \| 404 client-error \| Not Found \|/);
});
