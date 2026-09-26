import { describe, expect, it } from 'vitest';
import { userFacingError } from '../src/lib/api';

describe('user-facing error sanitization', () => {
  it('hides database details', () => {
    expect(userFacingError(new Error('column "attempt_id" is ambiguous'))).toBe('We could not complete that request. Please try again.');
  });

  it('turns network failures into a simple user action', () => {
    expect(userFacingError(new Error('Failed to fetch dynamically imported module'))).toBe('Please check your internet connection and try again.');
  });

  it('keeps safe validation messages', () => {
    expect(userFacingError(new Error('Article title is required.'))).toBe('Article title is required.');
  });
});
