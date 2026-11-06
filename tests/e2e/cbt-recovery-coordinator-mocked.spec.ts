import { expect, test, type Page } from '@playwright/test';
import { buildSync } from 'esbuild';

// Standalone library harness, NOT the real CBT session or a real backend.
const bundle = buildSync({ entryPoints: ['src/lib/cbtAnswerQueue.ts'], bundle: true, platform: 'browser', format: 'iife', globalName: 'RecoveryQueue', write: false }).outputFiles[0].text;
const scope = { accountId: 'a1111111-1111-4111-8111-111111111111', attemptId: 'b2222222-2222-4222-8222-222222222222' };
const question = 'c3333333-3333-4333-8333-333333333333';
const operationKey = 'd4444444-4444-4444-8444-444444444444';

async function load(page: Page) { await page.goto('/'); await page.addScriptTag({ url: '/__cbt-recovery.js' }); }
async function seed(page: Page, dbName: string) {
  await page.evaluate(async ({ dbName, scope, question, operationKey }) => {
    // @ts-expect-error synthetic browser harness
    const journal = new window.RecoveryQueue.IndexedDbAnswerJournal(indexedDB, dbName);
    await journal.add({ ...scope, questionId: question, operationKey, position: 1, selected: 2, baseAnswer: null, expectedRevision: 0, sequence: 0, createdAt: 1, updatedAt: 1, status: 'pending', lastServerAnswer: null, lastServerRevision: 0, acceptedRevision: null }); await journal.close();
  }, { dbName, scope, question, operationKey });
}
async function recover(page: Page, dbName: string) {
  return page.evaluate(async ({ dbName, scope, question }) => {
    // @ts-expect-error synthetic browser harness
    const { IndexedDbAnswerJournal, recoverCbtJournal } = window.RecoveryQueue;
    const journal = new IndexedDbAnswerJournal(indexedDB, dbName);
    const transport = { state: async () => (await fetch('/__cbt-recovery/state')).json(), answer: async (_: string, body: unknown) => (await fetch('/__cbt-recovery/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json() };
    try { return await recoverCbtJournal({ scope, journal, transport, assertCurrent: () => {}, paper: [{ id: question, position: 1, subject: 'Synthetic', text: 'Synthetic', options: ['A', 'B', 'C'] }] }); }
    finally { await journal.close(); }
  }, { dbName, scope, question });
}

test('two browser tabs recover one lost response using native Web Locks and IndexedDB', async ({ context }) => {
  await context.route('**/__cbt-recovery.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle }));
  let revision = 1, sends = 0; const requests: unknown[] = [];
  const snapshot = () => ({ protocol: 2, revision, answers: { '1': 2 }, status: 'in_progress', questionIds: [question] });
  await context.route('**/__cbt-recovery/**', route => {
    if (route.request().url().endsWith('/state')) return route.fulfill({ json: snapshot() });
    sends++; requests.push(route.request().postDataJSON()); return route.fulfill({ json: { ...snapshot(), outcome: 'replayed', acceptedRevision: 1 } });
  });
  const a = await context.newPage(), b = await context.newPage(); await Promise.all([load(a), load(b)]);
  const dbName = `recover-two-${crypto.randomUUID()}`; await seed(a, dbName);
  const results = await Promise.all([recover(a, dbName), recover(b, dbName)]);
  expect(sends).toBe(1); expect(requests).toEqual([{ expectedRevision: 0, operationKey, questionId: question, selected: 2 }]);
  for (const result of results) { expect(result.operations[0].status).toBe('acknowledged'); expect(result.answers).toEqual({ '1': 2 }); }
  expect(revision).toBe(1);
});

test('closing browser page after synthetic commit but before response leaves same-key replay', async ({ context }) => {
  await context.route('**/__cbt-recovery.js', route => route.fulfill({ contentType: 'text/javascript', body: bundle }));
  let revision = 0, calls = 0; let committed!: () => void; const ready = new Promise<void>(resolve => { committed = resolve; });
  let release!: () => void; const hold = new Promise<void>(resolve => { release = resolve; });
  const snapshot = () => ({ protocol: 2, revision, answers: revision ? { '1': 2 } : {}, status: 'in_progress', questionIds: [question] });
  await context.route('**/__cbt-recovery/**', async route => {
    if (route.request().url().endsWith('/state')) return route.fulfill({ json: snapshot() });
    expect(route.request().postDataJSON().operationKey).toBe(operationKey); calls++;
    if (calls === 1) { revision = 1; committed(); await hold; await route.abort().catch(() => {}); return; }
    return route.fulfill({ json: { ...snapshot(), outcome: 'replayed', acceptedRevision: 1 } });
  });
  const a = await context.newPage(); await load(a); const dbName = `recover-close-${crypto.randomUUID()}`; await seed(a, dbName);
  const interrupted = recover(a, dbName).catch(() => null); await ready; await a.close(); release(); await interrupted;
  const b = await context.newPage(); await load(b); const result = await recover(b, dbName);
  expect(calls).toBe(2); expect(revision).toBe(1); expect(result.operations[0].status).toBe('acknowledged'); expect(result.answers).toEqual({ '1': 2 });
});
