import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshnessDate, newsFreshness } from '../src/lib/newsFreshness';

// NEWS-2: a two-month-old notice must not read like one checked this morning.

const NOW = Date.parse('2026-10-03T09:00:00Z');
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

test('a recently checked story is current', () => {
  const fresh = newsFreshness({ verification_status: 'verified', last_verified_at: daysAgo(3) }, NOW);
  assert.equal(fresh.state, 'fresh');
  assert.equal(fresh.current, true);
  assert.equal(fresh.label, 'Checked by EduReach');
});

test('a verified but old story is marked, not hidden', () => {
  const stale = newsFreshness({ verification_status: 'verified', last_verified_at: daysAgo(61) }, NOW);
  assert.equal(stale.state, 'stale');
  assert.equal(stale.current, true, 'old news is still news — it is labelled, not removed');
  assert.equal(stale.label, 'Checked a while ago');
  assert.equal(stale.checkedOn, daysAgo(61));
});

test('the 60-day boundary is inclusive of the last fresh day', () => {
  assert.equal(newsFreshness({ last_verified_at: daysAgo(60) }, NOW).state, 'fresh');
  assert.equal(newsFreshness({ last_verified_at: daysAgo(60.5) }, NOW).state, 'stale');
});

test('an article with no recorded check says so instead of implying one', () => {
  const unknown = newsFreshness({ published_at: daysAgo(2) }, NOW);
  assert.equal(unknown.state, 'unverified');
  assert.equal(unknown.label, 'Not checked yet');
  assert.equal(unknown.checkedOn, null);
  assert.equal(unknown.current, true, 'it is still published content');
});

test('expiry and supersession win over everything else', () => {
  assert.equal(newsFreshness({ verification_status: 'expired', last_verified_at: daysAgo(1) }, NOW).state, 'expired');
  assert.equal(newsFreshness({ verification_status: 'archived', last_verified_at: daysAgo(1) }, NOW).state, 'expired');
  assert.equal(newsFreshness({ verification_status: 'superseded', last_verified_at: daysAgo(1) }, NOW).label, 'Replaced by a newer update');
  const past = newsFreshness({ verification_status: 'verified', last_verified_at: daysAgo(1), expires_at: daysAgo(0.5) }, NOW);
  assert.equal(past.state, 'expired');
  assert.equal(past.current, false);
});

test('an update timestamp is used when no explicit check is recorded', () => {
  const updated = newsFreshness({ updated_at: daysAgo(10) }, NOW);
  assert.equal(updated.state, 'fresh');
  assert.equal(updated.checkedOn, daysAgo(10));
});

test('the display date is readable, and empty when absent', () => {
  // Asserted by structure rather than by an exact ICU string: the month
  // abbreviation differs between ICU versions ("Sep" vs "Sept"), and the rule
  // that matters is that the day, month and year are all present.
  const formatted = freshnessDate('2026-09-26T10:00:00Z');
  assert.match(formatted, /^26 Sep/);
  assert.match(formatted, /2026$/);
  assert.equal(freshnessDate(null), '', 'a missing date is empty, so the caller chooses the fallback');
  assert.equal(freshnessDate('not a date'), '');
});
