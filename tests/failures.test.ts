import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EduReachError, classifyFailure, failureKindOf } from '../src/lib/failures';

// APP-4: a connection drop, a slow server, an expired session and a rejected
// form must not all read the same to a student. The classification decides which
// message is shown and whether "try again" is even offered.

test('a typed error keeps its own kind and its recovery', () => {
  const offline = classifyFailure(new EduReachError('offline', 'offline'));
  assert.equal(offline.kind, 'offline');
  assert.equal(offline.retryable, true);
  assert.equal(offline.preserveInput, true, 'typed input survives a connection drop');
  assert.match(offline.detail, /may not have been saved or submitted/i);
  assert.match(offline.detail, /reconnect and try again/i);
  assert.doesNotMatch(offline.detail, /will (?:sync|be saved)|automatically/i, 'do not promise an unverified offline queue');

  const auth = classifyFailure(new EduReachError('unauthorised', 'auth', 401));
  assert.equal(auth.kind, 'auth');
  assert.equal(auth.retryable, false, 'retrying an expired session cannot help');
});

test('HTTP status decides the classification', () => {
  assert.equal(failureKindOf({ status: 401 }), 'auth');
  assert.equal(failureKindOf({ status: 403 }), 'forbidden');
  assert.equal(classifyFailure({ status: 403 }).retryable, false);
  assert.match(classifyFailure({ status: 403 }).detail, /permission/i);
  assert.equal(failureKindOf({ code: '42501' }), 'forbidden');
  assert.equal(failureKindOf({ status: 404 }), 'not-found');
  assert.equal(failureKindOf({ status: 408 }), 'timeout');
  assert.equal(failureKindOf({ status: 429 }), 'rate-limited');
  assert.equal(failureKindOf({ status: 503 }), 'server');
  assert.equal(failureKindOf({ statusCode: 422 }), 'validation');
  // A PostgREST code is not an HTTP status and must not be read as one.
  assert.equal(failureKindOf({ code: 'PGRST205', message: 'x' }), 'server');
  assert.equal(failureKindOf({ code: 'PGRST202', message: 'x' }), 'server');
  assert.equal(failureKindOf({ code: '42P01', message: 'relation "x" does not exist' }), 'server');
  assert.equal(failureKindOf({ code: '42883', message: 'function missing' }), 'server');
  assert.equal(failureKindOf({ code: '23505', message: 'duplicate key' }), 'validation');
  assert.equal(failureKindOf({ code: 'PGRST301' }), 'auth');
});

test('a message with no status is still classified, and unknown stays unknown', () => {
  assert.equal(failureKindOf(new Error('No questions are available for: Economics')), 'validation');
  assert.equal(failureKindOf(new Error('This CBT attempt has expired.')), null, 'a domain message is not forced into a network kind');
  assert.equal(classifyFailure(new Error('This CBT attempt has expired.')).kind, 'unknown');
  assert.equal(classifyFailure(new Error('This CBT attempt has expired.'), 'timeout').kind, 'timeout', 'the caller’s fallback applies');
  assert.equal(classifyFailure(null).kind, 'unknown');
});
