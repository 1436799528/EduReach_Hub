import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indexedDB, IDBObjectStore } from 'fake-indexeddb';
import { CbtAnswerQueue, IndexedDbAnswerJournal, prepareCbtLocalSubmission, type QueueLock, type QueueTransport } from '../src/lib/cbtAnswerQueue';
import type { CbtQuestionPayload } from '../src/lib/api';

// Synthetic IndexedDB fixtures only: these do not prove multi-device or HTTP safety.
const scope = { accountId: 'aabbccdd-a1b2-4c3d-8e4f-abcdef012345', attemptId: 'abcdefab-1234-4abc-8def-abcdef123456' };
const question = 'cabdecab-1234-4abc-8def-cabdec123456';
const paper: CbtQuestionPayload[] = [{ id: question, position: 1, subject: 'Test', text: 'Synthetic', options: ['A', 'B'] }];
const lock: QueueLock = async (_name, action) => action();
const transport: QueueTransport = {
  state: async () => ({ protocol: 2, revision: 0, status: 'in_progress', answers: {}, questionIds: [question] }),
  answer: async () => { throw new Error('synthetic transport must not send'); },
};

function fixture(name = `local-seal-${crypto.randomUUID()}`) {
  const journal = new IndexedDbAnswerJournal(indexedDB, name);
  return { name, journal, queue: new CbtAnswerQueue(scope, journal, transport, lock) };
}

test('pending intent blocks sealing and remains intact', async () => {
  const f = fixture();
  try {
    const op = await f.queue.enqueue(question, 1, 1, null, 0);
    await assert.rejects(f.journal.sealSubmission(scope, crypto.randomUUID(), 0), /pending.*review/i);
    assert.equal(await f.journal.readSubmission(scope), null);
    assert.equal((await f.queue.list())[0].operationKey, op.operationKey);
    assert.equal((await f.queue.list())[0].status, 'pending');
  } finally { await f.journal.close(); }
});

test('the durable seal preserves the same finalization ID and revision across reopen', async () => {
  const f = fixture();
  const key = crypto.randomUUID();
  const initial = await f.journal.sealSubmission(scope, key, 4);
  await f.journal.close();
  const reopened = fixture(f.name);
  try {
    assert.deepEqual(await reopened.journal.readSubmission(scope), initial);
    assert.deepEqual(await reopened.journal.sealSubmission(scope, crypto.randomUUID(), 7), initial);
    await assert.rejects(reopened.queue.enqueue(question, 1, 1, null, 4), /submission has already started/i);
    assert.deepEqual(await reopened.queue.list(), []);
  } finally { await reopened.journal.close(); }
});

test('independent tabs cannot both seal and persist a new pending operation', async () => {
  const first = fixture();
  const second = fixture(first.name);
  try {
    const [seal, enqueue] = await Promise.allSettled([
      first.journal.sealSubmission(scope, crypto.randomUUID(), 0),
      second.queue.enqueue(question, 1, 1, null, 0),
    ]);
    assert.notEqual(seal.status, enqueue.status, 'exactly one operation must commit');
    const rows = await first.queue.list();
    const stored = await first.journal.readSubmission(scope);
    if (seal.status === 'fulfilled') { assert.ok(stored); assert.equal(rows.length, 0); }
    else { assert.equal(stored, null); assert.equal(rows.length, 1); assert.equal(rows[0].status, 'pending'); }
  } finally { await first.journal.close(); await second.journal.close(); }
});

test('submission seals are account and attempt scoped, not a global queue lock', async () => {
  const f = fixture();
  const other = { ...scope, attemptId: 'abcdefab-1234-4abc-8def-abcdef123457' };
  const queue = new CbtAnswerQueue(other, f.journal, transport, lock);
  try {
    await f.journal.sealSubmission(scope, crypto.randomUUID(), 0);
    const op = await queue.enqueue(question, 1, 2, null, 0);
    assert.equal(op.status, 'pending');
    assert.equal(await f.journal.readSubmission(other), null);
  } finally { await f.journal.close(); }
});

test('conflicted and closed intents cannot be sealed or silently discarded', async () => {
  for (const status of ['conflicted', 'closed'] as const) {
    const f = fixture();
    try {
      const op = await f.queue.enqueue(question, 1, 1, null, 0);
      assert.equal(await f.journal.transition(scope, op.operationKey, 'pending', { ...op, status }), true);
      await assert.rejects(f.journal.sealSubmission(scope, crypto.randomUUID(), 0), /unresolved.*review/i);
      assert.equal((await f.queue.list())[0].status, status);
      assert.equal(await f.journal.readSubmission(scope), null);
    } finally { await f.journal.close(); }
  }
});

test('local preparation retries an unknown answer with its original key before sealing', async () => {
  const f = fixture();
  let revision = 0;
  let lost = true;
  const calls: string[] = [];
  const simulated: QueueTransport = {
    state: async () => ({ protocol: 2, revision, status: 'in_progress', answers: revision ? { '1': 1 } : {} as Record<string, number>, questionIds: [question] }),
    answer: async (_attempt, body) => {
      calls.push(body.operationKey);
      if (!revision) revision = 1;
      if (lost) { lost = false; throw new Error('synthetic unknown response'); }
      return { protocol: 2, outcome: 'replayed', revision, acceptedRevision: 1, status: 'in_progress', answers: { '1': 1 } };
    },
  };
  const queue = new CbtAnswerQueue(scope, f.journal, simulated, lock);
  const prepare = () => prepareCbtLocalSubmission({ scope, paper, journal: f.journal, transport: simulated, lock, assertCurrent: () => {} });
  try {
    const op = await queue.enqueue(question, 1, 1, null, 0);
    await assert.rejects(prepare(), /unknown response/);
    assert.equal(await f.journal.readSubmission(scope), null);
    assert.equal((await queue.list())[0].status, 'pending');
    const seal = await prepare();
    assert.deepEqual(calls, [op.operationKey, op.operationKey]);
    assert.equal((await queue.list())[0].status, 'acknowledged');
    assert.equal(seal.expectedRevision, 1);
    assert.deepEqual(await prepare(), seal);
    assert.deepEqual(calls, [op.operationKey, op.operationKey]);
  } finally { await f.journal.close(); }
});

test('an intent arriving after recovery but before the seal blocks local preparation', async () => {
  const f = fixture();
  const seal = f.journal.sealSubmission.bind(f.journal);
  f.journal.sealSubmission = async (...args) => {
    await f.queue.enqueue(question, 1, 1, null, 0);
    return seal(...args);
  };
  try {
    await assert.rejects(prepareCbtLocalSubmission({ scope, paper, journal: f.journal, transport, lock, assertCurrent: () => {} }), /pending.*review/i);
    assert.equal(await f.journal.readSubmission(scope), null);
    assert.equal((await f.queue.list())[0].status, 'pending');
  } finally { await f.journal.close(); }
});

test('an existing row cannot become pending or conflicted after sealing', async () => {
  const f = fixture();
  try {
    const op = await f.queue.enqueue(question, 1, 1, null, 0);
    const acknowledged = { ...op, status: 'acknowledged' as const, acceptedRevision: 1, lastServerRevision: 1, lastServerAnswer: 1 };
    assert.equal(await f.journal.transition(scope, op.operationKey, 'pending', acknowledged), true);
    await f.journal.sealSubmission(scope, crypto.randomUUID(), 1);
    await assert.rejects(f.journal.transition(scope, op.operationKey, 'acknowledged', { ...acknowledged, status: 'pending' }));
    assert.equal((await f.queue.list())[0].status, 'acknowledged');
  } finally { await f.journal.close(); }
});

test('independent device storage is invisible to the local seal and remains pending', async () => {
  const offline = fixture();
  const submitting = fixture();
  try {
    const op = await offline.queue.enqueue(question, 1, 1, null, 0);
    const seal = await submitting.journal.sealSubmission(scope, crypto.randomUUID(), 0);
    assert.equal(seal.expectedRevision, 0);
    assert.equal((await offline.queue.list())[0].operationKey, op.operationKey);
    assert.equal((await offline.queue.list())[0].status, 'pending');
    // This is evidence of the missing server barrier, not authorization to submit.
  } finally { await offline.journal.close(); await submitting.journal.close(); }
});

test('old-device closed response preserves its pending payload for review', async () => {
  const f = fixture();
  const closed: QueueTransport = { ...transport, answer: async () => ({ protocol: 2, outcome: 'closed' }) };
  const queue = new CbtAnswerQueue(scope, f.journal, closed, lock);
  try {
    const original = await queue.enqueue(question, 1, 1, null, 0);
    const result = await queue.retry(original.operationKey);
    assert.equal(result.status, 'closed');
    assert.equal(result.operationKey, original.operationKey);
    assert.equal(result.selected, original.selected);
    assert.equal((await queue.list())[0].status, 'closed');
    await assert.rejects(f.journal.sealSubmission(scope, crypto.randomUUID(), 0), /unresolved.*review/i);
  } finally { await f.journal.close(); }
});

test('an abort after the seal write rolls back the seal and permits a later intent', async () => {
  const f = fixture();
  const original = IDBObjectStore.prototype.add;
  let injected = false;
  IDBObjectStore.prototype.add = function (value, key) {
    const request = original.call(this, value, key);
    if (this.name === 'metadata' && typeof key === 'string' && key.startsWith('submission:')) {
      injected = true;
      request.onsuccess = () => this.transaction.abort();
    }
    return request;
  };
  try {
    await assert.rejects(f.journal.sealSubmission(scope, crypto.randomUUID(), 0));
    assert.equal(injected, true);
  } finally {
    IDBObjectStore.prototype.add = original;
    await f.journal.close();
  }
  const reopened = fixture(f.name);
  try {
    assert.equal(await reopened.journal.readSubmission(scope), null);
    assert.equal((await reopened.queue.enqueue(question, 1, 1, null, 0)).status, 'pending');
  } finally { await reopened.journal.close(); }
});

test('a superseded conflict seals only after its atomically linked replacement is acknowledged', async () => {
  const f = fixture();
  let revision = 1;
  const conflictTransport: QueueTransport = {
    state: async () => ({ protocol: 2, revision, status: 'in_progress', answers: { '1': revision === 1 ? 0 : 1 }, questionIds: [question] }),
    answer: async () => ({ protocol: 2, outcome: 'accepted', acceptedRevision: 2, revision: 2, answers: { '1': 1 }, status: 'in_progress' }),
  };
  const queue = new CbtAnswerQueue(scope, f.journal, conflictTransport, lock);
  try {
    const original = await queue.enqueue(question, 1, 1, null, 0);
    await f.journal.transition(scope, original.operationKey, 'pending', { ...original, status: 'conflicted', lastServerRevision: 1, lastServerAnswer: 0 });
    const replacement = await queue.resolve(original.operationKey, 'local', 1, 0);
    const stored = await queue.list();
    assert.equal(stored[0].supersededBy, replacement.operationKey);
    await assert.rejects(f.journal.sealSubmission(scope, crypto.randomUUID(), 1), /unresolved.*review/i);
    revision = 2;
    await queue.retry(replacement.operationKey);
    const seal = await f.journal.sealSubmission(scope, crypto.randomUUID(), 2);
    assert.equal(seal.expectedRevision, 2);
    assert.equal((await queue.list())[0].status, 'superseded');
    assert.equal((await queue.list())[1].status, 'acknowledged');
  } finally { await f.journal.close(); }
});

test('unlinked historical superseded records and non-atomic replacements remain blocked', async () => {
  const f = fixture();
  try {
    const op = await f.queue.enqueue(question, 1, 1, null, 0);
    await f.journal.transition(scope, op.operationKey, 'pending', { ...op, status: 'conflicted' });
    await assert.rejects(f.journal.transition(scope, op.operationKey, 'conflicted', { ...op, status: 'superseded', supersededBy: crypto.randomUUID() }), /atomically/i);
    assert.equal((await f.queue.list())[0].status, 'conflicted');
    await assert.rejects(f.journal.sealSubmission(scope, crypto.randomUUID(), 0), /unresolved.*review/i);
  } finally { await f.journal.close(); }
  const legacy = fixture();
  try {
    const op = await legacy.queue.enqueue(question, 1, 1, null, 0);
    // Simulate a pre-link journal, where no causal replacement can be proven.
    const old = { ...op, operationKey: crypto.randomUUID(), status: 'superseded' as const, sequence: 0 };
    await legacy.journal.add(old);
    await assert.rejects(legacy.journal.sealSubmission(scope, crypto.randomUUID(), 0), /unresolved.*review/i);
    assert.equal(await legacy.journal.readSubmission(scope), null);
  } finally { await legacy.journal.close(); }
});
