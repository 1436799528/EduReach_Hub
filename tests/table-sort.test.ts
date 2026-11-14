import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ariaSortFor, nextSortState, NO_SORT, sortRows } from '../src/lib/tableSort';

const rows = [
  { id: 'a', title: 'JAMB registration opens', published: null },
  { id: 'b', title: 'Admission list update', published: 20 },
  { id: 'c', title: 'NELFUND loan window', published: 10 },
];

test('a column cycles ascending, descending, then back to server order', () => {
  const ascending = nextSortState(NO_SORT, 'title');
  assert.equal(ascending.direction, 'ascending');
  const descending = nextSortState(ascending, 'title');
  assert.equal(descending.direction, 'descending');
  const restored = nextSortState(descending, 'title');
  assert.equal(restored.direction, 'none');
  assert.equal(ariaSortFor(restored, 'title'), 'none');
  // A different column starts a fresh ascending sort.
  assert.equal(nextSortState(descending, 'published').direction, 'ascending');
});

test('rows sort by text and numeric values, and missing values stay last', () => {
  const byTitle = sortRows(rows, { key: 'title', direction: 'ascending' }, (row, key) => key === 'title' ? row.title : null);
  assert.deepEqual(byTitle.map((row) => row.id), ['b', 'a', 'c']);

  const byPublished = sortRows(rows, { key: 'published', direction: 'descending' }, (row, key) => key === 'published' ? row.published : null);
  assert.deepEqual(byPublished.map((row) => row.id), ['b', 'c', 'a'], 'a missing date is last even when descending');

  const unsorted = sortRows(rows, NO_SORT, (row) => row.title);
  assert.equal(unsorted, rows, 'none returns the original array so server order is preserved');
});
