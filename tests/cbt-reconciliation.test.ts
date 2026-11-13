import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareCbtDrafts } from '../src/lib/cbtReconciliation';

test('non-overlapping edits preserve the server and expose local-only intent as unsaved proposals', () => {
  const base = { '1': 0, '2': 1, '3': 2 };
  const local = { '1': 3, '2': 1, '3': 2 };
  const server = { '1': 0, '2': 2, '3': 2 };
  assert.deepEqual(compareCbtDrafts(base, local, server), {
    baseKnown: true,
    proposals: [{ position: '1', base: 0, local: 3, server: 0 }],
    conflicts: [],
  });
  assert.deepEqual(server, { '1': 0, '2': 2, '3': 2 });
  assert.deepEqual(local, { '1': 3, '2': 1, '3': 2 });
});

test('competing edits and clears require an explicit choice', () => {
  const result = compareCbtDrafts({ '1': 0, '2': 1, '3': 1 }, { '1': 1, '3': 2 }, { '1': 2, '2': 3, '3': 2 });
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.conflicts, [
    { position: '1', base: 0, local: 1, server: 2 },
    { position: '2', base: 1, local: null, server: 3 },
  ]);
});

test('local clears and server clears remain distinct and are not resurrected', () => {
  const result = compareCbtDrafts({ '1': 0, '2': 1 }, { '2': 1 }, { '1': 0 });
  assert.deepEqual(result.proposals, [{ position: '1', base: 0, local: null, server: 0 }]);
  assert.deepEqual(result.conflicts, []);
});

test('unknown base forces review for every mismatch, including clears', () => {
  assert.deepEqual(compareCbtDrafts(null, { '1': 0 }, { '2': 3 }), {
    baseKnown: false,
    proposals: [],
    conflicts: [
      { position: '1', base: null, local: 0, server: null },
      { position: '2', base: null, local: null, server: 3 },
    ],
  });
});

test('corrupt drafts are rejected rather than merged or sent', () => {
  for (const bad of [[], { '0': 1 }, { x: 1 }, { '1': 4 }, { '1': -1 }, { '1': '2' }, { '1': null }]) {
    assert.throws(() => compareCbtDrafts({}, bad as never, {}), /invalid cbt draft/i);
  }
});
