import test from 'node:test';
import assert from 'node:assert/strict';
import { userFacingError } from '../src/lib/api';


test('hides database details', () => {
  assert.equal(
    userFacingError(new Error('column "attempt_id" is ambiguous')),
    'We could not complete that request. Please try again.',
  );
});

test('turns network failures into a simple user action', () => {
  assert.equal(
    userFacingError(new Error('Failed to fetch dynamically imported module')),
    'Please check your internet connection and try again.',
  );
});

test('keeps safe validation messages', () => {
  assert.equal(userFacingError(new Error('Article title is required.')), 'Article title is required.');
});
