import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { CbtAnswerQueue, IndexedDbAnswerJournal, projectCbtJournal, type QueueTransport } from '../src/lib/cbtAnswerQueue';
import type { CbtQuestionPayload, CbtV2Snapshot } from '../src/lib/api';

const scope = { accountId: 'aabbccdd-a1b2-4c3d-8e4f-abcdef012345', attemptId: 'abcdefab-1234-4abc-8def-abcdef123456' };
const question = 'cabdecab-1234-4abc-8def-cabdec123456';
const paper = [{ id: question, position: 1, subject: 'Synthetic', text: 'Synthetic', options: ['A', 'B', 'C', 'D'] }] as CbtQuestionPayload[];

test('unknown committed response requires retry before conservative projection; retry keeps the same key', async () => {
  const journal = new IndexedDbAnswerJournal(indexedDB, `recovery-boundary-${crypto.randomUUID()}`);
  let revision = 0, answer: number | null = null, lost = true;
  const calls: string[] = [];
  const snapshot = (): CbtV2Snapshot => ({ protocol: 2, revision, answers: answer === null ? {} : { '1': answer }, status: 'in_progress', questionIds: [question] });
  const transport: QueueTransport = {
    state: async () => snapshot(),
    answer: async (_attempt, op) => {
      calls.push(op.operationKey);
      if (revision === 0) { answer = op.selected; revision = 1; }
      if (lost) { lost = false; throw new Error('response lost after commit'); }
      return { ...snapshot(), outcome: 'replayed', acceptedRevision: 1 };
    },
  };
  const queue = new CbtAnswerQueue(scope, journal, transport, async (_name, action) => action());
  try {
    const pending = await queue.enqueue(question, 1, 2, null, 0);
    await assert.rejects(queue.retry(pending.operationKey), /lost/);
    assert.equal((await queue.list())[0].status, 'pending');
    assert.throws(() => projectCbtJournal(scope, snapshot(), paper, [pending]), /review/i, 'a committed-but-unknown operation cannot be projected as a fresh local edit');
    const replayed = await queue.retry(pending.operationKey);
    assert.equal(replayed.operationKey, pending.operationKey); assert.equal(replayed.status, 'acknowledged');
    assert.deepEqual(calls, [pending.operationKey, pending.operationKey]); assert.equal(revision, 1);
    assert.deepEqual(projectCbtJournal(scope, snapshot(), paper, await queue.list()), { 1: 2 });
  } finally { await journal.close(); }
});
