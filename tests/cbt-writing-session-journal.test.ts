import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { CbtAnswerQueue, IndexedDbAnswerJournal } from '../src/lib/cbtAnswerQueue';

const scope = { accountId: 'a1111111-1111-4111-8111-111111111111', attemptId: 'b1111111-1111-4111-8111-111111111111' };
const question = 'c1111111-1111-4111-8111-111111111111';
const lease = { sessionId: 'd1111111-1111-4111-8111-111111111111', sessionGeneration: 1 };

test('session request is committed before use, shared across tabs, and recovers after reopen', async () => {
  const name = `session-${crypto.randomUUID()}`;
  const a = new IndexedDbAnswerJournal(indexedDB, name), b = new IndexedDbAnswerJournal(indexedDB, name);
  const [one, two] = await Promise.all([a.beginWritingSession(scope, crypto.randomUUID()), b.beginWritingSession(scope, crypto.randomUUID())]);
  assert.deepEqual(one, two);
  const saved = await a.rememberWritingSession(scope, one.requestKey, lease.sessionId, lease.sessionGeneration);
  await a.close(); await b.close();
  const reopened = new IndexedDbAnswerJournal(indexedDB, name);
  try { assert.deepEqual(await reopened.beginWritingSession(scope, crypto.randomUUID()), saved); }
  finally { await reopened.close(); }
});

test('takeover is explicit and stale tab cannot replace the newer durable session', async () => {
  const name = `session-${crypto.randomUUID()}`;
  const a = new IndexedDbAnswerJournal(indexedDB, name), b = new IndexedDbAnswerJournal(indexedDB, name);
  try {
    const first = await a.beginWritingSession(scope, crypto.randomUUID());
    await a.rememberWritingSession(scope, first.requestKey, lease.sessionId, lease.sessionGeneration);
    const next = await b.requestWritingTakeover(scope, first.requestKey, crypto.randomUUID());
    assert.equal(next.takeover, true);
    await assert.rejects(a.rememberWritingSession(scope, first.requestKey, lease.sessionId, 1), /changed in another tab/i);
    await assert.rejects(a.requestWritingTakeover(scope, first.requestKey, crypto.randomUUID()), /changed in another tab/i);
    assert.deepEqual(await a.beginWritingSession(scope, crypto.randomUUID()), next);
  } finally { await a.close(); await b.close(); }
});

test('pending answer keeps its original lease and operation ID through an unknown response and reopen', async () => {
  const name = `session-${crypto.randomUUID()}`;
  const first = new IndexedDbAnswerJournal(indexedDB, name); const seen: unknown[] = [];
  const transport = { state: async () => ({ protocol: 2 as const, revision: 0, answers: {}, status: 'in_progress', questionIds: [question] }),
    answer: async (_id: string, body: unknown) => { seen.push(body); throw new Error('offline'); } };
  const lock = async <T,>(_name: string, action: () => Promise<T>) => action();
  const queue = new CbtAnswerQueue(scope, first, transport, lock);
  const op = await queue.enqueue(question, 1, 1, null, 0, lease);
  await assert.rejects(queue.retry(op.operationKey), /offline/);
  await first.close();
  const reopened = new IndexedDbAnswerJournal(indexedDB, name);
  try {
    const row = (await reopened.list(scope))[0];
    assert.equal(row.status, 'pending'); assert.equal(row.operationKey, op.operationKey);
    assert.equal(row.sessionId, lease.sessionId); assert.equal(row.sessionGeneration, 1);
    assert.deepEqual(seen[0], { expectedRevision: 0, operationKey: op.operationKey, questionId: question, selected: 1, ...lease });
    await assert.rejects(reopened.transition(scope, op.operationKey, 'pending', { ...row, sessionGeneration: 2 }));
  } finally { await reopened.close(); }
});

test('revoked pending intent requires review before explicit reapplication with a new lease', async () => {
  const journal = new IndexedDbAnswerJournal(indexedDB, `session-${crypto.randomUUID()}`);
  const later = { sessionId: 'e1111111-1111-4111-8111-111111111111', sessionGeneration: 2 };
  let sent = 0;
  const transport = { state: async () => ({ protocol: 2 as const, revision: 3, answers: { '1': 0 }, status: 'in_progress', questionIds: [question] }),
    answer: async () => { sent++; throw new Error('must not send while reviewing'); } };
  const queue = new CbtAnswerQueue(scope, journal, transport, async (_name, action) => action());
  try {
    const original = await queue.enqueue(question, 1, 1, null, 0, lease);
    const reviewed = await queue.reviewPending(original.operationKey);
    assert.equal(sent, 0); assert.equal(reviewed.status, 'conflicted');
    assert.equal(reviewed.lastServerAnswer, 0); assert.equal(reviewed.lastServerRevision, 3);
    const replacement = await queue.resolve(original.operationKey, 'local', 3, 0, later);
    assert.equal(replacement.sessionId, later.sessionId); assert.equal(replacement.sessionGeneration, 2);
    assert.notEqual(replacement.operationKey, original.operationKey);
    assert.equal((await queue.list())[0].supersededBy, replacement.operationKey);
    assert.equal(sent, 0);
  } finally { await journal.close(); }
});

test('pending recovery on a closed attempt leaves intent untouched', async () => {
  const journal = new IndexedDbAnswerJournal(indexedDB, `session-${crypto.randomUUID()}`);
  const queue = new CbtAnswerQueue(scope, journal, { state: async () => ({ protocol: 2, revision: 0, answers: {}, status: 'submitted', questionIds: [question] }), answer: async () => { throw new Error('unexpected send'); } }, async (_name, action) => action());
  try {
    const op = await queue.enqueue(question, 1, 1, null, 0, lease);
    await assert.rejects(queue.reviewPending(op.operationKey), /server state requires review/i);
    assert.equal((await queue.list())[0].status, 'pending');
  } finally { await journal.close(); }
});

test('tab-scoped session requests survive reopening without rebinding an older tab', async () => {
  const name = `session-${crypto.randomUUID()}`;
  const a = new IndexedDbAnswerJournal(indexedDB, name), b = new IndexedDbAnswerJournal(indexedDB, name);
  const tabA = crypto.randomUUID(), tabB = crypto.randomUUID();
  try {
    const first = await a.beginWritingSession(scope, crypto.randomUUID(), tabA);
    const second = await b.beginWritingSession(scope, crypto.randomUUID(), tabB);
    assert.notEqual(first.requestKey, second.requestKey);
    await a.rememberWritingSession(scope, first.requestKey, lease.sessionId, 1, tabA);
    const replacement = await b.requestWritingTakeover(scope, second.requestKey, crypto.randomUUID(), tabB);
    await b.rememberWritingSession(scope, replacement.requestKey, 'e1111111-1111-4111-8111-111111111111', 2, tabB);
    assert.equal((await a.beginWritingSession(scope, crypto.randomUUID(), tabA)).requestKey, first.requestKey);
    assert.equal((await b.beginWritingSession(scope, crypto.randomUUID(), tabB)).requestKey, replacement.requestKey);
    await assert.rejects(b.rememberWritingSession(scope, second.requestKey, lease.sessionId, 1, tabB), /changed/i);
  } finally { await a.close(); await b.close(); }
});
