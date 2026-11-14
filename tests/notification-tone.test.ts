import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  notificationCategory,
  notificationNeedsAction,
  notificationTone,
} from '../src/lib/notificationTone';

// UI-5: the panel must not colour every item. The service status NTF-1 writes
// is the strongest signal; unknown events stay neutral.

test('service statuses map to the one meaning they carry', () => {
  assert.equal(notificationTone({ status: 'completed' }), 'success');
  assert.equal(notificationTone({ status: 'closed' }), 'success');
  assert.equal(notificationTone({ status: 'awaiting_information' }), 'warning');
  assert.equal(notificationTone({ status: 'processing' }), 'warning');
  assert.equal(notificationTone({ status: 'rejected' }), 'danger');
  assert.equal(notificationTone({ status: 'cancelled' }), 'danger');
  assert.equal(notificationTone({ status: 'submitted' }), 'info');
});

test('a status wins over a generic type and copy', () => {
  assert.equal(notificationTone({ status: 'rejected', type: 'success', title: 'Saved' }), 'danger');
  assert.equal(notificationTone({ status: 'completed', type: 'warning', title: 'Needs attention' }), 'success');
});

test('events without a status are classified by an explicit type vocabulary', () => {
  assert.equal(notificationTone({ type: 'service_request', title: 'Result available' }), 'success');
  assert.equal(notificationTone({ type: 'system', title: 'Profile saved' }), 'success');
  assert.equal(notificationTone({ type: 'security', title: 'Sign-in failed' }), 'danger');
  assert.equal(notificationTone({ type: 'system', title: 'New practice questions' }), 'info');
  assert.equal(notificationTone({}), 'info', 'an unknown event is neutral, not red');
});

test('only awaiting_information is labelled as requiring the student', () => {
  assert.equal(notificationNeedsAction({ status: 'awaiting_information' }), true);
  for (const status of ['submitted', 'processing', 'completed', 'rejected', 'closed']) {
    assert.equal(notificationNeedsAction({ status }), false, status);
  }
});

test('the category label never leaks a raw status code', () => {
  for (const status of ['submitted', 'reviewing', 'processing', 'awaiting_information', 'completed', 'closed', 'rejected', 'cancelled']) {
    const category = notificationCategory({ status });
    assert.match(category, /^[A-Z][a-z]+( [a-z]+)?$/);
    assert.doesNotMatch(category, /_/);
  }
  assert.equal(notificationCategory({ status: 'awaiting_information' }), 'Action required');
});
