import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { CbtAnswerQueue, IndexedDbAnswerJournal, type AnswerOperation, type QueueTransport } from '../src/lib/cbtAnswerQueue';

const accountId = 'aabbccdd-a1b2-4c3d-8e4f-abcdef012345';
const attemptId = 'abcdefab-1234-4abc-8def-abcdef123456';
const questionId = 'cabdecab-1234-4abc-8def-cabdec123456';
const operationKey = 'deadbeef-1234-4abc-8def-deadbeef1234';
const mixedCase = (id: string) => id.replace(/[a-f]/g, (letter, index) => index % 2 ? letter.toUpperCase() : letter);
const scope = { accountId, attemptId };
const upper = { accountId: accountId.toUpperCase(), attemptId: attemptId.toUpperCase() };
const mixed = { accountId: mixedCase(accountId), attemptId: mixedCase(attemptId) };
const row: AnswerOperation = { ...scope, questionId, operationKey, position: 1, selected: 2, baseAnswer: null, expectedRevision: 3, sequence: 7, createdAt: 11, updatedAt: 12, status: 'pending', lastServerAnswer: 1, lastServerRevision: 3, acceptedRevision: null };
const transport: QueueTransport = { state: async () => ({ protocol: 2, revision: 4, answers: { '1': 2 }, status: 'in_progress', questionIds: [questionId] }), answer: async () => ({ protocol: 2, outcome: 'replayed', revision: 4, acceptedRevision: 4, answers: { '1': 2 }, status: 'in_progress' }) };
async function seedV1(name: string, rows: AnswerOperation[]) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => { const store = req.result.createObjectStore('operations', { keyPath: 'operationKey' }); store.createIndex('scope', ['accountId', 'attemptId']); req.result.createObjectStore('metadata'); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => { const tx = db.transaction(['operations', 'metadata'], 'readwrite'); rows.forEach(r => tx.objectStore('operations').add(r)); tx.objectStore('metadata').put(Math.max(0, ...rows.map(r => r.sequence)), 'sequence'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
}
const name = () => `identity-${crypto.randomUUID()}`;

test('legacy lowercase rows recover after reopen using uppercase and mixed scope; IDs canonicalize', async () => {
  const db = name(); await seedV1(db, [row]);
  const journal = new IndexedDbAnswerJournal(indexedDB, db);
  try { assert.deepEqual(await journal.list(upper), [row]); assert.deepEqual(await journal.list(mixed), [row]); }
  finally { await journal.close(); }
  const reopened = new IndexedDbAnswerJournal(indexedDB, db);
  try { assert.deepEqual(await reopened.list(upper), [row]); } finally { await reopened.close(); }
});

test('legacy uppercase fields recover in lowercase preserving operation data and state', async () => {
  const db = name(); const old = { ...row, ...upper, questionId: questionId.toUpperCase(), operationKey: operationKey.toUpperCase(), status: 'conflicted' as const };
  const acknowledged = { ...old, operationKey: 'e5555555-5555-4555-8555-555555555555'.toUpperCase(), sequence: 8, status: 'acknowledged' as const, acceptedRevision: 4 };
  await seedV1(db, [old, acknowledged]); const journal = new IndexedDbAnswerJournal(indexedDB, db);
  try { assert.deepEqual(await journal.list(scope), [{ ...row, status: 'conflicted' }, { ...row, operationKey: acknowledged.operationKey.toLowerCase(), sequence: 8, status: 'acknowledged', acceptedRevision: 4 }]); }
  finally { await journal.close(); }
});

test('same operation UUID casing is not duplicated; distinct operation UUIDs stay distinct', async () => {
  const db = name(); await seedV1(db, [row, { ...row, ...upper, questionId: questionId.toUpperCase(), operationKey: operationKey.toUpperCase() }, { ...row, operationKey: 'e5555555-5555-4555-8555-555555555555', sequence: 8 }]);
  const journal = new IndexedDbAnswerJournal(indexedDB, db);
  try {
    const rows = await journal.list(upper); assert.equal(rows.length, 2); assert.equal(rows[0].operationKey, operationKey); assert.equal(rows[1].sequence, 8);
    await assert.rejects(journal.add({ ...row, ...upper, questionId: questionId.toUpperCase(), operationKey: operationKey.toUpperCase(), sequence: 0 }));
    assert.equal((await journal.list(scope)).length, 2);
  } finally { await journal.close(); }
});

test('different payloads with the same operation UUID abort local upgrade without losing either old row', async () => {
  const dbName = name(); await seedV1(dbName, [row, { ...row, operationKey: operationKey.toUpperCase(), selected: 3 }]);
  const journal = new IndexedDbAnswerJournal(indexedDB, dbName);
  await assert.rejects(journal.list(scope));
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open(dbName, 1); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  const rows = await new Promise<AnswerOperation[]>((resolve, reject) => { const req = db.transaction('operations').objectStore('operations').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  assert.equal(db.version, 1); assert.equal(rows.length, 2); assert.deepEqual(rows.map(x => x.selected).sort(), [2, 3]); db.close();
});

test('recovered mixed-case operation is retried under canonical key and lock identity', async () => {
  const db = name(); await seedV1(db, [{ ...row, ...upper, operationKey: operationKey.toUpperCase(), questionId: questionId.toUpperCase() }]);
  const journal = new IndexedDbAnswerJournal(indexedDB, db); let lockName = ''; let sent: unknown;
  const queue = new CbtAnswerQueue(upper, journal, { ...transport, answer: async (attempt, body) => { sent = { attempt, body }; return transport.answer(attempt, body); } }, async (name, action) => { lockName = name; return action(); });
  try {
    assert.equal((await queue.retry(mixedCase(operationKey))).status, 'acknowledged');
    assert.equal(lockName, `edureach-cbt:${accountId}:${attemptId}`);
    assert.deepEqual(sent, { attempt: attemptId, body: { expectedRevision: 3, operationKey, questionId, selected: 2 } });
    assert.equal((await journal.list(scope))[0].status, 'acknowledged');
  } finally { await journal.close(); }
});

test('new uppercase input is stored once under canonical keys and reopens from any scope casing', async () => {
  const db = name(); const j = new IndexedDbAnswerJournal(indexedDB, db);
  const saved = await j.add({ ...row, ...upper, questionId: mixedCase(questionId), operationKey: operationKey.toUpperCase(), sequence: 0 });
  assert.equal(saved.operationKey, operationKey); assert.equal(saved.questionId, questionId); assert.equal(saved.accountId, accountId); assert.equal(saved.attemptId, attemptId);
  await j.close(); const reopened = new IndexedDbAnswerJournal(indexedDB, db);
  try { assert.deepEqual(await reopened.list(scope), [saved]); assert.deepEqual(await reopened.list(mixed), [saved]); assert.deepEqual(await reopened.list(upper), [saved]); }
  finally { await reopened.close(); }
});

test('blocked version upgrade fails closed and does not run later after the old connection closes', async () => {
  const dbName = name(); await seedV1(dbName, [row]);
  const old = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(dbName, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const journal = new IndexedDbAnswerJournal(indexedDB, dbName);
  await assert.rejects(journal.list(scope), /storage unavailable/i);
  old.close();
  // The failed open's queued upgrade must abort before a later v1 open succeeds.
  const check = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(dbName, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  assert.equal(check.version, 1); check.close();
  const reopened = new IndexedDbAnswerJournal(indexedDB, dbName);
  try { assert.deepEqual(await reopened.list(upper), [row]); } finally { await reopened.close(); }
});

test('sequence collision and stale counter abort the upgrade without changing v1 rows', async () => {
  for (const corruptCounter of [false, true]) {
    const dbName = name(); const second = { ...row, operationKey: 'e5555555-5555-4555-8555-555555555555', sequence: corruptCounter ? 8 : 7 };
    await seedV1(dbName, [row, second]);
    if (corruptCounter) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(dbName, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      await new Promise<void>((resolve, reject) => { const tx = db.transaction('metadata', 'readwrite'); tx.objectStore('metadata').put(1, 'sequence'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
    }
    const journal = new IndexedDbAnswerJournal(indexedDB, dbName); await assert.rejects(journal.list(scope));
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(dbName, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const rows = await new Promise<AnswerOperation[]>((resolve, reject) => { const r = db.transaction('operations').objectStore('operations').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    assert.equal(db.version, 1); assert.equal(rows.length, 2); db.close();
  }
});
