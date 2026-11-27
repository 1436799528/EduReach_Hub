import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import {
  clearCbtRecoveryJournal,
  inspectCbtRecoveryJournal,
  readCbtRecoveryJournal,
  recoveryJournalKey,
  writeCbtRecoveryJournal,
  type CbtRecoveryPaper,
} from '../src/lib/cbtRecoveryJournal';

/**
 * The recovery journal is scoped to account AND attempt: work saved for one
 * account must never surface under another on the same device, a stale tab
 * cannot overwrite a newer record, and nothing is cleared before the server
 * confirmed what replaced it.
 */

const ACCOUNT = 'AABBCCDD-A1B2-4C3D-8E4F-ABCDEF012345';
const OTHER = '11111111-1111-4111-8111-111111111111';
const ATTEMPT = 'ABCDEFAB-1234-4ABC-8DEF-ABCDEF123456';

(globalThis as { indexedDB?: unknown }).indexedDB = indexedDB;

const paper: CbtRecoveryPaper = {
  attempt: {
    id: ATTEMPT.toLowerCase(),
    examId: 'exam',
    status: 'in_progress',
    startedAt: '2026-11-24T12:00:00.000Z',
    expiresAt: '2026-11-24T12:30:00.000Z',
    mode: 'practice',
    durationMinutes: 30,
    totalQuestions: 3,
    questionIndex: 0,
  },
  questions: [
    { position: 1, id: 'q1', text: 'One?', options: ['a', 'b', 'c', 'd'] },
    { position: 2, id: 'q2', text: 'Two?', options: ['a', 'b', 'c', 'd'] },
    { position: 3, id: 'q3', text: 'Three?', options: ['a', 'b', 'c', 'd'] },
  ],
};

beforeEach(async () => {
  for (const record of await inspectCbtRecoveryJournal()) {
    await clearCbtRecoveryJournal(record.accountId, record.attemptId);
  }
});

test('the journal key is account-and-attempt scoped and case-insensitive', () => {
  assert.equal(recoveryJournalKey(ACCOUNT, ATTEMPT), recoveryJournalKey(ACCOUNT.toLowerCase(), ATTEMPT.toLowerCase()));
  assert.notEqual(recoveryJournalKey(ACCOUNT, ATTEMPT), recoveryJournalKey(OTHER, ATTEMPT));
  assert.notEqual(recoveryJournalKey(ACCOUNT, ATTEMPT), recoveryJournalKey(ACCOUNT, OTHER));
});

test('the frozen paper, answers and unconfirmed work round-trip', async () => {
  const written = await writeCbtRecoveryJournal(
    { accountId: ACCOUNT, attemptId: ATTEMPT, revision: 0 },
    {
      paper,
      currentIndex: 1,
      answers: { 1: 2, 3: 1 },
      confirmedAnswers: { 1: 2 },
      pendingDraft: { answers: { 1: 2, 3: 1 }, questionIndex: 1, savedAt: 1700000000000 },
      pendingSubmission: true,
    },
  );
  assert.ok(written);
  const read = await readCbtRecoveryJournal(ACCOUNT.toLowerCase(), ATTEMPT.toUpperCase());
  assert.ok(read);
  assert.equal(read.accountId, ACCOUNT.toLowerCase());
  assert.equal(read.paper?.questions.length, 3, 'the frozen paper is restored without a network wait');
  assert.deepEqual(read.answers, { 1: 2, 3: 1 });
  assert.deepEqual(read.confirmedAnswers, { 1: 2 });
  assert.equal(read.pendingSubmission, true);
  assert.equal(read.pendingDraft?.savedAt, 1700000000000);
});

test('one account never sees another account attempt record', async () => {
  await writeCbtRecoveryJournal({ accountId: ACCOUNT, attemptId: ATTEMPT, revision: 0 }, { answers: { 1: 1 } });
  assert.equal(await readCbtRecoveryJournal(OTHER, ATTEMPT), null);
  assert.equal((await inspectCbtRecoveryJournal()).length, 1);
});

test('a stale write cannot overwrite a newer record', async () => {
  const first = await writeCbtRecoveryJournal({ accountId: ACCOUNT, attemptId: ATTEMPT, revision: 0 }, { answers: { 1: 1 } });
  assert.ok(first);
  // Another tab advanced the record; a write based on the older revision is refused.
  const second = await writeCbtRecoveryJournal({ accountId: ACCOUNT, attemptId: ATTEMPT, revision: first.revision }, { answers: { 1: 1, 2: 3 } });
  assert.ok(second);
  const refused = await writeCbtRecoveryJournal({ accountId: ACCOUNT, attemptId: ATTEMPT, revision: first.revision }, { answers: { 9: 3 } });
  assert.ok(refused, 'the refusal returns the current record');
  assert.deepEqual(refused.answers, { 1: 1, 2: 3 }, 'stale answers never overwrote the newer record');
  assert.equal(refused.revision, second.revision);
});

test('corrupt stored values read as absent work rather than crashing', async () => {
  const written = await writeCbtRecoveryJournal(
    { accountId: ACCOUNT, attemptId: ATTEMPT, revision: 0 },
    { answers: { 1: 2 }, confirmedAnswers: {}, flags: { 2: true } },
  );
  assert.ok(written);
  const read = await readCbtRecoveryJournal(ACCOUNT, ATTEMPT);
  assert.ok(read);
  // Invalid positions and out-of-range selections are dropped on write merge.
  const cleaned = await writeCbtRecoveryJournal(
    { accountId: ACCOUNT, attemptId: ATTEMPT, revision: read.revision },
    { answers: { 0: 1, x: 2, 1: 7, 2: -1, 3: 'z' } as never },
  );
  assert.ok(cleaned);
  assert.deepEqual(cleaned.answers, {}, 'invalid selections are never trusted or stored');
});

test('clearing removes the record only when the caller decides', async () => {
  await writeCbtRecoveryJournal({ accountId: ACCOUNT, attemptId: ATTEMPT, revision: 0 }, { answers: { 1: 1 } });
  await clearCbtRecoveryJournal(ACCOUNT, ATTEMPT);
  assert.equal(await readCbtRecoveryJournal(ACCOUNT, ATTEMPT), null);
});
