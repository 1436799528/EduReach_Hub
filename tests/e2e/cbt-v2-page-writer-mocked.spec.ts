import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Real student page and IndexedDB; Auth and the lease/answer server are synthetic.
const account = '11111111-1111-4111-8111-111111111111';
const attempt = '22222222-2222-4222-8222-222222222222';
const question = '33333333-3333-4333-8333-333333333333';

type Write = { expectedRevision: number; operationKey: string; questionId: string; selected: number | null; sessionId: string; sessionGeneration: number };
async function setup(context: BrowserContext) {
  let revision = 0, answers: Record<string, number> = {}, active: { id: string; generation: number } | null = null;
  const sessions = new Map<string, { id: string; generation: number }>();
  const ledger = new Map<string, { body: Write; acceptedRevision: number; outcome: 'accepted' | 'conflict' }>();
  const writes: Write[] = [], sessionsSent: unknown[] = [], legacy: string[] = [];
  let failWrites = false, loseFirstResponse = false, loseSession = false, advanceOnSession = false, staleNextState = false, held: (() => void) | null = null, holdWrite = false, rejected = 0;
  const state = () => ({ protocol: 2 as const, revision, answers: { ...answers }, status: 'in_progress', questionIds: [question] });
  const attach = async (context: BrowserContext) => {
    await context.addInitScript(id => {
      localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({ access_token: 'synthetic-test-token', refresh_token: 'synthetic-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} } }));
      localStorage.setItem('edureach-privacy-preferences-v1', JSON.stringify({ necessary: true, analytics: false, version: 1 }));
    }, account);
    await context.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
    await context.route('**/api/cbt/**', async route => {
      const req = route.request(), url = req.url();
      if (url.endsWith('/paper')) return route.fulfill({ json: { protocol: { version: 2, scope: 'local-rehearsal' }, serverTime: new Date().toISOString(),
        attempt: { id: attempt, examId: 'synthetic', status: 'in_progress', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), mode: 'practice', durationMinutes: 60, programme: null, subjects: ['Test'], plan: [], totalQuestions: 1, questionIndex: 0, savedAnswers: {}, exam: { id: 'synthetic', title: 'Test', examBody: 'test', subject: 'Test' } },
        questions: [{ position: 1, subject: 'Test', id: question, text: 'Test question', options: ['Alpha', 'Bravo', 'Charlie', 'Delta'] }] } });
      if (url.endsWith('/state')) {
        if (staleNextState) { staleNextState = false; return route.fulfill({ json: { ...state(), revision: 0, answers: {} } }); }
        return route.fulfill({ json: state() });
      }
      if (url.endsWith('/session')) {
        const body = req.postDataJSON() as { requestKey: string; takeover: boolean };
        sessionsSent.push(body);
        const prior = sessions.get(body.requestKey);
        if (prior) return route.fulfill({ json: { ...state(), outcome: active?.id === prior.id ? 'resumed' : 'revoked', sessionId: prior.id, generation: prior.generation } });
        if (active && !body.takeover) return route.fulfill({ status: 409, json: { ...state(), outcome: 'takeover_required' } });
        const next = { id: crypto.randomUUID(), generation: (active?.generation || 0) + 1 };
        const outcome = active ? 'taken_over' : 'created'; active = next; sessions.set(body.requestKey, next);
        if (advanceOnSession) { answers = { '1': 1 }; revision++; staleNextState = true; advanceOnSession = false; }
        if (loseSession) { loseSession = false; return route.fulfill({ status: 503, json: { error: 'response lost' } }); }
        return route.fulfill({ json: { ...state(), outcome, sessionId: next.id, generation: next.generation } });
      }
      if (url.endsWith('/answer')) {
        const body = req.postDataJSON() as Write; writes.push(body);
        if (holdWrite) { holdWrite = false; await new Promise<void>(resolve => { held = resolve; }); }
        if (body.sessionId !== active?.id || body.sessionGeneration !== active?.generation) { rejected++; return route.fulfill({ status: 409, json: { protocol: 2, outcome: 'session_revoked', code: 'CBT_SESSION_REVOKED' } }); }
        if (failWrites) return route.fulfill({ status: 503, json: { error: 'offline' } });
        let old = ledger.get(body.operationKey);
        if (old && JSON.stringify(old.body) !== JSON.stringify(body)) throw new Error('Operation changed during retry');
        let outcome: 'accepted' | 'replayed' | 'conflict';
        if (old) outcome = old.outcome === 'accepted' ? 'replayed' : 'conflict';
        else if (body.expectedRevision !== revision) { outcome = 'conflict'; old = { body, outcome, acceptedRevision: revision }; ledger.set(body.operationKey, old); }
        else {
          if (body.selected === null) delete answers['1']; else answers['1'] = body.selected;
          revision++; outcome = 'accepted'; old = { body, outcome, acceptedRevision: revision }; ledger.set(body.operationKey, old);
        }
        if (loseFirstResponse) { loseFirstResponse = false; return route.fulfill({ status: 503, json: { error: 'response lost' } }); }
        return route.fulfill({ status: outcome === 'conflict' ? 409 : 200, json: { ...state(), outcome, ...(outcome === 'conflict' ? {} : { acceptedRevision: old.acceptedRevision }) } });
      }
      if (req.method() !== 'GET') legacy.push(url);
      return route.fulfill({ status: 503, json: { error: 'Unexpected request' } });
    });
  };
  await attach(context);
  return { attach, writes, sessionsSent, legacy, getState: state, getRejected: () => rejected, changeServer: (value: number) => { answers = { '1': value }; revision++; }, fail: (value: boolean) => { failWrites = value; }, lose: () => { loseFirstResponse = true; }, loseSession: () => { loseSession = true; }, regressAfterSession: () => { advanceOnSession = true; }, hold: () => { holdWrite = true; }, release: () => { if (!held) throw new Error('No held request'); held(); }, hasHeld: () => Boolean(held) };
}
async function open(page: Page) { await page.goto(`/cbt/session/${attempt}`); await expect(page.getByRole('heading', { name: 'Test question' })).toBeVisible(); }
async function active(page: Page) { await expect(page.getByText('Writing session confirmed by the server.')).toBeVisible(); }
async function takeOver(page: Page) { page.once('dialog', dialog => void dialog.accept()); await page.getByRole('button', { name: 'Take over writing' }).click(); await active(page); }

test('real page saves via durable leased operation, refreshes, and keeps finalization closed', async ({ context, page }) => {
  const server = await setup(context); await open(page); await active(page);
  await expect(page.getByRole('button', { name: 'Submit Examination' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Bravo' }).click();
  await expect.poll(() => server.writes.length).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: /^saved$/ })).toBeVisible();
  expect(server.writes[0]).toMatchObject({ questionId: question, selected: 1, expectedRevision: 0, sessionGeneration: 1 });
  await page.reload(); await active(page); await expect(page.getByRole('radio', { name: 'Bravo' })).toHaveAttribute('aria-checked', 'true');
  expect(server.sessionsSent).toHaveLength(2); expect(server.legacy).toEqual([]);
});

test('uncertain network result retries the same persisted operation and lease', async ({ context, page }) => {
  const server = await setup(context); server.lose(); await open(page); await active(page);
  await page.getByRole('radio', { name: 'Alpha' }).click();
  await expect.poll(() => server.writes.length).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('status').filter({ hasText: /^saved$/ })).toBeVisible();
  expect(server.writes[1]).toEqual(server.writes[0]); expect(server.getState().revision).toBe(1);
});

test('second tab explicitly takes over; first tab stops and cannot write', async ({ context, page }) => {
  const server = await setup(context); await open(page); await active(page);
  await page.getByRole('radio', { name: 'Alpha' }).click(); await expect.poll(() => server.getState().revision).toBe(1);
  const b = await context.newPage(); await open(b); await expect(b.getByText('Writing is paused.')).toBeVisible();
  await takeOver(b); await expect(page.getByText('Writing is paused.')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Bravo' })).toBeDisabled();
  await b.getByRole('radio', { name: 'Bravo' }).click(); await expect.poll(() => server.getState().revision).toBe(2);
  expect(server.writes.map(row => row.sessionGeneration)).toEqual([1, 2]);
  await page.reload(); await expect(page.getByText('Writing is paused.')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Charlie' })).toBeDisabled();
});

test('takeover during an in-flight write preserves the old intent for explicit review', async ({ context, page }) => {
  const server = await setup(context); await open(page); await active(page); server.hold();
  await page.getByRole('radio', { name: 'Charlie' }).click(); await expect.poll(server.hasHeld).toBe(true);
  const b = await context.newPage(); await open(b); await takeOver(b); server.release();
  await expect(page.getByText('Writing is paused.')).toBeVisible();
  await expect.poll(server.getRejected).toBe(1); expect(server.writes).toHaveLength(1); expect(server.writes[0].sessionGeneration).toBe(1);
  expect(server.getState().revision).toBe(0);
  await expect.poll(() => b.evaluate(async key => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open('edureach-cbt-v2-operations'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const row = await new Promise<{ status: string }>((resolve, reject) => { const req = db.transaction('operations').objectStore('operations').get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); db.close(); return row.status;
  }, server.writes[0].operationKey)).toBe('conflicted');
  await expect(b.getByText(/local answer Charlie/)).toBeVisible();
  await b.getByRole('button', { name: 'Review this pending answer' }).click();
  await expect(b.getByText(/server answer No answer/)).toBeVisible();
  await b.getByRole('button', { name: 'Apply my local answer' }).click();
  await expect.poll(() => server.getState().revision).toBe(1);
  expect(server.writes).toHaveLength(2); expect(server.writes[1].sessionGeneration).toBe(2);
  expect(server.writes[1].operationKey).not.toBe(server.writes[0].operationKey);
});

test('restart with pending old-session work requires takeover and explicit review', async ({ context, page }) => {
  const server = await setup(context); server.fail(true); await open(page); await active(page);
  await page.getByRole('radio', { name: 'Delta' }).click(); await expect(page.getByText(/local answer Delta/)).toBeVisible();
  await expect.poll(() => server.writes.length).toBeGreaterThan(0);
  const key = server.writes[0].operationKey; await page.close(); server.fail(false);
  const reopened = await context.newPage(); await open(reopened); await expect(reopened.getByText('Writing is paused.')).toBeVisible();
  await takeOver(reopened); await expect(reopened.getByText(/local answer Delta/)).toBeVisible();
  expect(server.writes.every(row => row.operationKey === key && row.sessionGeneration === 1)).toBe(true);
  await reopened.getByRole('button', { name: 'Review this pending answer' }).click();
  await reopened.getByRole('button', { name: 'Keep server answer' }).click();
  await expect(reopened.getByRole('radio', { name: 'Delta' })).toBeEnabled();
  expect(server.getState().revision).toBe(0);
});

test('newer server revision is never overwritten without an explicit conflict decision', async ({ context, page }) => {
  const server = await setup(context); await open(page); await active(page);
  server.changeServer(1);
  await page.getByRole('radio', { name: 'Alpha' }).click();
  await expect(page.getByText(/server answer Bravo/)).toBeVisible();
  expect(server.getState().answers).toEqual({ '1': 1 }); expect(server.writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Apply my local answer' }).click();
  await expect.poll(() => server.getState().revision).toBe(2);
  expect(server.getState().answers).toEqual({ '1': 0 });
  expect(server.writes[1].operationKey).not.toBe(server.writes[0].operationKey);
  expect(server.writes[1].expectedRevision).toBe(1);
});

test('journal entry with the original lease is committed before a held answer request', async ({ context, page }) => {
  const server = await setup(context); await open(page); await active(page); server.hold();
  await page.getByRole('radio', { name: 'Alpha' }).click(); await expect.poll(server.hasHeld).toBe(true);
  const rows = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open('edureach-cbt-v2-operations'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const result = await new Promise<Write[]>((resolve, reject) => { const req = db.transaction('operations').objectStore('operations').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    db.close(); return result;
  });
  expect(rows).toHaveLength(1);
  const sent = server.writes[0];
  expect(rows[0]).toMatchObject({ operationKey: sent.operationKey, questionId: sent.questionId, selected: sent.selected, expectedRevision: sent.expectedRevision, sessionId: sent.sessionId, sessionGeneration: sent.sessionGeneration, status: 'pending' });
  server.release(); await expect(page.getByRole('status').filter({ hasText: /^saved$/ })).toBeVisible();
});

test('a duplicated tab identity cannot silently share the first tab lease', async ({ context, page }) => {
  const server = await setup(context); await open(page); await active(page);
  const copied = await page.evaluate(() => Object.entries(sessionStorage));
  const b = await context.newPage();
  await b.addInitScript(entries => entries.forEach(([key, value]) => sessionStorage.setItem(key, value)), copied);
  await open(b); await expect(b.getByText('Writing is paused.')).toBeVisible();
  expect(server.sessionsSent).toHaveLength(2);
  await expect(b.getByRole('radio', { name: 'Alpha' })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Alpha' })).toBeEnabled();
});

test('lost session acquisition response is retried with the durable request key', async ({ context, page }) => {
  const server = await setup(context); server.loseSession(); await open(page);
  await expect(page.getByText('Writing is paused.')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Alpha' })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry connection' }).click(); await active(page);
  expect(server.sessionsSent).toHaveLength(2); expect(server.sessionsSent[1]).toEqual(server.sessionsSent[0]);
  await page.getByRole('radio', { name: 'Alpha' }).click(); await expect.poll(() => server.getState().revision).toBe(1);
});

test('offline answer retries are bounded and retain the same operation and lease', async ({ context, page }) => {
  const server = await setup(context); server.fail(true); await open(page); await active(page);
  await page.getByRole('radio', { name: 'Alpha' }).click();
  await expect.poll(() => server.writes.length, { timeout: 15000 }).toBe(4);
  await page.waitForTimeout(1500);
  expect(server.writes).toHaveLength(4);
  expect(server.writes.every(write => JSON.stringify(write) === JSON.stringify(server.writes[0]))).toBe(true);
  await expect(page.getByText(/local answer Alpha/)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Bravo' })).toBeDisabled();
});

test('pending IndexedDB intent survives a full Chromium process restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cbt-page-restart-'));
  const options = { baseURL: 'http://127.0.0.1:3100', headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] };
  let first: BrowserContext | undefined, second: BrowserContext | undefined;
  try {
    first = await chromium.launchPersistentContext(directory, options);
    const server = await setup(first); server.fail(true);
    const page = first.pages()[0] || await first.newPage(); await open(page); await active(page);
    await page.getByRole('radio', { name: 'Delta' }).click();
    await expect.poll(() => server.writes.length).toBeGreaterThan(0);
    const original = server.writes[0]; await first.close(); first = undefined;
    server.fail(false);
    second = await chromium.launchPersistentContext(directory, options); await server.attach(second);
    const reopened = second.pages()[0] || await second.newPage(); await open(reopened);
    await expect(reopened.getByText('Writing is paused.')).toBeVisible();
    await takeOver(reopened); await expect(reopened.getByText(/local answer Delta/)).toBeVisible();
    expect(server.writes.every(row => row.operationKey === original.operationKey && row.sessionId === original.sessionId)).toBe(true);
    await reopened.getByRole('button', { name: 'Review this pending answer' }).click();
    await reopened.getByRole('button', { name: 'Keep server answer' }).click();
    await expect(reopened.getByRole('radio', { name: 'Delta' })).toBeEnabled();
  } finally {
    await first?.close(); await second?.close(); await rm(directory, { recursive: true, force: true });
  }
});

test('historical unassociated pending answer is never rebound automatically', async ({ context, page }) => {
  const server = await setup(context); await page.goto('/');
  const historical = { accountId: account, attemptId: attempt, questionId: question, position: 1, selected: 2, baseAnswer: null,
    expectedRevision: 0, operationKey: crypto.randomUUID(), sequence: 1, createdAt: 1, updatedAt: 1, status: 'pending', lastServerAnswer: null, lastServerRevision: 0, acceptedRevision: null };
  await page.evaluate(async row => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('edureach-cbt-v2-operations', 1); request.onupgradeneeded = () => { const store = request.result.createObjectStore('operations', { keyPath: 'operationKey' }); store.createIndex('scope', ['accountId', 'attemptId']); request.result.createObjectStore('metadata'); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(['operations', 'metadata'], 'readwrite'); tx.objectStore('operations').add(row); tx.objectStore('metadata').put(1, 'sequence'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
  }, historical);
  await open(page); await active(page); await expect(page.getByText(/local answer Charlie/)).toBeVisible();
  expect(server.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Review this pending answer' }).click();
  await page.getByRole('button', { name: 'Apply my local answer' }).click();
  await expect.poll(() => server.getState().revision).toBe(1);
  expect(server.writes).toHaveLength(1); expect(server.writes[0].operationKey).not.toBe(historical.operationKey);
});

test('an older state response cannot undo a newer acquisition revision', async ({ context, page }) => {
  const server = await setup(context); server.regressAfterSession(); await open(page);
  await expect(page.getByText('Writing is paused.')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Alpha' })).toBeDisabled();
  expect(server.getState().revision).toBe(1); expect(server.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Retry connection' }).click(); await active(page);
  await expect(page.getByRole('radio', { name: 'Bravo' })).toHaveAttribute('aria-checked', 'true');
});
