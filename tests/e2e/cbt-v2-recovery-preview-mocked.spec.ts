import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { AnswerOperation } from '../../src/lib/cbtAnswerQueue';

// Real blocked CBT page with synthetic auth/server and locally seeded v1 IDB.
const account = 'aabbccdd-a1b2-4c3d-8e4f-abcdef012345';
const attempt = 'abcdefab-1234-4abc-8def-abcdef123456';
const ids = ['cabdecab-1234-4abc-8def-cabdec123456', 'eeaaeeaa-1234-4abc-8def-eeaaeeaa1234'];
const key = 'deadbeef-1234-4abc-8def-deadbeef1234';
const secondKey = 'faafbaaf-1234-4abc-8def-faafbaaf1234';
const thirdKey = 'baacbaac-1234-4abc-8def-baacbaac1234';
const base: AnswerOperation = { accountId: account, attemptId: attempt, questionId: ids[0], position: 1, selected: 2, baseAnswer: 1, expectedRevision: 2, operationKey: key, sequence: 1, createdAt: 1, updatedAt: 1, status: 'pending', lastServerAnswer: 1, lastServerRevision: 2, acceptedRevision: null as number | null };
type Row = AnswerOperation;

async function routeSession(context: BrowserContext, revision: number, answers: Record<string, number>, malformedPaper: 'object-option' | 'empty-options' | 'blank-option' | 'blank-text' | 'duplicate-id' | null = null) {
  let writes = 0;
  await context.addInitScript(accountId => {
    localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({ access_token: 'synthetic-test-token', refresh_token: 'synthetic-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id: accountId, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} } }));
  }, account.toUpperCase());
  await context.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
  await context.route('**/api/cbt/**', route => {
    const req = route.request(), url = req.url();
    if (url.endsWith('/paper')) return route.fulfill({ json: {
      protocol: { version: 2, scope: 'local-rehearsal' }, serverTime: new Date().toISOString(),
      attempt: { id: attempt, examId: 'synthetic', status: 'in_progress', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), mode: 'practice', durationMinutes: 60, programme: null, subjects: ['Test'], plan: [], totalQuestions: 2, questionIndex: 0, savedAnswers: {}, exam: { id: 'synthetic', title: 'Test', examBody: 'test', subject: 'Test' } },
      questions: ids.map((id, i) => ({ position: i + 1, subject: 'Test', id: malformedPaper === 'duplicate-id' ? ids[0] : id, text: !i && malformedPaper === 'blank-text' ? '  ' : i ? 'Second question' : 'First question', options: !i && malformedPaper === 'object-option' ? ['A', { invalid: true }, 'C', 'D'] : !i && malformedPaper === 'empty-options' ? [] : !i && malformedPaper === 'blank-option' ? ['A', ' ', 'C', 'D'] : ['A', 'B', 'C', 'D'] })),
    } });
    if (url.endsWith('/state')) return route.fulfill({ json: { protocol: 2, revision, answers, status: 'in_progress', questionIds: ids } });
    if (req.method() !== 'GET') writes++;
    return route.fulfill({ status: 503, json: { error: 'Unexpected request' } });
  });
  return () => writes;
}
async function seed(page: Page, rows: Row[]) {
  await page.goto('/');
  await page.evaluate(async rows => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('edureach-cbt-v2-operations', 1); r.onupgradeneeded = () => { const s = r.result.createObjectStore('operations', { keyPath: 'operationKey' }); s.createIndex('scope', ['accountId', 'attemptId']); r.result.createObjectStore('metadata'); }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(['operations', 'metadata'], 'readwrite'); rows.forEach(row => tx.objectStore('operations').add(row)); tx.objectStore('metadata').put(Math.max(...rows.map(row => row.sequence)), 'sequence'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
  }, rows);
}
async function open(page: Page) {
  await page.goto(`/cbt/session/${attempt.toUpperCase()}`);
  await expect(page.getByRole('alert').filter({ hasText: 'cannot be opened safely' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
}

test('acknowledged server answer appears in blocked read-only page after refresh', async ({ context, page }) => {
  const writes = await routeSession(context, 1, { '1': 1 });
  await seed(page, [{ ...base, selected: 1, baseAnswer: null, expectedRevision: 0, status: 'acknowledged', lastServerRevision: 1, acceptedRevision: 1 }]);
  await open(page); await page.reload();
  const preview = page.getByRole('region', { name: 'Read-only recovery preview' });
  await expect(preview).toContainText('First question: B'); await expect(preview).toContainText('Second question: No answer');
  await expect(preview).toContainText('not confirmation'); expect(writes()).toBe(0);
});

test('ordered pending choices and a second question render with mixed UUID casing; two pages agree after refresh', async ({ context, page }) => {
  const writes = await routeSession(context, 2, { '1': 1 });
  const uppercase = { ...base, accountId: account.toUpperCase(), attemptId: attempt.toUpperCase(), questionId: ids[0].toUpperCase(), operationKey: key.toUpperCase() };
  await seed(page, [uppercase, { ...base, questionId: ids[1], position: 2, selected: 3, baseAnswer: null, lastServerAnswer: null, operationKey: secondKey, sequence: 2 }, { ...base, selected: 0, operationKey: thirdKey, sequence: 3 }]);
  await open(page);
  const other = await context.newPage(); await open(other);
  for (const tab of [page, other]) {
    await tab.reload(); const preview = tab.getByRole('region', { name: 'Read-only recovery preview' });
    await expect(preview).toContainText('First question: A'); await expect(preview).toContainText('Second question: D');
    await tab.keyboard.press('2'); await expect(tab.getByRole('radio')).toHaveCount(0);
  }
  await page.close(); const reopened = await context.newPage(); await open(reopened);
  await expect(reopened.getByRole('region', { name: 'Read-only recovery preview' })).toContainText('First question: A');
  const count = await reopened.evaluate(async () => { const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('edureach-cbt-v2-operations'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); const rows = await new Promise<unknown[]>((resolve, reject) => { const r = db.transaction('operations').objectStore('operations').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); db.close(); return rows.length; });
  expect(count).toBe(3); expect(writes()).toBe(0);
});

for (const mode of ['invalid-question', 'invalid-option', 'stale', 'conflicted'] as const) {
  test(`unsafe ${mode} journal never renders a recovery preview`, async ({ context, page }) => {
    const writes = await routeSession(context, 2, { '1': 1 });
    const row: Row = mode === 'invalid-question' ? { ...base, questionId: ids[1] } : mode === 'invalid-option' ? { ...base, selected: 4 } : mode === 'stale' ? { ...base, expectedRevision: 1, lastServerRevision: 1 } : { ...base, status: 'conflicted' };
    await seed(page, [row]); await open(page); await page.reload();
    await expect(page.getByRole('region', { name: 'Read-only recovery preview' })).toHaveCount(0);
    expect(writes()).toBe(0);
  });
}

for (const malformed of ['object-option', 'empty-options', 'blank-option', 'blank-text', 'duplicate-id'] as const) {
  test(`malformed ${malformed} cannot render the guarded recovery preview`, async ({ context, page }) => {
    const writes = await routeSession(context, 2, { '1': 1 }, malformed);
    await seed(page, [base]); await open(page); await page.reload();
    await expect(page.getByRole('region', { name: 'Read-only recovery preview' })).toHaveCount(0);
    expect(writes()).toBe(0);
  });
}
