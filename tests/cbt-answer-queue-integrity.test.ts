import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { CbtAnswerQueue, IndexedDbAnswerJournal, type QueueLock, type QueueTransport } from '../src/lib/cbtAnswerQueue';

const scope = { accountId: '11111111-1111-4111-8111-111111111111', attemptId: '22222222-2222-4222-8222-222222222222' };
const q = '33333333-3333-4333-8333-333333333333';
const lock: QueueLock = (_name, action) => action();
const snapshot = { protocol: 2 as const, revision: 1, answers: { '1': 0 }, status: 'in_progress', questionIds: [q] };
const transport: QueueTransport = {
  state: async () => snapshot,
  answer: async () => ({ ...snapshot, outcome: 'conflict' }),
};

test('frozen operation cannot be changed under an existing key', async () => {
  const journal = new IndexedDbAnswerJournal(indexedDB, `integrity-${crypto.randomUUID()}`);
  try {
    const queue = new CbtAnswerQueue(scope, journal, transport, lock);
    const op = await queue.enqueue(q, 1, 2, null, 0);
    await assert.rejects(journal.transition(scope, op.operationKey, 'pending', { ...op, selected: 3 }));
    assert.deepEqual((await queue.list())[0], op);
  } finally { await journal.close(); }
});

test('conflict replacement transaction rolls back if the new key already exists', async () => {
  const journal = new IndexedDbAnswerJournal(indexedDB, `integrity-${crypto.randomUUID()}`);
  try {
    const queue = new CbtAnswerQueue(scope, journal, transport, lock);
    const conflict = await queue.enqueue(q, 1, 2, null, 0);
    const duplicate = await queue.enqueue(q, 1, 3, null, 0);
    await queue.retry(conflict.operationKey);
    const collision = new CbtAnswerQueue(scope, journal, transport, lock, () => duplicate.operationKey);
    await assert.rejects(collision.resolve(conflict.operationKey, 'local', 1, 0));
    const rows = await queue.list();
    assert.equal(rows.find(row => row.operationKey === conflict.operationKey)?.status, 'conflicted');
    assert.equal(rows.find(row => row.operationKey === duplicate.operationKey)?.status, 'pending');
    assert.equal(rows.length, 2);
  } finally { await journal.close(); }
});

test('missing cross-tab lock never sends and preserves pending operation', async () => {
  const journal = new IndexedDbAnswerJournal(indexedDB, `integrity-${crypto.randomUUID()}`);
  let sends = 0;
  try {
    const queue = new CbtAnswerQueue(scope, journal, { ...transport, answer: async () => { sends++; return { ...snapshot, outcome: 'conflict' }; } });
    const op = await queue.enqueue(q, 1, 2, null, 0);
    await assert.rejects(queue.retry(op.operationKey), /coordination is unavailable/i);
    assert.equal(sends, 0); assert.equal((await queue.list())[0].status, 'pending');
  } finally { await journal.close(); }
});

test('malformed acknowledgement cannot become saved', async () => {
  const journal = new IndexedDbAnswerJournal(indexedDB, `integrity-${crypto.randomUUID()}`);
  try {
    const queue = new CbtAnswerQueue(scope, journal, { ...transport, answer: async () => ({ ...snapshot, outcome: 'accepted', acceptedRevision: 99 }) }, lock);
    const op = await queue.enqueue(q, 1, 2, null, 0);
    await assert.rejects(queue.retry(op.operationKey), /acknowledgement requires review/i);
    assert.equal((await queue.list())[0].status, 'pending');
  } finally { await journal.close(); }
});

test('journal rejects malformed stored-operation fields without changing existing rows', async () => {
  const journal = new IndexedDbAnswerJournal(indexedDB, `integrity-${crypto.randomUUID()}`);
  try {
    const queue = new CbtAnswerQueue(scope, journal, transport, lock);
    const base = await queue.enqueue(q, 1, 2, null, 0);
    const badFields: Array<[string, unknown]> = [
      ['accountId', 'wrong'], ['attemptId', 'wrong'], ['questionId', 'wrong'], ['operationKey', 'wrong'],
      ['position', 0], ['position', 1.5], ['selected', '1'], ['selected', -1], ['selected', 4],
      ['baseAnswer', '0'], ['baseAnswer', 4], ['lastServerAnswer', -1],
      ['expectedRevision', -1], ['lastServerRevision', 1.5], ['sequence', -1], ['acceptedRevision', -1],
      ['createdAt', NaN], ['updatedAt', Infinity], ['status', 'saved'],
    ];
    for (const [field, value] of badFields) {
      const candidate = { ...base, operationKey: crypto.randomUUID(), [field]: value };
      await assert.rejects(journal.add(candidate as never), `${field}=${String(value)}`);
    }
    assert.deepEqual(await queue.list(), [base]);
  } finally { await journal.close(); }
});
