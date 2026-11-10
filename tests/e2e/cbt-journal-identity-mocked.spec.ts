import { expect, test } from '@playwright/test';
import { buildSync } from 'esbuild';

// Real browser IndexedDB/two pages, synthetic transport, not CBT session UI.
const bundle = buildSync({ entryPoints: ['src/lib/cbtAnswerQueue.ts'], bundle: true, platform: 'browser', format: 'iife', globalName: 'IdentityQueue', write: false }).outputFiles[0].text;
const scope = { accountId: 'a1111111-1111-4111-8111-111111111111', attemptId: 'b2222222-2222-4222-8222-222222222222' };
const question = 'c3333333-3333-4333-8333-333333333333';
const operationKey = 'd4444444-4444-4444-8444-444444444444';

test('two browser tabs share a canonical journal across casing, reopen and retry lookups', async ({ context }) => {
  await context.route('**/__cbt-identity.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle }));
  const a = await context.newPage(), b = await context.newPage();
  for (const page of [a, b]) { await page.goto('/'); await page.addScriptTag({ url: '/__cbt-identity.js' }); }
  const dbName = `identity-browser-${Date.now()}-${Math.random()}`;
  const saved = await a.evaluate(async ({ dbName, scope, question, operationKey }) => {
    // @ts-expect-error dynamically-loaded test harness
    const journal = new window.IdentityQueue.IndexedDbAnswerJournal(indexedDB, dbName);
    const row = await journal.add({ ...scope, questionId: question, operationKey, position: 1, selected: 2, baseAnswer: null, expectedRevision: 0, sequence: 0, createdAt: 1, updatedAt: 1, status: 'pending', lastServerAnswer: null, lastServerRevision: 0, acceptedRevision: null });
    await journal.close(); return row;
  }, { dbName, scope, question, operationKey });
  const upper = { accountId: scope.accountId.toUpperCase(), attemptId: scope.attemptId.toUpperCase() };
  const fromB = await b.evaluate(async ({ dbName, upper }) => {
    // @ts-expect-error dynamically-loaded test harness
    const journal = new window.IdentityQueue.IndexedDbAnswerJournal(indexedDB, dbName);
    const rows = await journal.list(upper); await journal.close(); return rows;
  }, { dbName, upper });
  expect(fromB).toEqual([saved]);
  await b.reload(); await b.addScriptTag({ url: '/__cbt-identity.js' });
  const result = await b.evaluate(async ({ dbName, upper, operationKey }) => {
    // @ts-expect-error dynamically-loaded test harness
    const { CbtAnswerQueue, IndexedDbAnswerJournal } = window.IdentityQueue;
    const journal = new IndexedDbAnswerJournal(indexedDB, dbName);
    const queue = new CbtAnswerQueue(upper, journal, { state: async () => { throw new Error('not called'); }, answer: async () => { throw new Error('offline'); } });
    let error = ''; try { await queue.retry(operationKey.toUpperCase()); } catch (e) { error = String(e); }
    const rows = await queue.list(); await journal.close(); return { error, rows };
  }, { dbName, upper, operationKey });
  expect(result.error).toContain('offline'); expect(result.rows).toEqual([saved]);
  const fromA = await a.evaluate(async ({ dbName, scope }) => {
    // @ts-expect-error dynamically-loaded test harness
    const journal = new window.IdentityQueue.IndexedDbAnswerJournal(indexedDB, dbName);
    const rows = await journal.list(scope); await journal.close(); return rows;
  }, { dbName, scope });
  expect(fromA).toEqual([saved]);
});

test('blocked old-tab upgrade fails closed and later retry preserves existing record', async ({ context }) => {
  await context.route('**/__cbt-identity.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle }));
  const a = await context.newPage(), b = await context.newPage();
  for (const page of [a, b]) { await page.goto('/'); await page.addScriptTag({ url: '/__cbt-identity.js' }); }
  const dbName = `identity-blocked-${Date.now()}-${Math.random()}`;
  await a.evaluate(async ({ dbName, scope, question, operationKey }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(dbName, 1); r.onupgradeneeded = () => { const s = r.result.createObjectStore('operations', { keyPath: 'operationKey' }); s.createIndex('scope', ['accountId', 'attemptId']); r.result.createObjectStore('metadata'); }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(['operations', 'metadata'], 'readwrite'); tx.objectStore('operations').add({ ...scope, questionId: question, operationKey, position: 1, selected: 2, baseAnswer: null, expectedRevision: 0, sequence: 1, createdAt: 1, updatedAt: 1, status: 'pending', lastServerAnswer: null, lastServerRevision: 0, acceptedRevision: null }); tx.objectStore('metadata').put(1, 'sequence'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
    // Keep an old-version connection open without a versionchange handler.
    // @ts-expect-error synthetic test harness
    window.oldDb = db;
  }, { dbName, scope, question, operationKey });
  const failure = await b.evaluate(async ({ dbName, scope }) => {
    // @ts-expect-error dynamically-loaded test harness
    const journal = new window.IdentityQueue.IndexedDbAnswerJournal(indexedDB, dbName);
    try { await journal.list(scope); return ''; } catch (e) { return String(e); }
  }, { dbName, scope });
  expect(failure).toContain('storage unavailable');
  // @ts-expect-error synthetic test harness
  await a.evaluate(() => window.oldDb.close());
  const recovered = await b.evaluate(async ({ dbName, scope }) => {
    // This open queues behind the failed upgrade, which must abort.
    const old = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(dbName, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const version = old.version; old.close();
    // @ts-expect-error dynamically-loaded test harness
    const journal = new window.IdentityQueue.IndexedDbAnswerJournal(indexedDB, dbName);
    const rows = await journal.list({ accountId: scope.accountId.toUpperCase(), attemptId: scope.attemptId.toUpperCase() }); await journal.close(); return { version, rows };
  }, { dbName, scope });
  expect(recovered.version).toBe(1); expect(recovered.rows).toHaveLength(1); expect(recovered.rows[0].operationKey).toBe(operationKey); expect(recovered.rows[0].status).toBe('pending');
});

test('different-case tabs use the same Web Lock before sending', async ({ context }) => {
  await context.route('**/__cbt-identity.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle }));
  const a = await context.newPage(), b = await context.newPage();
  for (const page of [a, b]) { await page.goto('/'); await page.addScriptTag({ url: '/__cbt-identity.js' }); }
  const dbName = `identity-lock-${Date.now()}-${Math.random()}`;
  const lockName = `edureach-cbt:${scope.accountId}:${scope.attemptId}`;
  await a.evaluate(async ({ dbName, scope, question, operationKey, lockName }) => {
    // @ts-expect-error dynamically-loaded test harness
    const journal = new window.IdentityQueue.IndexedDbAnswerJournal(indexedDB, dbName);
    await journal.add({ ...scope, questionId: question, operationKey, position: 1, selected: 2, baseAnswer: null, expectedRevision: 0, sequence: 0, createdAt: 1, updatedAt: 1, status: 'pending', lastServerAnswer: null, lastServerRevision: 0, acceptedRevision: null }); await journal.close();
    let ready!: () => void; const acquired = new Promise<void>(resolve => { ready = resolve; });
    const hold = new Promise<void>(resolve => {
      // @ts-expect-error synthetic test harness
      window.releaseCbtLock = resolve;
    });
    void navigator.locks.request(lockName, async () => { ready(); await hold; }); await acquired;
  }, { dbName, scope, question, operationKey, lockName });
  await b.evaluate(({ dbName, scope, operationKey }) => {
    // @ts-expect-error dynamically-loaded test harness
    const { CbtAnswerQueue, IndexedDbAnswerJournal } = window.IdentityQueue;
    const journal = new IndexedDbAnswerJournal(indexedDB, dbName);
    const queue = new CbtAnswerQueue({ accountId: scope.accountId.toUpperCase(), attemptId: scope.attemptId.toUpperCase() }, journal, {
      state: async () => { throw new Error('not called'); },
      answer: async () => {
        // @ts-expect-error synthetic test harness
        window.sentCbtOperation = true;
        return { protocol: 2, outcome: 'accepted', revision: 1, acceptedRevision: 1, answers: { '1': 2 }, status: 'in_progress' };
      },
    });
    // @ts-expect-error synthetic test harness
    window.cbtRetry = queue.retry(operationKey.toUpperCase()).then(async (result: unknown) => { await journal.close(); return result; });
  }, { dbName, scope, operationKey });
  await expect.poll(async () => b.evaluate(async name => (await navigator.locks.query()).pending?.some(lock => lock.name === name), lockName)).toBe(true);
  // @ts-expect-error synthetic test harness
  expect(await b.evaluate(() => window.sentCbtOperation)).toBeUndefined();
  // @ts-expect-error synthetic test harness
  await a.evaluate(() => window.releaseCbtLock());
  // @ts-expect-error synthetic test harness
  const completed = await b.evaluate(() => window.cbtRetry);
  expect(completed.status).toBe('acknowledged'); expect(completed.operationKey).toBe(operationKey);
});
