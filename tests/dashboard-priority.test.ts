import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cbtAttemptState,
  dashboardPriorities,
  minutesRemaining,
  remainingLabel,
} from '../src/lib/dashboardPriority';

// DASH-1: the dashboard must describe the state the server will actually
// enforce, and must lead with what needs the student now.

const NOW = new Date('2026-10-03T09:00:00.000Z').getTime();
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

test('an attempt is only resumable while its own expiry is in the future', () => {
  assert.equal(cbtAttemptState({ id: 'a', status: 'in_progress', expires_at: at(30) }, NOW), 'active');
  assert.equal(cbtAttemptState({ id: 'b', status: 'in_progress', expires_at: at(-1) }, NOW), 'expired');
  // The server writes `expired` when it notices; the clock passing is the same
  // fact one tick earlier.
  assert.equal(cbtAttemptState({ id: 'c', status: 'expired', expires_at: at(-90) }, NOW), 'expired');
  // No expiry at all: still resumable, and no countdown may be shown.
  assert.equal(cbtAttemptState({ id: 'd', status: 'in_progress', expires_at: null }, NOW), 'active');
  assert.equal(cbtAttemptState({ id: 'e', status: 'submitted', expires_at: at(30) }, NOW), 'finished');
  assert.equal(cbtAttemptState({ id: 'f', status: 'cancelled' }, NOW), 'finished');
  // A record saved without a status is a record, never an open test.
  assert.equal(cbtAttemptState({ id: 'g', submitted_at: at(-10) }, NOW), 'finished');
});

test('the countdown never goes negative and never guesses', () => {
  assert.equal(minutesRemaining(at(45), NOW), 45);
  assert.equal(minutesRemaining(at(-5), NOW), 0, 'an overdue attempt reads as zero, not as negative time');
  assert.equal(minutesRemaining(null, NOW), null);
  assert.equal(minutesRemaining('not a date', NOW), null);

  assert.equal(remainingLabel(at(45), NOW), '45 minutes left');
  assert.equal(remainingLabel(at(1), NOW), '1 minute left');
  assert.equal(remainingLabel(at(1) + '', NOW), '1 minute left');
  assert.equal(remainingLabel(new Date(NOW + 30_000).toISOString(), NOW), 'Less than a minute left');
  assert.equal(remainingLabel(at(-1), NOW), 'Time is up');
  assert.equal(remainingLabel(null, NOW), null, 'an attempt with no expiry must not invent a time');
});

test('a running test outranks everything and links straight back into it', () => {
  const items = dashboardPriorities({
    now: NOW,
    profileComplete: false,
    profileMissing: ['Faculty', 'Level'],
    attempts: [{ id: 'attempt-7', status: 'in_progress', expires_at: at(12), subject: 'Physics' }],
    requests: [{ status: 'awaiting_information', reference_code: 'ER-1002' }],
    unreadNotifications: 4,
  });
  assert.equal(items[0].id, 'resume-attempt');
  assert.equal(items[0].tone, 'urgent');
  assert.equal(items[0].href, '/cbt/session/attempt-7');
  assert.match(items[0].detail, /12 minutes left/, 'the student is told how long is left');
  assert.ok(items.length <= 3, 'the strip stays scannable');
});

test('the soonest deadline is the one surfaced', () => {
  const items = dashboardPriorities({
    now: NOW,
    profileComplete: true,
    attempts: [
      { id: 'later', status: 'in_progress', expires_at: at(50), subject: 'Biology' },
      { id: 'sooner', status: 'in_progress', expires_at: at(4), subject: 'Chemistry' },
    ],
  });
  assert.equal(items[0].href, '/cbt/session/sooner');
  assert.match(items[0].title, /Chemistry/);
  assert.match(items[0].title, /1 more open/, 'a second open test is not hidden');
});

test('an expired attempt is never offered as resumable', () => {
  const items = dashboardPriorities({
    now: NOW,
    profileComplete: true,
    attempts: [{ id: 'gone', status: 'in_progress', expires_at: at(-30), subject: 'Physics' }],
    attemptCount: 3,
    savedCount: 2,
  });
  assert.ok(!items.some((item) => item.href.includes('/cbt/session/')), 'no resume link for an expired attempt');
  assert.equal(items[0].id, 'browse-papers', 'the page falls through to a real next step');
  assert.equal(items[0].tone, 'next');
});

test('a request that cannot move without the student outranks profile filing', () => {
  const items = dashboardPriorities({
    now: NOW,
    profileComplete: false,
    profileMissing: ['School', 'Course / programme', 'Department', 'Faculty', 'Level'],
    requests: [{ status: 'awaiting_information', reference_code: 'ER-2001' }],
  });
  assert.deepEqual(items.map((item) => item.id), ['request-needs-info', 'profile-incomplete']);
  assert.match(items[0].detail, /ER-2001/, 'the reference is quoted so it can be found');
});

test('the profile prompt names exactly what is missing', () => {
  const few = dashboardPriorities({ now: NOW, profileComplete: false, profileMissing: ['Faculty', 'Level'] });
  assert.match(few[0].detail, /Still missing: Faculty and Level\./);
  const many = dashboardPriorities({
    now: NOW,
    profileComplete: false,
    profileMissing: ['School', 'Course / programme', 'Department', 'Faculty', 'Level', 'Session'],
  });
  assert.match(many[0].detail, /Still missing: School, Course \/ programme, Department, and 3 more\./);
  const complete = dashboardPriorities({ now: NOW, profileComplete: true });
  assert.ok(!complete.some((item) => item.id === 'profile-incomplete'), 'a complete profile is not nagged about');
});

test('with nothing pressing the dashboard still suggests one real step', () => {
  const fresh = dashboardPriorities({ now: NOW, profileComplete: true, attempts: [], requests: [] });
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].id, 'first-practice');

  const practised = dashboardPriorities({ now: NOW, profileComplete: true, attemptCount: 4, savedCount: 0 });
  assert.equal(practised[0].id, 'shortlist-schools');

  const settled = dashboardPriorities({ now: NOW, profileComplete: true, attemptCount: 4, savedCount: 3 });
  assert.equal(settled[0].id, 'browse-papers');

  const nag = dashboardPriorities({
    now: NOW,
    profileComplete: false,
    profileMissing: ['Level'],
    requests: [{ status: 'completed', reference_code: 'ER-1' }],
  });
  assert.deepEqual(nag.map((item) => item.id), ['profile-incomplete'], 'a finished request is not presented as work to do');
});

test('unread notifications only take a slot when there is one to take', () => {
  const withRoom = dashboardPriorities({ now: NOW, profileComplete: true, attemptCount: 2, savedCount: 1, unreadNotifications: 2 });
  assert.ok(withRoom.some((item) => item.id === 'unread-notifications'));

  const noRoom = dashboardPriorities({
    now: NOW,
    profileComplete: false,
    profileMissing: ['Level'],
    attempts: [{ id: 'open', status: 'in_progress', expires_at: at(9), subject: 'Physics' }],
    requests: [{ status: 'awaiting_information', reference_code: 'ER-9' }],
    unreadNotifications: 5,
  });
  assert.equal(noRoom.length, 3, 'the cap holds');
  assert.deepEqual(noRoom.map((item) => item.id), ['resume-attempt', 'request-needs-info', 'profile-incomplete']);
});

test('every priority item is actionable and none is fabricated', () => {
  const items = dashboardPriorities({
    now: NOW,
    profileComplete: false,
    profileMissing: ['Level'],
    attempts: [
      { id: 'open', status: 'in_progress', expires_at: at(20), subject: 'Use of English' },
      { id: 'done', status: 'submitted', score: 70, expires_at: null },
    ],
    requests: [{ status: 'processing', reference_code: 'ER-5' }],
    unreadNotifications: 1,
  });
  for (const item of items) {
    assert.ok(item.href.startsWith('/'), `${item.id} links inside the app`);
    assert.ok(item.cta.length > 0, `${item.id} names the action`);
    assert.ok(item.title.length > 0 && item.detail.length > 0, `${item.id} explains itself`);
    assert.ok(['urgent', 'attention', 'next'].includes(item.tone));
  }
  assert.ok(!items.some((item) => item.id === 'request-needs-info'), 'a request in progress is EduReach working, not the student');
});
