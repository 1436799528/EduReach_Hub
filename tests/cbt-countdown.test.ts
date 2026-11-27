import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  computeCbtCountdown,
  effectiveCbtDeadlineIso,
  formatClock,
  serverOffsetMsFrom,
} from '../src/lib/cbtCountdown';
import { backoffDelayMs, DEFAULT_WRITE_BACKOFF, isRetryableFailureKind } from '../src/lib/retryPolicy';

/**
 * CBT countdown contract.
 *
 * The clock is always recomputed from the server deadline — there is no
 * counter to decrement — so these tests pin the five properties the exam hall
 * promises: it counts, refresh cannot reset it, a wrong device clock cannot
 * change the deadline, a suspended tab corrects itself, and an untimed session
 * says so instead of freezing at 00:00.
 */

const SERVER_NOW = Date.parse('2026-11-24T12:00:00.000Z');

test('the countdown decreases with elapsed time, recomputed from the deadline', () => {
  const input = {
    expiresAt: new Date(SERVER_NOW + 120_000).toISOString(),
    durationMinutes: 2,
    serverOffsetMs: 0,
  };
  const atStart = computeCbtCountdown({ ...input, deviceNowMs: SERVER_NOW });
  const oneSecondLater = computeCbtCountdown({ ...input, deviceNowMs: SERVER_NOW + 1_000 });
  assert.equal(atStart.remainingSeconds, 120);
  assert.equal(oneSecondLater.remainingSeconds, 119, 'one second of elapsed time removes one second');
  // Never a counter: the value at any instant is a function of the deadline.
  const muchLater = computeCbtCountdown({ ...input, deviceNowMs: SERVER_NOW + 61_500 });
  assert.equal(muchLater.remainingSeconds, Math.floor((120_000 - 61_500) / 1000), 'derived from the deadline, not decremented');
});

test('a refresh recomputes from the same deadline, so remaining time is preserved', () => {
  const expiresAt = new Date(SERVER_NOW + 300_000).toISOString();
  const before = computeCbtCountdown({ expiresAt, durationMinutes: 5, serverOffsetMs: 0, deviceNowMs: SERVER_NOW + 30_000 });
  // "Refresh": a new page load at a later device time, same server deadline.
  const after = computeCbtCountdown({ expiresAt, durationMinutes: 5, serverOffsetMs: 0, deviceNowMs: SERVER_NOW + 45_000 });
  assert.equal(before.remainingSeconds, 270);
  assert.equal(after.remainingSeconds, 255, 'the refresh continues where the clock was, it does not reset');
});

test('an incorrect device clock cannot change the deadline', () => {
  const expiresAt = new Date(SERVER_NOW + 180_000).toISOString();
  // Device clock is 2 hours fast; the offset captured from the server's own
  // time (serverTime - deviceNow) corrects it.
  const skewMs = 2 * 60 * 60 * 1000;
  const offset = serverOffsetMsFrom(new Date(SERVER_NOW).toISOString(), SERVER_NOW + skewMs)!;
  const view = computeCbtCountdown({ expiresAt, durationMinutes: 3, serverOffsetMs: offset, deviceNowMs: SERVER_NOW + skewMs });
  assert.equal(view.remainingSeconds, 180, 'the displayed time matches the server deadline despite the skewed clock');
  // A clock 3 hours slow behaves the same way.
  const slowOffset = serverOffsetMsFrom(new Date(SERVER_NOW).toISOString(), SERVER_NOW - 3 * 60 * 60 * 1000)!;
  const slowView = computeCbtCountdown({ expiresAt, durationMinutes: 3, serverOffsetMs: slowOffset, deviceNowMs: SERVER_NOW - 3 * 60 * 60 * 1000 + 10_000 });
  assert.equal(slowView.remainingSeconds, 170);
});

test('a suspended tab or device sleep corrects on the next computation', () => {
  const input = {
    expiresAt: new Date(SERVER_NOW + 600_000).toISOString(),
    durationMinutes: 10,
    serverOffsetMs: 0,
  };
  const beforeSleep = computeCbtCountdown({ ...input, deviceNowMs: SERVER_NOW });
  // The interval does not fire while suspended; on resume the recomputation
  // must show the real elapsed time, not the last tick.
  const afterSleep = computeCbtCountdown({ ...input, deviceNowMs: SERVER_NOW + 240_000 });
  assert.equal(beforeSleep.remainingSeconds, 600);
  assert.equal(afterSleep.remainingSeconds, 360, 'the countdown reflects real elapsed time after suspension');
});

test('reaching zero clamps at zero and never shows negative time', () => {
  const view = computeCbtCountdown({
    expiresAt: new Date(SERVER_NOW).toISOString(),
    durationMinutes: 1,
    serverOffsetMs: 0,
    deviceNowMs: SERVER_NOW + 5_000,
  });
  assert.equal(view.remainingSeconds, 0);
  assert.equal(view.timeAlmostUp, true);
  assert.equal(formatClock(view.remainingSeconds!), '00:00');
});

test('a timed session is timed in every mode: practice and mock both carry a deadline', () => {
  for (const mode of ['practice', 'mock'] as const) {
    // The server resolves the deadline the same way for both modes
    // (start_cbt_attempt_configured always writes expires_at).
    const row = {
      expires_at: new Date(SERVER_NOW + 120_000).toISOString(),
      started_at: new Date(SERVER_NOW).toISOString(),
      duration_minutes: mode === 'mock' ? 120 : 2,
    };
    assert.ok(effectiveCbtDeadlineIso(row), `${mode} attempts have an authoritative deadline`);
    const view = computeCbtCountdown({
      expiresAt: effectiveCbtDeadlineIso(row),
      durationMinutes: row.duration_minutes,
      serverOffsetMs: 0,
      deviceNowMs: SERVER_NOW,
    });
    assert.equal(view.timed, true, `${mode} sessions cannot bypass the countdown`);
    assert.equal(view.remainingSeconds, 120);
    assert.equal(view.progressPercent >= 0 && view.progressPercent <= 100, true);
  }
});

test('an untimed session says so instead of rendering a frozen 00:00', () => {
  const view = computeCbtCountdown({ expiresAt: null, durationMinutes: 30, serverOffsetMs: 0, deviceNowMs: SERVER_NOW });
  assert.equal(view.timed, false);
  assert.equal(view.remainingSeconds, null, 'there is no remaining time to show');
  assert.equal(view.timeAlmostUp, false, 'an untimed session is never styled as almost up');
  // A garbage timestamp is untimed as well, never a NaN clock.
  const garbage = computeCbtCountdown({ expiresAt: 'not-a-date', durationMinutes: 30, serverOffsetMs: 0, deviceNowMs: SERVER_NOW });
  assert.equal(garbage.timed, false);
  assert.equal(garbage.remainingSeconds, null);
});

test('the client duration can never override the server deadline', () => {
  // The server says two minutes remain; a stale client duration of 30 minutes
  // must not extend the clock.
  const view = computeCbtCountdown({
    expiresAt: new Date(SERVER_NOW + 120_000).toISOString(),
    durationMinutes: 30,
    serverOffsetMs: 0,
    deviceNowMs: SERVER_NOW,
  });
  assert.equal(view.remainingSeconds, 120);
  assert.equal(view.deadlineMs, SERVER_NOW + 120_000);
});

test('the server resolves legacy rows with no expires_at from their stored duration', () => {
  // Legacy insert: `started_at + (duration_minutes || ' minutes')::interval`
  // produced NULL when the exam had no default duration, then the attempt was
  // given a duration later. The deadline is started_at + duration — exactly
  // what the wizard promised — never now + duration (which would extend).
  const iso = effectiveCbtDeadlineIso({
    expires_at: null,
    started_at: '2026-11-24T12:00:00.000Z',
    duration_minutes: 30,
  });
  assert.equal(iso, '2026-11-24T12:30:00.000Z');
  // Rows with neither are genuinely untimed.
  assert.equal(effectiveCbtDeadlineIso({ expires_at: null, started_at: '2026-11-24T12:00:00.000Z', duration_minutes: null }), null);
  assert.equal(effectiveCbtDeadlineIso({}), null);
  // A set expires_at always wins, even when inconsistent with the duration.
  assert.equal(
    effectiveCbtDeadlineIso({ expires_at: '2026-11-24T12:05:00.000Z', started_at: '2026-11-24T12:00:00.000Z', duration_minutes: 30 }),
    '2026-11-24T12:05:00.000Z',
  );
});

test('an untrusted server clock reading leaves the previous offset in place', () => {
  assert.equal(serverOffsetMsFrom('garbage', SERVER_NOW), null);
  assert.equal(serverOffsetMsFrom(null, SERVER_NOW), null);
  assert.equal(serverOffsetMsFrom(undefined, SERVER_NOW), null);
  assert.equal(serverOffsetMsFrom('2026-11-24T12:00:00.000Z', SERVER_NOW), 0);
});

test('the clock renders mm:ss and clamps garbage to zero', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(65), '01:05');
  assert.equal(formatClock(3_661), '1:01:01');
  assert.equal(formatClock(-5), '00:00');
  assert.equal(formatClock(Number.NaN), '00:00');
});

test('retry backoff is exponential, capped and jittered below the ceiling', () => {
  const noJitter = { ...DEFAULT_WRITE_BACKOFF, jitterRatio: 0 };
  assert.equal(backoffDelayMs(1, noJitter, () => 0.5), 2_000);
  assert.equal(backoffDelayMs(2, noJitter, () => 0.5), 4_000);
  assert.equal(backoffDelayMs(3, noJitter, () => 0.5), 8_000);
  assert.equal(backoffDelayMs(10, noJitter, () => 0.5), 30_000, 'capped at maxMs');
  // Jitter only ever shortens; the computed delay stays the ceiling.
  assert.equal(backoffDelayMs(1, DEFAULT_WRITE_BACKOFF, () => 1), 2_000 * (1 - DEFAULT_WRITE_BACKOFF.jitterRatio));
  assert.equal(backoffDelayMs(1, DEFAULT_WRITE_BACKOFF, () => 0), 2_000);
  for (const attempt of [1, 2, 3, 4, 5]) {
    const delay = backoffDelayMs(attempt, DEFAULT_WRITE_BACKOFF);
    assert.ok(delay >= 1 && delay <= DEFAULT_WRITE_BACKOFF.maxMs);
  }
  assert.ok(isRetryableFailureKind('offline') && isRetryableFailureKind('timeout') && isRetryableFailureKind('server'));
  assert.ok(!isRetryableFailureKind('auth') && !isRetryableFailureKind('forbidden') && !isRetryableFailureKind('not-found'));
});
