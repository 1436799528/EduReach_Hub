import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STATUS_NOTIFICATION_COPY,
  notificationForStatus,
  serviceTitleFor,
} from '../src/server/notifications';
import {
  notificationCategory,
  notificationNeedsAction,
  notificationTone,
} from '../src/lib/notificationTone';
import {
  isValidPhone,
  normalizePhone,
} from '../src/lib/authProviders';

// ---------------------------------------------------------
// 1. Safe Redirect Validation (Open Redirect Protection)
// ---------------------------------------------------------
function isSafeRedirect(next: string | null | undefined): boolean {
  if (!next) return false;
  // Must start with '/' and not '//' or '/\'
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return false;
  }
  // Must not contain explicit protocol schemes or control characters
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next) || /[\r\n]/.test(next)) {
    return false;
  }
  return true;
}

function getSafeNextPath(search: string): string {
  const next = new URLSearchParams(search).get('next');
  return isSafeRedirect(next) ? (next as string) : '/dashboard';
}

test('safe redirect helper rejects open redirect attack vectors', () => {
  // Disallowed redirects
  assert.equal(isSafeRedirect('https://malicious.com'), false);
  assert.equal(isSafeRedirect('//malicious.com'), false);
  assert.equal(isSafeRedirect('/\\malicious.com'), false);
  assert.equal(isSafeRedirect('javascript:alert(1)'), false);
  assert.equal(isSafeRedirect('data:text/html,evil'), false);
  assert.equal(isSafeRedirect(''), false);
  assert.equal(isSafeRedirect(null), false);
  assert.equal(isSafeRedirect(undefined), false);

  // Allowed internal redirects
  assert.equal(isSafeRedirect('/dashboard'), true);
  assert.equal(isSafeRedirect('/dashboard/services?ref=ER-2026-0001'), true);
  assert.equal(isSafeRedirect('/cbt/practice'), true);
  assert.equal(isSafeRedirect('/institutions/unical'), true);

  // Path resolution fallback
  assert.equal(getSafeNextPath('?next=https://attacker.com'), '/dashboard');
  assert.equal(getSafeNextPath('?next=//attacker.com'), '/dashboard');
  assert.equal(getSafeNextPath('?next=/cbt/practice'), '/cbt/practice');
  assert.equal(getSafeNextPath(''), '/dashboard');
});

// ---------------------------------------------------------
// 2. Phone Normalisation & E.164 Validation
// ---------------------------------------------------------
test('phone normalization accurately formats Nigerian local & international numbers', () => {
  assert.equal(normalizePhone('08012345678'), '+2348012345678');
  assert.equal(normalizePhone('2348012345678'), '+2348012345678');
  assert.equal(normalizePhone('+2348012345678'), '+2348012345678');
  assert.equal(normalizePhone('+14155552671'), '+14155552671');
  assert.equal(isValidPhone('08012345678'), true);
  assert.equal(isValidPhone('+2348012345678'), true);

  // Ambiguous bare national number without country code is rejected
  assert.equal(normalizePhone('5551234567'), '');
  assert.equal(isValidPhone('5551234567'), false);
});

// ---------------------------------------------------------
// 3. In-App Notification Tone, Category & Action Semantics
// ---------------------------------------------------------
test('notificationTone maps status transitions to actionable UI tones', () => {
  assert.equal(notificationTone({ status: 'completed' }), 'success');
  assert.equal(notificationTone({ status: 'awaiting_information' }), 'warning');
  assert.equal(notificationTone({ status: 'rejected' }), 'danger');
  assert.equal(notificationTone({ status: 'processing' }), 'warning');
  assert.equal(notificationTone({ status: 'reviewing' }), 'warning');
  assert.equal(notificationTone({ status: 'general_notice' }), 'info');

  assert.equal(notificationNeedsAction({ status: 'awaiting_information' }), true);
  assert.equal(notificationNeedsAction({ status: 'completed' }), false);

  assert.equal(notificationCategory({ status: 'awaiting_information' }), 'Action required');
  assert.equal(notificationCategory({ status: 'completed' }), 'Update');
  assert.equal(notificationCategory({ status: 'reviewing' }), 'In progress');
  assert.equal(notificationCategory({ status: 'rejected' }), 'Needs attention');
});

// ---------------------------------------------------------
// 4. Notification Lifecycle, Copy & Idempotency
// ---------------------------------------------------------
test('every workflow status has unambiguous student copy without internal jargon', () => {
  const WORKFLOW_STATUSES = [
    'submitted', 'reviewing', 'processing', 'awaiting_information',
    'completed', 'closed', 'rejected', 'cancelled',
  ];

  for (const status of WORKFLOW_STATUSES) {
    const copy = STATUS_NOTIFICATION_COPY[status];
    assert.ok(copy, `Missing copy for ${status}`);
    assert.ok(copy.title.trim().length > 0);
    assert.ok(copy.body.trim().length > 0);
    assert.doesNotMatch(copy.title + copy.body, /admin_|admin note|ticket|candidate/i);
    assert.doesNotMatch(copy.title + copy.body, /awaiting_information|_request\b|status:/i);
  }
});

test('serviceTitleFor extracts clean service title with fallback', () => {
  const reqWithObj = {
    id: 'req-1',
    user_id: 'user-1',
    status: 'submitted',
    reference_code: 'ER-2026-0001',
    service_catalog: { title: 'JAMB Regularization' },
  };
  assert.equal(serviceTitleFor(reqWithObj), 'JAMB Regularization');

  const reqWithArr = {
    ...reqWithObj,
    service_catalog: [{ title: 'Transcript Processing' }],
  };
  assert.equal(serviceTitleFor(reqWithArr), 'Transcript Processing');

  const reqWithNull = {
    ...reqWithObj,
    service_catalog: null,
  };
  assert.equal(serviceTitleFor(reqWithNull), 'Student service request');
});

test('notificationForStatus generates correct metadata and links', () => {
  const req = {
    id: 'req-1',
    user_id: 'user-1',
    status: 'submitted',
    reference_code: 'ER-2026-0001',
    service_catalog: { title: 'NELFUND loan support' },
  };

  const notification = notificationForStatus(req, 'completed');
  assert.ok(notification);
  assert.equal(notification.notification_type, 'service_request');
  assert.equal(notification.href, '/dashboard/services?ref=ER-2026-0001');
  assert.deepEqual(notification.metadata, {
    request_id: 'req-1',
    reference_code: 'ER-2026-0001',
    from: 'submitted',
    to: 'completed',
  });
});
