import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { CbtAnswerQueue, IndexedDbAnswerJournal, recoverCbtJournal, type QueueLock, type QueueTransport } from '../src/lib/cbtAnswerQueue';
import type { CbtQuestionPayload, CbtV2Snapshot } from '../src/lib/api';

const scope = { accountId: 'aabbccdd-a1b2-4c3d-8e4f-abcdef012345', attemptId: 'abcdefab-1234-4abc-8def-abcdef123456' };
const ids = ['cabdecab-1234-4abc-8def-cabdec123456', 'eeaaeeaa-1234-4abc-8def-eeaaeeaa1234'];
const paper = ids.map((id, i) => ({ id, position: i + 1, subject: 'Test', text: 'Synthetic', options: ['A', 'B', 'C', 'D'] })) as CbtQuestionPayload[];
function mutex(): QueueLock {
  const tails = new Map<string, Promise<void>>();
  return async (name, action) => { const previous = tails.get(name) ?? Promise.resolve(); let release!: () => void; const next = new Promise<void>(done => { release = done; }); tails.set(name, previous.then(() => next)); await previous; try { return await action(); } finally { release(); } };
}
function setup() {
  let revision = 0; const answers: Record<string, number> = {}; const calls: string[] = [];
  const ledger = new Map<string, { body: string; outcome: 'accepted' | 'conflict'; acceptedRevision: number }>();
  const snapshot = (): CbtV2Snapshot => ({ protocol: 2, revision, answers: { ...answers }, status: 'in_progress', questionIds: ids });
  let lose = false;
  const transport: QueueTransport = {
    state: async () => snapshot(),
    answer: async (_attempt, body) => {
      calls.push(body.operationKey); const encoded = JSON.stringify(body); let prior = ledger.get(body.operationKey);
      if (prior && prior.body !== encoded) throw new Error('changed payload');
      let outcome: 'accepted' | 'replayed' | 'conflict';
      if (prior) outcome = prior.outcome === 'accepted' ? 'replayed' : 'conflict';
      else if (revision !== body.expectedRevision) { prior = { body: encoded, outcome: 'conflict', acceptedRevision: revision }; ledger.set(body.operationKey, prior); outcome = 'conflict'; }
      else { const position = String(ids.indexOf(body.questionId) + 1); if (body.selected === null) delete answers[position]; else answers[position] = body.selected; prior = { body: encoded, outcome: 'accepted', acceptedRevision: ++revision }; ledger.set(body.operationKey, prior); outcome = 'accepted'; }
      if (lose) { lose = false; throw new Error('unknown response'); }
      return { ...snapshot(), outcome, ...(outcome === 'conflict' ? {} : { acceptedRevision: prior.acceptedRevision }) };
    },
  };
  const lock = mutex(); const journal = new IndexedDbAnswerJournal(indexedDB, `coord-${crypto.randomUUID()}`); const queue = new CbtAnswerQueue(scope, journal, transport, lock);
  const recover = () => recoverCbtJournal({ scope, paper, journal, transport, lock, assertCurrent: () => {} });
  return { journal, queue, transport, recover, calls, snapshot, loseNext: () => { lose = true; }, lock };
}

test('coordinator replays a committed unknown response with original key before projection', async () => {
  const f = setup(); try { const op = await f.queue.enqueue(ids[0], 1, 2, null, 0); f.loseNext(); await assert.rejects(f.queue.retry(op.operationKey), /unknown/); const result = await f.recover(); assert.deepEqual(f.calls, [op.operationKey, op.operationKey]); assert.equal(result.operations[0].status, 'acknowledged'); assert.deepEqual(result.answers, { 1: 2 }); assert.equal(result.state.revision, 1); } finally { await f.journal.close(); }
});

test('two concurrent recoveries coordinate one durable operation and never double-commit', async () => {
  const f = setup(); try { const op = await f.queue.enqueue(ids[0], 1, 2, null, 0); const [a, b] = await Promise.all([f.recover(), f.recover()]); assert.equal(a.operations[0].operationKey, op.operationKey); assert.equal(b.operations[0].status, 'acknowledged'); assert.equal(f.snapshot().revision, 1); assert.equal(f.calls.length, 1); } finally { await f.journal.close(); }
});

for (const same of [true, false]) test(`multiple pending ${same ? 'same' : 'different'} question edits retain stale conflict without overwrite`, async () => {
  const f = setup(); try { const a = await f.queue.enqueue(ids[0], 1, 0, null, 0); const b = await f.queue.enqueue(same ? ids[0] : ids[1], same ? 1 : 2, 3, null, 0); await assert.rejects(f.recover(), /conflict/i); const rows = await f.queue.list(); assert.equal(rows.find(row => row.operationKey === a.operationKey)?.status, 'acknowledged'); assert.equal(rows.find(row => row.operationKey === b.operationKey)?.status, 'conflicted'); assert.deepEqual(f.snapshot().answers, { '1': 0 }); assert.equal(f.snapshot().revision, 1); } finally { await f.journal.close(); }
});

test('offline/unknown response never acknowledges or discards the pending row', async () => {
  const f = setup(); try { const op = await f.queue.enqueue(ids[0], 1, 2, null, 0); f.loseNext(); await assert.rejects(f.recover(), /unknown response/i); const rows = await f.queue.list(); assert.equal(rows[0].operationKey, op.operationKey); assert.equal(rows[0].status, 'pending'); const replay = await f.recover(); assert.equal(replay.operations[0].status, 'acknowledged'); assert.equal(f.snapshot().revision, 1); } finally { await f.journal.close(); }
});

test('scope change or malformed frozen paper prevents retries', async () => {
  const f = setup(); try { await f.queue.enqueue(ids[0], 1, 2, null, 0); await assert.rejects(recoverCbtJournal({ scope, paper, journal: f.journal, transport: f.transport, lock: f.lock, assertCurrent: () => { throw new Error('account changed'); } }), /account changed/); await assert.rejects(recoverCbtJournal({ scope, paper: [{ ...paper[0], options: [] }, paper[1]], journal: f.journal, transport: f.transport, lock: f.lock, assertCurrent: () => {} }), /review/i); assert.deepEqual(f.calls, []); } finally { await f.journal.close(); }
});

test('independent retry and refresh recovery serialize without duplicate delivery', async () => {
  const f = setup(); try {
    const op = await f.queue.enqueue(ids[0], 1, 2, null, 0);
    const [retry, recovered] = await Promise.all([f.queue.retry(op.operationKey), f.recover()]);
    assert.equal(retry.status, 'acknowledged'); assert.equal(recovered.operations[0].status, 'acknowledged');
    assert.deepEqual(f.calls, [op.operationKey]); assert.equal(f.snapshot().revision, 1);
  } finally { await f.journal.close(); }
});

test('malformed acceptance cannot acknowledge a pending record', async () => {
  const f = setup(); try {
    const op = await f.queue.enqueue(ids[0], 1, 2, null, 0);
    const transport: QueueTransport = { ...f.transport, answer: async () => ({ protocol: 2, outcome: 'accepted', revision: 1, acceptedRevision: 99, answers: { '1': 2 }, status: 'in_progress' }) };
    await assert.rejects(recoverCbtJournal({ scope, paper, journal: f.journal, transport, lock: f.lock, assertCurrent: () => {} }), /acknowledgement.*review/i);
    assert.equal((await f.queue.list()).find(row => row.operationKey === op.operationKey)?.status, 'pending');
  } finally { await f.journal.close(); }
});

test('new operation appearing during final refresh is not projected before reconciliation', async () => {
  const f = setup(); try {
    await f.queue.enqueue(ids[0], 1, 2, null, 0);
    let reads = 0;
    const transport: QueueTransport = { ...f.transport, state: async attempt => {
      if (++reads === 2) await f.queue.enqueue(ids[1], 2, 3, null, 1);
      return f.transport.state(attempt);
    } };
    await assert.rejects(recoverCbtJournal({ scope, paper, journal: f.journal, transport, lock: f.lock, assertCurrent: () => {} }), /pending.*review/i);
    const rows = await f.queue.list(); assert.deepEqual(rows.map(op => op.status), ['acknowledged', 'pending']);
    assert.deepEqual(f.snapshot().answers, { '1': 2 });
  } finally { await f.journal.close(); }
});
