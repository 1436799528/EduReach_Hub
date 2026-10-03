import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysUntil, opportunityStatus } from '../src/lib/opportunityStatus';

// OPP-1: the two live listings had no deadline and no verification date while
// the page claimed they had been checked. These tests pin what may be said.

const NOW = Date.parse('2026-10-03T09:00:00Z');
const inDays = (days: number) => new Date(NOW + days * 86_400_000).toISOString().slice(0, 10);

test('a listing with no verification date is labelled, not hidden', () => {
  const status = opportunityStatus({ title: 'NNPC scholarship', deadline: inDays(60) }, NOW);
  assert.equal(status.verification, 'unverified');
  assert.equal(status.state, 'open');
  assert.equal(status.verificationLabel, 'Not yet checked by EduReach');
  assert.equal(status.cta, 'Check the source', 'an unverified listing never gets a confident "Apply"');
  assert.equal(status.actionable, true, 'it is still shown — hiding a real opportunity helps nobody');
});

test('a verified listing with a future deadline is the only "Apply"', () => {
  const status = opportunityStatus({ title: 'MTN grant', deadline: inDays(60), last_verified_at: '2026-09-26T10:00:00Z' }, NOW);
  assert.equal(status.verification, 'verified');
  assert.equal(status.state, 'open');
  assert.equal(status.cta, 'Apply');
  assert.equal(status.verifiedOn, '2026-09-26T10:00:00Z');
});

test('the closing-soon window is two weeks and reads in days', () => {
  const base = { title: 'x', last_verified_at: '2026-09-26T10:00:00Z' };
  assert.equal(opportunityStatus({ ...base, deadline: inDays(15) }, NOW).state, 'open');
  assert.equal(opportunityStatus({ ...base, deadline: inDays(14) }, NOW).state, 'closing-soon');
  assert.equal(opportunityStatus({ ...base, deadline: inDays(14) }, NOW).stateLabel, 'Closes in 14 days');
  assert.equal(opportunityStatus({ ...base, deadline: inDays(1) }, NOW).stateLabel, 'Closes tomorrow');
  assert.equal(opportunityStatus({ ...base, deadline: inDays(0) }, NOW).stateLabel, 'Closes today');
  // The last day is still actionable; the day after is not.
  assert.equal(opportunityStatus({ ...base, deadline: inDays(0) }, NOW).actionable, true);
  assert.equal(opportunityStatus({ ...base, deadline: inDays(-1) }, NOW).actionable, false);
});

test('an expired listing says so and offers nothing to apply to', () => {
  const status = opportunityStatus({ title: 'Old grant', deadline: '2026-08-01', last_verified_at: '2026-07-01T00:00:00Z' }, NOW);
  assert.equal(status.state, 'expired');
  assert.equal(status.stateLabel, 'Closed 2026-08-01');
  assert.equal(status.cta, 'Closed');
  assert.equal(status.actionable, false);
});

test('a missing or unusable deadline is stated, never invented', () => {
  assert.equal(opportunityStatus({ title: 'Rolling grant' }, NOW).state, 'undated');
  assert.equal(opportunityStatus({ title: 'Rolling grant' }, NOW).stateLabel, 'No closing date given');
  assert.equal(opportunityStatus({ title: 'Bad date', deadline: 'next month' }, NOW).state, 'undated');
  assert.equal(daysUntil(null, NOW), null);
  assert.equal(daysUntil('2026-13-45', NOW), null);
  assert.equal(daysUntil(inDays(3), NOW), 3);
});

test('a closed listing is closed regardless of its deadline', () => {
  const status = opportunityStatus({ title: 'Withdrawn', deadline: inDays(30), closed_at: '2026-10-01T00:00:00Z' }, NOW);
  assert.equal(status.state, 'closed');
  assert.equal(status.cta, 'Closed');
  assert.equal(status.actionable, false);
});

test('the status never depends on the student’s clock running backwards', () => {
  // A deadline that has just passed on the local clock but is today in UTC is
  // still today's opportunity; the comparison is on whole days, not milliseconds.
  const lateInTheDay = Date.parse('2026-10-03T23:30:00Z');
  const status = opportunityStatus({ title: 'Today only', deadline: '2026-10-03', last_verified_at: '2026-10-01T00:00:00Z' }, lateInTheDay);
  assert.equal(status.state, 'closing-soon');
  assert.equal(status.actionable, true);
});
