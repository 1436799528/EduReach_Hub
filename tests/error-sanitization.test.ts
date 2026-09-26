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

test('does not stringify object-shaped API errors', () => {
  const fallback = 'We could not complete that request. Please try again.';
  assert.equal(userFacingError({ message: { reason: 'private details' } }), fallback);
  assert.equal(userFacingError({ details: { query: 'select * from profiles' } }), fallback);
  assert.equal(userFacingError({ error: { message: ['bad', 'shape'] } }), fallback);
  assert.equal(userFacingError({ message: 'column secret does not exist' }), fallback);
});

test('uses a safe string nested in a structured API error', () => {
  assert.equal(userFacingError({ error: { message: 'This service is not available.' } }), 'This service is not currently available. Please choose another option.');
});
