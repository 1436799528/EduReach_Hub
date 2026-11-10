import { expect, test } from '@playwright/test';

// Failed session acquisition and unsafe preflight remain fail-closed. Session requests are not answer writes.
const student = '11111111-1111-4111-8111-111111111111';
const attempt = '22222222-2222-4222-8222-222222222222';
const question = '33333333-3333-4333-8333-333333333333';
const other = '44444444-4444-4444-8444-444444444444';

for (const mode of ['valid', 'mismatched-paper', 'storage-failure'] as const) {
  test(`v2 session read-only preflight remains blocked: ${mode}`, async ({ page }) => {
    await page.addInitScript(({ student, mode }) => {
      localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
        access_token: 'synthetic-test-token', refresh_token: 'synthetic-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600, token_type: 'bearer', user: { id: student, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
      }));
      const original = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function(...args) {
        // @ts-expect-error synthetic test instrumentation
        window.cbtPreflightOpened = (window.cbtPreflightOpened || 0) + 1;
        if (mode === 'storage-failure') throw new DOMException('Storage unavailable', 'QuotaExceededError');
        return original.apply(this, args);
      };
    }, { student, mode });
    await page.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
    let states = 0, writes = 0;
    await page.route('**/api/cbt/**', route => {
      const req = route.request(), url = req.url();
      if (url.endsWith('/paper')) return route.fulfill({ json: {
        protocol: { version: 2, scope: 'local-rehearsal' }, serverTime: new Date().toISOString(),
        attempt: { id: attempt, examId: 'synthetic', status: 'in_progress', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), mode: 'practice', durationMinutes: 60, programme: null, subjects: ['Test'], plan: [], totalQuestions: 1, questionIndex: 0, savedAnswers: {}, exam: { id: 'synthetic', title: 'Test paper', examBody: 'test', subject: 'Test' } },
        questions: [{ position: 1, subject: 'Test', id: question, text: 'Test-only question', options: ['A', 'B', 'C', 'D'] }],
      } });
      if (url.endsWith('/state')) {
        states++;
        return route.fulfill({ json: { protocol: 2, revision: 0, answers: {}, status: 'in_progress', questionIds: [mode === 'mismatched-paper' ? other : question] } });
      }
      if (req.method() !== 'GET' && !url.endsWith('/session')) writes++;
      return route.fulfill({ status: 503, json: { error: 'Unexpected request' } });
    });
    await page.goto(`/cbt/session/${attempt}`);
    const alert = page.getByRole('alert').filter({ hasText: 'cannot be opened safely' });
    if (mode === 'valid') await expect(page.getByText('Writing is paused.')).toBeVisible();
    else await expect(alert).toBeVisible();
    if (mode === 'storage-failure') await expect(alert).toContainText('Browser storage is unavailable or requires review');
    expect(states).toBe(mode === 'valid' ? 2 : 1);
    // @ts-expect-error synthetic test instrumentation
    expect(await page.evaluate(() => window.cbtPreflightOpened)).toBeGreaterThanOrEqual(1);
    if (mode === 'valid') await expect(page.getByRole('radio').first()).toBeDisabled();
    else await expect(page.getByRole('radio')).toHaveCount(0);
    await page.keyboard.press('1');
    expect(writes).toBe(0);
  });
}

test('real guarded session preflight preserves an existing pending journal record across refresh', async ({ page }) => {
  await page.addInitScript(student => {
    localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
      access_token: 'synthetic-test-token', refresh_token: 'synthetic-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600, token_type: 'bearer', user: { id: student, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
    }));
  }, student);
  await page.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
  let writes = 0;
  await page.route('**/api/cbt/**', route => {
    const req = route.request(), url = req.url();
    if (url.endsWith('/paper')) return route.fulfill({ json: {
      protocol: { version: 2, scope: 'local-rehearsal' }, serverTime: new Date().toISOString(),
      attempt: { id: attempt, examId: 'synthetic', status: 'in_progress', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), mode: 'practice', durationMinutes: 60, programme: null, subjects: ['Test'], plan: [], totalQuestions: 1, questionIndex: 0, savedAnswers: {}, exam: { id: 'synthetic', title: 'Test paper', examBody: 'test', subject: 'Test' } },
      questions: [{ position: 1, subject: 'Test', id: question, text: 'Test-only question', options: ['A', 'B', 'C', 'D'] }],
    } });
    if (url.endsWith('/state')) return route.fulfill({ json: { protocol: 2, revision: 0, answers: {}, status: 'in_progress', questionIds: [question] } });
    if (req.method() !== 'GET' && !url.endsWith('/session')) writes++;
    return route.fulfill({ status: 503, json: { error: 'Unexpected request' } });
  });
  await page.goto('/');
  const pending = { accountId: student, attemptId: attempt, questionId: question, position: 1, selected: 1, baseAnswer: null,
    expectedRevision: 0, operationKey: '55555555-5555-4555-8555-555555555555', sequence: 1, createdAt: 1, updatedAt: 1,
    status: 'pending', lastServerAnswer: null, lastServerRevision: 0, acceptedRevision: null };
  await page.evaluate(async op => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('edureach-cbt-v2-operations', 1);
      request.onupgradeneeded = () => { const store = request.result.createObjectStore('operations', { keyPath: 'operationKey' }); store.createIndex('scope', ['accountId', 'attemptId']); request.result.createObjectStore('metadata'); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['operations', 'metadata'], 'readwrite'); tx.objectStore('operations').add(op); tx.objectStore('metadata').put(1, 'sequence');
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    }); db.close();
  }, pending);
  await page.goto(`/cbt/session/${attempt}`);
  await expect(page.getByText('Writing is paused.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Writing is paused.')).toBeVisible();
  const restored = await page.evaluate(async key => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('edureach-cbt-v2-operations'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const row = await new Promise<unknown>((resolve, reject) => { const r = db.transaction('operations', 'readonly').objectStore('operations').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    db.close(); return row;
  }, pending.operationKey);
  expect(restored).toEqual(pending); expect(writes).toBe(0);
});

test('actual guarded page preflight finds migrated pending and acknowledged rows across case and refresh', async ({ page }) => {
  const lowerAccount = 'a1111111-1111-4111-8111-111111111111';
  const lowerAttempt = 'b2222222-2222-4222-8222-222222222222';
  const q = 'c3333333-3333-4333-8333-333333333333';
  await page.addInitScript(accountId => {
    localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({ access_token: 'synthetic-test-token', refresh_token: 'synthetic-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id: accountId, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} } }));
    const getAll = IDBIndex.prototype.getAll;
    IDBIndex.prototype.getAll = function(...args) {
      const request = getAll.apply(this, args);
      if (this.name === 'scope') request.addEventListener('success', () => {
        // @ts-expect-error test-only observation of real page preflight
        window.cbtRecoveredRows = request.result;
      });
      return request;
    };
  }, lowerAccount.toUpperCase());
  await page.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
  let writes = 0;
  await page.route('**/api/cbt/**', route => {
    const req = route.request(), url = req.url();
    if (url.endsWith('/paper')) return route.fulfill({ json: {
      protocol: { version: 2, scope: 'local-rehearsal' }, serverTime: new Date().toISOString(),
      attempt: { id: lowerAttempt, examId: 'synthetic', status: 'in_progress', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), mode: 'practice', durationMinutes: 60, programme: null, subjects: ['Test'], plan: [], totalQuestions: 1, questionIndex: 0, savedAnswers: {}, exam: { id: 'synthetic', title: 'Test paper', examBody: 'test', subject: 'Test' } },
      questions: [{ position: 1, subject: 'Test', id: q, text: 'Test-only question', options: ['A', 'B', 'C', 'D'] }],
    } });
    if (url.endsWith('/state')) return route.fulfill({ json: { protocol: 2, revision: 1, answers: { '1': 1 }, status: 'in_progress', questionIds: [q] } });
    if (req.method() !== 'GET' && !url.endsWith('/session')) writes++;
    return route.fulfill({ status: 503, json: { error: 'Unexpected request' } });
  });
  await page.goto('/');
  const pending = { accountId: lowerAccount, attemptId: lowerAttempt, questionId: q, position: 1, selected: 2, baseAnswer: 1, expectedRevision: 1, operationKey: 'd4444444-4444-4444-8444-444444444444', sequence: 2, createdAt: 2, updatedAt: 2, status: 'pending', lastServerAnswer: 1, lastServerRevision: 1, acceptedRevision: null };
  const acknowledged = { ...pending, operationKey: 'e5555555-5555-4555-8555-555555555555', sequence: 1, selected: 1, baseAnswer: null, expectedRevision: 0, status: 'acknowledged', acceptedRevision: 1 };
  await page.evaluate(async rows => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('edureach-cbt-v2-operations', 1); r.onupgradeneeded = () => { const s = r.result.createObjectStore('operations', { keyPath: 'operationKey' }); s.createIndex('scope', ['accountId', 'attemptId']); r.result.createObjectStore('metadata'); }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(['operations', 'metadata'], 'readwrite'); rows.forEach(row => tx.objectStore('operations').add(row)); tx.objectStore('metadata').put(2, 'sequence'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
  }, [pending, acknowledged]);
  for (let i = 0; i < 2; i++) {
    if (i === 0) await page.goto(`/cbt/session/${lowerAttempt.toUpperCase()}`); else await page.reload();
    await expect(page.getByText('Writing is paused.')).toBeVisible();
    // @ts-expect-error test-only observation of real page preflight
    const recovered = await page.evaluate(() => window.cbtRecoveredRows);
    expect(recovered).toHaveLength(2);
    expect(recovered.map((r: { status: string }) => r.status).sort()).toEqual(['acknowledged', 'pending']);
    expect(recovered.find((r: { operationKey: string }) => r.operationKey === pending.operationKey)).toEqual(pending);
    expect(recovered.find((r: { operationKey: string }) => r.operationKey === acknowledged.operationKey)).toEqual(acknowledged);
    await expect(page.getByRole('radio').first()).toBeDisabled();
  }
  expect(writes).toBe(0);
});
