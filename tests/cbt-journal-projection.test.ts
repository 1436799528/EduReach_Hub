import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectCbtJournal, type AnswerOperation } from '../src/lib/cbtAnswerQueue';
import type { CbtQuestionPayload, CbtV2Snapshot } from '../src/lib/api';

const scope = { accountId: 'aabbccdd-a1b2-4c3d-8e4f-abcdef012345', attemptId: 'abcdefab-1234-4abc-8def-abcdef123456' };
const ids = ['cabdecab-1234-4abc-8def-cabdec123456', 'eeaaeeaa-1234-4abc-8def-eeaaeeaa1234'];
const paper = ids.map((id, i) => ({ id, position: i + 1, subject: 'Synthetic', text: 'Synthetic', options: ['A', 'B', 'C', 'D'] })) as CbtQuestionPayload[];
const state: CbtV2Snapshot = { protocol: 2, revision: 3, status: 'in_progress', questionIds: ids, answers: { '1': 0 } };
const op: AnswerOperation = { ...scope, questionId: ids[0], position: 1, selected: 2, baseAnswer: 0, expectedRevision: 3, operationKey: 'deadbeef-1234-4abc-8def-deadbeef1234', sequence: 1, createdAt: 10, updatedAt: 10, status: 'pending', lastServerAnswer: 0, lastServerRevision: 3, acceptedRevision: null };
const secondKey = 'faafbaaf-1234-4abc-8def-faafbaaf1234';

test('authoritative answers plus ordered current-base pending operations form a read-only projection', () => {
  const second = { ...op, questionId: ids[1].toUpperCase(), position: 2, selected: 3, baseAnswer: null, lastServerAnswer: null, operationKey: secondKey, sequence: 2 };
  const latest = { ...op, selected: 1, operationKey: 'baacbaac-1234-4abc-8def-baacbaac1234', sequence: 3 };
  const result = projectCbtJournal({ accountId: scope.accountId.toUpperCase(), attemptId: scope.attemptId.toUpperCase() }, state, paper, [op, second, latest]);
  assert.deepEqual(result, { 1: 1, 2: 3 }); assert.deepEqual(state.answers, { '1': 0 });
  assert.deepEqual(projectCbtJournal(scope, state, paper, [{ ...op, selected: null }]), {});
});

test('acknowledged rows never overwrite a newer authoritative server answer', () => {
  const acknowledged = { ...op, selected: 1, expectedRevision: 0, lastServerRevision: 1, lastServerAnswer: 1, acceptedRevision: 1, status: 'acknowledged' as const };
  assert.deepEqual(projectCbtJournal(scope, state, paper, [acknowledged]), { 1: 0 });
  assert.throws(() => projectCbtJournal(scope, { ...state, revision: 1 }, paper, [acknowledged]), /review/i);
  assert.deepEqual(projectCbtJournal(scope, { ...state, revision: 1, answers: { '1': 1 } }, paper, [acknowledged]), { 1: 1 });
});

test('ambiguity, duplicate keys or sequence, scope mismatch, conflicts, bad paper and invalid option all fail closed', () => {
  const invalid: AnswerOperation[][] = [
    [{ ...op, expectedRevision: 2, lastServerRevision: 2 }],
    [{ ...op, baseAnswer: 1, lastServerAnswer: 1 }],
    [{ ...op, status: 'conflicted' }], [{ ...op, status: 'closed' }],
    [{ ...op, acceptedRevision: 4 }], [{ ...op, accountId: 'f1111111-1111-4111-8111-111111111111' }],
    [{ ...op, questionId: ids[1] }], [{ ...op, selected: 4 }],
    [op, { ...op, operationKey: op.operationKey.toUpperCase(), sequence: 2 }],
    [op, { ...op, operationKey: secondKey }],
    [{ ...op, status: 'acknowledged', acceptedRevision: 4, lastServerRevision: 4 }],
  ];
  for (const rows of invalid) assert.throws(() => projectCbtJournal(scope, state, paper, rows), JSON.stringify(rows));
  assert.throws(() => projectCbtJournal(scope, state, [{ ...paper[0], options: ['A'] }, paper[1]], [op]));
  assert.deepEqual(state.answers, { '1': 0 });
});
