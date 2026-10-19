import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectResumableAttempt } from '../src/lib/homeResume';

const attempt = (overrides: Partial<{
  id: string;
  status: string;
  resumable: boolean;
  expiresAt: string | null;
}> = {}) => ({
  id: 'attempt-1',
  status: 'in_progress',
  resumable: true,
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  ...overrides,
});

test('the home page offers the first attempt that is genuinely resumable', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  const items = [
    attempt({ id: 'finished', status: 'submitted' }),
    attempt({ id: 'expired', expiresAt: '2026-10-19T11:59:00Z' }),
    attempt({ id: 'active', expiresAt: '2026-10-19T12:20:00Z' }),
  ];
  assert.equal(selectResumableAttempt(items, now)?.id, 'active');
});

test('a row the server will not resume is not offered, even if it looks active', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  assert.equal(selectResumableAttempt([attempt({ resumable: false })], now), null);
  assert.equal(selectResumableAttempt([attempt({ status: 'expired' })], now), null);
  assert.equal(selectResumableAttempt([attempt({ status: 'cancelled' })], now), null);
  assert.equal(selectResumableAttempt([], now), null);
});

test('a stored in_progress row past its expiry is treated as expired', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  const stale = attempt({ expiresAt: '2026-10-19T11:00:00Z' });
  assert.equal(selectResumableAttempt([stale], now), null);
});
