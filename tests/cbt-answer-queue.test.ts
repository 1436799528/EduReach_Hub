import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { CbtAnswerQueue, IndexedDbAnswerJournal, type QueueLock, type QueueTransport } from '../src/lib/cbtAnswerQueue';
import type { CbtV2Outcome, CbtV2Snapshot } from '../src/lib/api';

const accountId = '11111111-1111-4111-8111-111111111111';
const attemptId = '22222222-2222-4222-8222-222222222222';
const q1 = '33333333-3333-4333-8333-333333333333';
const q2 = '44444444-4444-4444-8444-444444444444';
const scope = { accountId, attemptId };

// Test-only mutex; production requires the browser's Web Locks implementation.
function testLock(): QueueLock {
  const tails = new Map<string, Promise<void>>();
  return async <T>(name: string, action: () => Promise<T>): Promise<T> => {
    const previous = tails.get(name) ?? Promise.resolve();
    let release!: () => void;
    const done = new Promise<void>(resolve => { release = resolve; });
    tails.set(name, previous.then(() => done));
    await previous;
    try { return await action(); } finally { release(); }
  };
}
function fakeServer() {
  let revision = 0;
  const answers: Record<string, number> = {};
  const ledger = new Map<string, { request: string; outcome: 'accepted' | 'conflict'; acceptedRevision: number }>();
  const calls: string[] = [];
  let lost = false;
  const snapshot = (): CbtV2Snapshot => ({ protocol: 2, revision, answers: { ...answers }, status: 'in_progress', questionIds: [q1, q2] });
  const transport: QueueTransport = {
    state: async () => snapshot(),
    answer: async (_attempt, body) => {
      calls.push(body.operationKey);
      const request = JSON.stringify(body);
      let prior = ledger.get(body.operationKey);
      if (prior && prior.request !== request) throw new Error('operation key changed');
      let outcome: CbtV2Outcome['outcome'];
      if (prior) outcome = prior.outcome === 'accepted' ? 'replayed' : 'conflict';
      else if (body.expectedRevision !== revision) {
        prior = { request, outcome: 'conflict', acceptedRevision: revision };
        ledger.set(body.operationKey, prior); outcome = 'conflict';
      } else {
        const position = body.questionId === q1 ? '1' : '2';
        if (body.selected === null) delete answers[position]; else answers[position] = body.selected;
        revision++;
        prior = { request, outcome: 'accepted', acceptedRevision: revision };
        ledger.set(body.operationKey, prior); outcome = 'accepted';
      }
      const result: CbtV2Outcome = { ...snapshot(), outcome,
        ...(outcome === 'accepted' || outcome === 'replayed' ? { acceptedRevision: prior.acceptedRevision } : {}) };
      if (lost) { lost = false; throw new Error('response lost after commit'); }
      return result;
    },
  };
  return { transport, snapshot, calls, loseNext: () => { lost = true; } };
}
function fixture() {
  const name = `queue-test-${crypto.randomUUID()}`;
  const journal = new IndexedDbAnswerJournal(indexedDB, name);
  const server = fakeServer(), lock = testLock();
  const queue = new CbtAnswerQueue(scope, journal, server.transport, lock);
  return { name, journal, server, lock, queue };
}

test('per-question operations persist in insertion order, and acknowledgement records server revision', async () => {
  const { journal, server, queue } = fixture();
  try {
    const first = await queue.enqueue(q1, 1, 0, null, 0);
    const second = await queue.enqueue(q1, 1, 2, null, 0);
    assert.notEqual(first.operationKey, second.operationKey, 'changed mutation gets new identity');
    assert.ok(second.sequence > first.sequence);
    const accepted = await queue.retry(first.operationKey);
    assert.equal(accepted.status, 'acknowledged'); assert.equal(accepted.acceptedRevision, 1);
    assert.equal(accepted.lastServerRevision, 1);
    const rows = await queue.list();
    assert.equal(rows[1].status, 'pending'); assert.equal(rows[1].selected, 2, 'older acknowledgement does not remove newer choice');
    assert.deepEqual(server.snapshot().answers, { '1': 0 });
  } finally { await journal.close(); }
});

test('lost committed response survives refresh and retry uses the exact same identity', async () => {
  const { journal, server, queue, lock, name } = fixture();
  const op = await queue.enqueue(q1, 1, 1, null, 0);
  server.loseNext();
  await assert.rejects(queue.retry(op.operationKey), /response lost/);
  assert.equal(server.snapshot().revision, 1);
  assert.equal((await queue.list())[0].status, 'pending');
  await journal.close();
  const reopened = new IndexedDbAnswerJournal(indexedDB, name);
  try {
    const restored = new CbtAnswerQueue(scope, reopened, server.transport, lock);
    assert.equal((await restored.list())[0].operationKey, op.operationKey);
    const replay = await restored.retry(op.operationKey);
    assert.equal(replay.status, 'acknowledged'); assert.equal(replay.acceptedRevision, 1);
    assert.deepEqual(server.calls, [op.operationKey, op.operationKey]);
    assert.equal(server.snapshot().revision, 1, 'duplicate did not commit another write');
  } finally { await reopened.close(); }
});

test('same-question race retains both answers and requires explicit new-key conflict resolution', async () => {
  const { journal, server, queue, lock } = fixture();
  try {
    const other = new CbtAnswerQueue(scope, journal, server.transport, lock);
    const a = await queue.enqueue(q1, 1, 0, null, 0);
    const b = await other.enqueue(q1, 1, 2, null, 0);
    const outcomes = await Promise.all([queue.retry(a.operationKey), other.retry(b.operationKey)]);
    const conflict = outcomes.find(row => row.status === 'conflicted')!;
    assert.ok(conflict); assert.equal(conflict.selected, 2); assert.equal(conflict.baseAnswer, null);
    assert.equal(conflict.lastServerAnswer, 0); assert.equal(conflict.lastServerRevision, 1);
    const replacement = await other.resolve(conflict.operationKey, 'local', 1, 0);
    assert.notEqual(replacement.operationKey, conflict.operationKey);
    assert.equal(replacement.expectedRevision, 1); assert.equal(replacement.selected, 2);
    const completed = await other.retry(replacement.operationKey);
    assert.equal(completed.status, 'acknowledged'); assert.equal(completed.lastServerRevision, 2);
    assert.deepEqual(server.snapshot().answers, { '1': 2 });
  } finally { await journal.close(); }
});

test('different-question race preserves both proposals with explicit conflict review', async () => {
  const { journal, server, queue } = fixture();
  try {
    const a = await queue.enqueue(q1, 1, 0, null, 0);
    const b = await queue.enqueue(q2, 2, 3, null, 0);
    await queue.retry(a.operationKey);
    const conflict = await queue.retry(b.operationKey);
    assert.equal(conflict.status, 'conflicted'); assert.equal(conflict.lastServerAnswer, null);
    assert.equal(conflict.selected, 3);
    const replacement = await queue.resolve(b.operationKey, 'local', conflict.lastServerRevision, conflict.lastServerAnswer);
    await queue.retry(replacement.operationKey);
    assert.deepEqual(server.snapshot().answers, { '1': 0, '2': 3 });
  } finally { await journal.close(); }
});

test('conflict cannot be resolved against an unseen newer revision; accept-server preserves original proposal', async () => {
  const { journal, queue } = fixture();
  try {
    const a = await queue.enqueue(q1, 1, 0, null, 0);
    const b = await queue.enqueue(q1, 1, 1, null, 0);
    await queue.retry(a.operationKey); await queue.retry(b.operationKey);
    const c = await queue.enqueue(q2, 2, 2, null, 1); await queue.retry(c.operationKey);
    await assert.rejects(queue.resolve(b.operationKey, 'server', 1, 0), /review.*again/i);
    const updated = (await queue.list()).find(row => row.operationKey === b.operationKey)!;
    assert.equal(updated.status, 'conflicted'); assert.equal(updated.lastServerRevision, 2); assert.equal(updated.selected, 1);
    const resolved = await queue.resolve(b.operationKey, 'server', 2, 0);
    assert.equal(resolved.status, 'resolved-server'); assert.equal(resolved.selected, 1);
  } finally { await journal.close(); }
});

test('replayed acceptance with a newer different server answer is not reported as saved', async () => {
  const { journal, server, queue, lock } = fixture();
  // Another device does not share this browser's IndexedDB journal.
  const otherJournal = new IndexedDbAnswerJournal(indexedDB, `other-device-${crypto.randomUUID()}`);
  const other = new CbtAnswerQueue(scope, otherJournal, server.transport, lock);
  try {
    const a = await queue.enqueue(q1, 1, 0, null, 0);
    server.loseNext(); await assert.rejects(queue.retry(a.operationKey));
    const b = await other.enqueue(q1, 1, 1, 0, 1); await other.retry(b.operationKey);
    const replay = await queue.retry(a.operationKey);
    assert.equal(replay.status, 'conflicted'); assert.equal(replay.acceptedRevision, 1);
    assert.equal(replay.lastServerRevision, 2); assert.equal(replay.lastServerAnswer, 1); assert.equal(replay.selected, 0);
  } finally { await journal.close(); await otherJournal.close(); }
});

test('journal failure stops transmission and scope isolates accounts and attempts', async () => {
  const { journal, server, queue, lock } = fixture();
  try {
    await queue.enqueue(q1, 1, null, null, 0);
    const other = new CbtAnswerQueue({ accountId: '55555555-5555-4555-8555-555555555555', attemptId }, journal, server.transport, lock);
    assert.deepEqual(await other.list(), []);
    await journal.close();
    await assert.rejects(queue.enqueue(q1, 1, 0, null, 0));
    assert.deepEqual(server.calls, [], 'storage failure never transmitted an operation');
  } finally { /* connection already closed */ }
});

test('a conflict key remains consumed when fetching state fails', async () => {
  const { journal, server, queue, lock } = fixture();
  try {
    const a = await queue.enqueue(q1, 1, 0, null, 0); await queue.retry(a.operationKey);
    const b = await queue.enqueue(q1, 1, 2, null, 0);
    const broken = new CbtAnswerQueue(scope, journal, { ...server.transport, state: async () => { throw new Error('offline'); } }, lock);
    await assert.rejects(broken.retry(b.operationKey), /offline/);
    const row = (await queue.list()).find(item => item.operationKey === b.operationKey)!;
    assert.equal(row.status, 'conflicted'); assert.equal(row.selected, 2); assert.equal(row.lastServerAnswer, 0);
    await broken.retry(b.operationKey);
    assert.equal(server.calls.filter(key => key === b.operationKey).length, 1);
  } finally { await journal.close(); }
});

test('an unresolved earlier conflict blocks later writes on that question but not another question', async () => {
  const { journal, server, queue } = fixture();
  try {
    const first = await queue.enqueue(q1, 1, 0, null, 0);
    const older = await queue.enqueue(q1, 1, 1, null, 0);
    await queue.retry(first.operationKey);
    assert.equal((await queue.retry(older.operationKey)).status, 'conflicted');
    const newer = await queue.enqueue(q1, 1, 2, 0, 1);
    const independent = await queue.enqueue(q2, 2, 3, null, 1);
    await assert.rejects(queue.retry(newer.operationKey), /earlier.*conflict/i);
    assert.deepEqual(server.snapshot().answers, { '1': 0 });
    assert.equal((await queue.list()).find(row => row.operationKey === newer.operationKey)?.status, 'pending');
    assert.equal((await queue.retry(independent.operationKey)).status, 'acknowledged');
    assert.deepEqual(server.snapshot().answers, { '1': 0, '2': 3 });
  } finally { await journal.close(); }
});

test('later local operation on a question waits for an earlier unknown write', async () => {
  const { journal, server, queue } = fixture();
  try {
    const first = await queue.enqueue(q1, 1, 0, null, 0);
    const newer = await queue.enqueue(q1, 1, 1, null, 0);
    await assert.rejects(queue.retry(newer.operationKey), /earlier.*pending/i);
    assert.deepEqual(server.calls, []);
    assert.equal((await queue.retry(first.operationKey)).status, 'acknowledged');
    assert.equal((await queue.retry(newer.operationKey)).status, 'conflicted');
  } finally { await journal.close(); }
});

test('same-question ordering treats UUID letter case as identical', async () => {
  const { journal, server, queue } = fixture();
  const question = 'a3333333-3333-4333-8333-333333333333';
  try {
    await queue.enqueue(question, 1, 0, null, 0);
    const newer = await queue.enqueue(question.toUpperCase(), 1, 1, null, 0);
    await assert.rejects(queue.retry(newer.operationKey), /earlier.*pending/i);
    assert.deepEqual(server.calls, []);
  } finally { await journal.close(); }
});
