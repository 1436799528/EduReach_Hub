import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normaliseReviewList } from '../src/lib/api';

// `/reviews` trusted the response body: `setItems(payload.items)` and
// `setSummary(payload.summary)`. A 200 whose body was `[]` made `items`
// undefined and the page threw inside its own error boundary — "Cannot read
// properties of undefined (reading 'length')" — while the API looked healthy.
// The page-quality harness forced exactly that body and the page collapsed, so
// the reader is now given "no reviews yet" instead.

const EMPTY = { reviewCount: null, averageRating: null };

test('a real payload passes through unchanged', () => {
  const payload = {
    items: [{ id: 'r1', rating: 5 }],
    summary: { reviewCount: 12, averageRating: 4.6 },
    hasMore: true,
  };
  const result = normaliseReviewList(payload);
  assert.deepEqual(result.items, payload.items);
  assert.deepEqual(result.summary, payload.summary);
  assert.equal(result.hasMore, true);
});

test('an empty array body reads as no reviews, not a crash', () => {
  assert.deepEqual(normaliseReviewList([]), { items: [], summary: EMPTY, hasMore: false });
});

test('null, undefined and a string body read as no reviews', () => {
  for (const body of [null, undefined, '', 'unexpected', 42]) {
    const result = normaliseReviewList(body);
    assert.deepEqual(result.items, []);
    assert.equal(result.hasMore, false);
    assert.equal(result.summary.reviewCount, null);
  }
});

test('an object without the expected keys reads as no reviews', () => {
  assert.deepEqual(normaliseReviewList({ unexpected: true }), { items: [], summary: EMPTY, hasMore: false });
});

test('a summary with junk values becomes nulls rather than NaN on screen', () => {
  const result = normaliseReviewList({
    items: [],
    summary: { reviewCount: 'many', averageRating: Number.NaN },
    hasMore: 'yes',
  });
  assert.equal(result.summary.reviewCount, null);
  assert.equal(result.summary.averageRating, null);
  assert.equal(result.hasMore, false);
});

test('items that are not an array are dropped instead of being iterated', () => {
  const result = normaliseReviewList({ items: { 0: { id: 'r1' } }, summary: { reviewCount: 1, averageRating: 5 } });
  assert.deepEqual(result.items, []);
  assert.equal(result.summary.reviewCount, 1);
});
