import { expect, test, type Page } from '@playwright/test';

/**
 * Interrupted-session recovery, proven in a real browser.
 *
 * The exam runs against synthetic API responses inside the browser — no real
 * server, database or candidate data. What is real is the hall, the recovery
 * journal in IndexedDB, the offline/refresh/auth interruptions, and the
 * promise that no answer is lost, duplicated or silently overwritten.
 */

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const OTHER_ACCOUNT = '22222222-2222-4222-8222-222222222222';
const ATTEMPT = '33333333-3333-4333-8333-333333333333';

type MockOptions = {
  savedAnswers?: Record<number, number>;
  draftResult?: 'ok' | 'fail' | 'auth';
  submitResult?: 'ok' | 'fail';
  onDraft?: (body: { answers?: Record<number, number> }) => void;
};

function authPayload(account: string) {
  return JSON.stringify({
    access_token: 'isolated-test-token',
    refresh_token: 'isolated-test-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: account, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
  });
}

async function setAuth(page: Page, account: string | null) {
  await page.evaluate(
    ({ token }) => {
      if (token) localStorage.setItem('sb-edureach-unconfigured-auth-token', token);
      else localStorage.removeItem('sb-edureach-unconfigured-auth-token');
    },
    { token: account ? authPayload(account) : null },
  );
}

async function installAuth(page: Page, account = ACCOUNT) {
  await page.addInitScript(
    ({ account }) => {
      // Only when absent: a test may deliberately switch accounts between
      // navigations, and must stay the account it switched to.
      if (!localStorage.getItem('sb-edureach-unconfigured-auth-token')) {
        localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
          access_token: 'isolated-test-token',
          refresh_token: 'isolated-test-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: account, aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
        }));
      }
      localStorage.setItem('edureach-privacy-preferences-v1', JSON.stringify({ necessary: true, analytics: false, version: 1 }));
    },
    { account },
  );
  await page.route('**/edureach-unconfigured.supabase.co/**', (route) => route.abort());
}

const paperBody = (savedAnswers: Record<number, number>) => ({
  serverTime: new Date().toISOString(),
  protocol: { version: 1 },
  attempt: {
    id: ATTEMPT,
    examId: 'test-exam',
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    mode: 'practice',
    durationMinutes: 30,
    programme: null,
    subjects: ['Test subject'],
    plan: [],
    totalQuestions: 2,
    questionIndex: 0,
    savedAnswers,
    exam: { id: 'test-exam', title: 'Recovery test paper', examBody: 'test', subject: 'Test subject' },
  },
  questions: [
    { position: 1, subject: 'Test subject', id: 'test-question-1', text: 'Test-only question one', options: ['Option one', 'Option two', 'Option three', 'Option four'] },
    { position: 2, subject: 'Test subject', id: 'test-question-2', text: 'Test-only question two', options: ['Option one', 'Option two', 'Option three', 'Option four'] },
  ],
});

async function installPaper(page: Page, options: MockOptions = {}, counters = { submits: 0, drafts: 0 }) {
  await page.unroute(`**/cbt/attempts/${ATTEMPT}/paper`).catch(() => undefined);
  await page.unroute(`**/cbt/attempts/${ATTEMPT}/draft`).catch(() => undefined);
  await page.unroute(`**/cbt/attempts/${ATTEMPT}/submit`).catch(() => undefined);
  await page.route(`**/cbt/attempts/${ATTEMPT}/paper`, (route) => route.fulfill({ json: paperBody(options.savedAnswers ?? {}) }));
  await page.route(`**/cbt/attempts/${ATTEMPT}/draft`, (route) => {
    counters.drafts++;
    const body = route.request().postDataJSON() as { answers?: Record<number, number> };
    options.onDraft?.(body);
    if (options.draftResult === 'fail') return route.fulfill({ status: 503, json: { error: 'Service unavailable' } });
    if (options.draftResult === 'auth') return route.fulfill({ status: 401, json: { error: 'Please sign in again.' } });
    return route.fulfill({ json: { saved: true, serverTime: new Date().toISOString(), answers: body.answers ?? {} } });
  });
  await page.route(`**/cbt/attempts/${ATTEMPT}/submit`, (route) => {
    counters.submits++;
    if (options.submitResult === 'fail') return route.fulfill({ status: 503, json: { error: 'Service unavailable' } });
    return route.fulfill({
      json: { attemptId: ATTEMPT, score: 50, correctAnswers: 1, totalQuestions: 2, breakdown: [] },
    });
  });
  return counters;
}

async function openHall(page: Page) {
  await page.goto(`/cbt/session/${ATTEMPT}`);
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('heading', { name: 'Test-only question one' })).toBeVisible();
}

function journalRecords(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('edureach-cbt-recovery-journal', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      const request = db.transaction('attempts', 'readonly').objectStore('attempts').getAll();
      request.onsuccess = () => resolve(request.result as Array<Record<string, unknown>>);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return rows;
  });
}

test('a refresh with no network restores the paper and answers from this device first', async ({ page }) => {
  await installAuth(page);
  const counters = await installPaper(page);
  await openHall(page);
  await page.getByRole('radio', { name: /Option two/ }).click();
  await expect.poll(() => counters.drafts, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

  // The network dies; the tab is refreshed.
  await installPaper(page, { draftResult: 'fail' }, counters);
  await page.unroute(`**/cbt/attempts/${ATTEMPT}/paper`);
  await page.route(`**/cbt/attempts/${ATTEMPT}/paper`, (route) => route.abort('internetdisconnected'));
  await page.reload();
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();

  // The hall renders from the device — no blocking error, answers intact.
  await expect(page.getByRole('heading', { name: 'Test-only question one' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Option two/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/Showing the copy saved on this device/i)).toBeVisible();

  // The connection returns: the same attempt reconciles and saves again —
  // nothing lost, nothing duplicated.
  await installPaper(page, {}, counters);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => counters.drafts, { timeout: 8_000 }).toBeGreaterThanOrEqual(1);
  const records = await journalRecords(page);
  expect(records).toHaveLength(1);
  expect(records[0].answers).toMatchObject({ 1: 1 });
});

test('an expired session keeps the recovery data and resumes the SAME attempt after sign-in', async ({ page }) => {
  await installAuth(page);
  await installPaper(page, { draftResult: 'auth' });
  await openHall(page);
  await page.getByRole('radio', { name: /Option three/ }).click();
  await expect(page.getByText(/Your session ended/i)).toBeVisible();

  // The student signs in again in the same tab and returns to the attempt.
  await setAuth(page, ACCOUNT);
  await installPaper(page);
  await page.goto(`/cbt/session/${ATTEMPT}`);
  await expect(page).toHaveURL(new RegExp(ATTEMPT));
  await expect(page.getByRole('heading', { name: 'Test-only question one' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Option three/ })).toHaveAttribute('aria-checked', 'true');
});

test('recovery data is cleared only after the server confirms the submission and the result exists', async ({ page }) => {
  await installAuth(page);
  const counters = await installPaper(page, { submitResult: 'fail' });
  await openHall(page);
  await page.getByRole('radio', { name: /Option two/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('radio', { name: /Option three/ }).click();
  await page.getByRole('button', { name: 'Submit Examination' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Submit Examination' }).click();
  // The submission could not be confirmed: the recovery data stays (the
  // idempotent retry may run in the background; nothing is cleared).
  await expect.poll(() => counters.submits, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(500);
  expect(await journalRecords(page)).toHaveLength(1);

  // The retry succeeds: submission confirmed and the result is stored —
  // only now is the recovery data cleared.
  await installPaper(page, {}, counters);
  await expect(page).toHaveURL(/\/cbt\/results\//, { timeout: 20_000 });
  await expect.poll(async () => (await journalRecords(page)).length, { timeout: 5_000 }).toBe(0);
});

test('a stale device answer cannot overwrite a newer saved answer; the difference needs an explicit choice', async ({ page }) => {
  await installAuth(page);
  const sent: Array<Record<number, number>> = [];
  const counters = await installPaper(page, {
    savedAnswers: { 1: 1 }, // the account has Option two on question one
    draftResult: 'fail', // this device cannot confirm its newer change yet
    onDraft: (body) => {
      if (body.answers) sent.push(body.answers);
    },
  });
  await openHall(page);
  // The device changes question one to Option three, but every save fails.
  await page.getByRole('radio', { name: /Option three/ }).click();
  await expect(page.getByText(/not yet saved|not saved/i)).toBeVisible();

  // Meanwhile a newer tab or device saved Option four to the account.
  await installPaper(page, {
    savedAnswers: { 1: 3 },
    draftResult: 'ok',
    onDraft: (body) => {
      if (body.answers) sent.push(body.answers);
    },
  }, counters);
  await page.reload();
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('heading', { name: 'Test-only question one' })).toBeVisible();

  // The difference is surfaced explicitly instead of being silently sent.
  await expect(page.getByText(/two different answers/i)).toBeVisible();
  await expect(page.getByRole('radio', { name: /Option three/ })).toHaveAttribute('aria-checked', 'true');

  // Acting on another question saves the whole snapshot — and the wire still
  // carries the newer saved answer at the conflicted question, never the
  // stale device value.
  sent.length = 0;
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('radio', { name: /Option two/ }).click();
  await expect.poll(() => sent.some((body) => body[2] === 1), { timeout: 5_000 }).toBe(true);
  // No save may ever carry the stale device value over the newer saved one.
  for (const body of sent) {
    expect(body[1]).not.toBe(2);
    if (body[1] !== undefined) expect(body[1]).toBe(3);
    if (body[2] !== undefined) expect(body[2]).toBe(1);
  }

  // The explicit choice resolves it: this device's answers stand and save.
  sent.length = 0;
  await page.getByRole('button', { name: "Keep this device's answers" }).click();
  await expect.poll(() => sent.length, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
  for (const body of sent) expect(body[1]).toBe(2);
  await expect(page.getByText(/two different answers/i)).toHaveCount(0);
});

test('one account never sees another account recovery data on the same device', async ({ page }) => {
  await installAuth(page, ACCOUNT);
  await installPaper(page);
  await openHall(page);
  await page.getByRole('radio', { name: /Option four/ }).click();
  await expect.poll(async () => (await journalRecords(page)).length, { timeout: 5_000 }).toBe(1);

  // A different account opens the same attempt id on this device.
  await setAuth(page, OTHER_ACCOUNT);
  await page.goto(`/cbt/session/${ATTEMPT}`);
  await expect(page.getByRole('heading', { name: 'Test-only question one' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Option four/ })).toHaveAttribute('aria-checked', 'false');
  const records = await journalRecords(page);
  // The first account's record is intact and still belongs to it alone.
  const mine = records.filter((row) => String(row.accountId) === ACCOUNT.toLowerCase());
  expect(mine).toHaveLength(1);
  expect(mine[0].answers).toMatchObject({ 1: 3 });
  for (const row of records) {
    if (String(row.accountId) !== ACCOUNT.toLowerCase()) {
      expect(row.answers).not.toMatchObject({ 1: 3 });
    }
  }
});
