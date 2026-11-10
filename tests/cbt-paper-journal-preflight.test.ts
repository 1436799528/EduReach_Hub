import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCbtJournalPaper, type AnswerOperation } from '../src/lib/cbtAnswerQueue';
import type { CbtV2Snapshot, CbtQuestionPayload } from '../src/lib/api';

const q1 = 'a1111111-1111-4111-8111-111111111111';
const q2 = 'b2222222-2222-4222-8222-222222222222';
const paper = [q1, q2].map((id, i) => ({ id, position: i + 1, subject: 'Test', text: 'Synthetic', options: ['A', 'B', 'C', 'D'] })) as CbtQuestionPayload[];
const state: CbtV2Snapshot = { protocol: 2, revision: 1, answers: { '1': 0 }, status: 'in_progress', questionIds: [q1, q2] };
const op: AnswerOperation = { accountId: '11111111-1111-4111-8111-111111111111', attemptId: '22222222-2222-4222-8222-222222222222', questionId: q2, position: 2, selected: 1, baseAnswer: null, expectedRevision: 1, operationKey: '33333333-3333-4333-8333-333333333333', sequence: 1, createdAt: 1, updatedAt: 1, status: 'pending', lastServerAnswer: null, lastServerRevision: 1, acceptedRevision: null };

test('preflight permits only the authoritative frozen paper and matching journal positions', () => {
  assert.doesNotThrow(() => validateCbtJournalPaper(state, paper, [op]));
  assert.throws(() => validateCbtJournalPaper(state, [...paper].reverse(), [op]), /paper.*review/i);
  assert.throws(() => validateCbtJournalPaper(state, paper.slice(0, 1), [op]), /paper.*review/i);
  assert.throws(() => validateCbtJournalPaper({ ...state, status: 'submitted' }, paper, [op]), /paper.*review/i);
  assert.throws(() => validateCbtJournalPaper(state, paper, [{ ...op, questionId: q1 }]), /journal.*review/i);
  assert.throws(() => validateCbtJournalPaper(state, paper, [{ ...op, position: 3 }]), /journal.*review/i);
  assert.throws(() => validateCbtJournalPaper(state, [{ ...paper[0], options: ['A', 'B'] }, paper[1]], [{ ...op, position: 1, questionId: q1, selected: 3 }]), /journal.*review/i);
});

test('preflight rejects non-renderable paper content instead of projecting malformed values', () => {
  for (const malformed of [
    [{ ...paper[0], text: null }, paper[1]],
    [{ ...paper[0], text: '   ' }, paper[1]],
    [{ ...paper[0], text: { unexpected: true } }, paper[1]],
    [{ ...paper[0], subject: null }, paper[1]],
    [{ ...paper[0], options: ['A', { unexpected: true }, 'C', 'D'] }, paper[1]],
    [{ ...paper[0], options: ['A', null, 'C', 'D'] }, paper[1]],
    [{ ...paper[0], options: [] }, paper[1]],
    [{ ...paper[0], options: ['A', '', 'C', 'D'] }, paper[1]],
    [{ ...paper[0], options: ['A', '   ', 'C', 'D'] }, paper[1]],
  ]) assert.throws(() => validateCbtJournalPaper(state, malformed as never, []), /paper.*review/i);
});
