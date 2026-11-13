import { expect, test } from '@playwright/test';

// Synthetic browser-only fixtures: no real questions, accounts or database.
async function fixture(page: import('@playwright/test').Page, pending: Record<string, number>, server: Record<string, number>) {
  await page.addInitScript(({ draft }) => {
    localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
      access_token: 'isolated-test-token', refresh_token: 'isolated-test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600,
      token_type: 'bearer', user: { id: 'isolated-test-user', aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
    }));
    localStorage.setItem('edureach-cbt-pending:recovery-test', JSON.stringify(draft));
  }, { draft: pending });
  await page.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
  await page.route('**/cbt/attempts/recovery-test/paper', route => route.fulfill({ json: {
    serverTime: new Date().toISOString(),
    protocol: { version: 1 },
    attempt: { id: 'recovery-test', examId: 'test-exam', status: 'in_progress', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), mode: 'practice', durationMinutes: 60, programme: null, subjects: ['Test subject'], plan: [], totalQuestions: 1, questionIndex: 0, savedAnswers: server, exam: { id: 'test-exam', title: 'Test paper', examBody: 'test', subject: 'Test subject' } },
    questions: [{ position: 1, subject: 'Test subject', id: 'test-question', text: 'Test-only question', options: ['Option one', 'Option two'] }],
  } }));
}

test('a restored cleared answer stays cleared and is identified as unconfirmed', async ({ page }) => {
  await fixture(page, {}, { '1': 0 });
  let writes = 0;
  let submitted: unknown;
  await page.route('**/cbt/attempts/recovery-test/draft', route => { writes++; return route.fulfill({ json: { saved: true } }); });
  await page.route('**/cbt/attempts/recovery-test/submit', route => {
    submitted = route.request().postDataJSON().answers;
    return route.fulfill({ status: 503, json: { error: 'Synthetic unavailable' } });
  });
  await page.goto('/cbt/session/recovery-test');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('radio', { name: /Option one/ })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('status').filter({ hasText: 'not yet saved' })).toBeVisible();
  await expect(page.getByText(/browser copy.*another tab or device/i)).toBeVisible();
  await page.waitForTimeout(1300);
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Submit Examination' }).first().click();
  const unanswered = page.getByRole('dialog', { name: /unanswered/i });
  await expect(unanswered).toBeVisible();
  expect(submitted).toBeUndefined();
  await unanswered.getByRole('button', { name: 'Submit anyway' }).click();
  await page.getByRole('dialog', { name: 'Submit examination?' }).getByRole('button', { name: 'Submit Examination' }).click();
  await expect.poll(() => submitted).toEqual({});
});

test('an acknowledgement does not delete a different browser copy written by another tab before the check', async ({ page, context }) => {
  await fixture(page, {}, {});
  let release!: () => void;
  let started!: () => void;
  const canFinish = new Promise<void>(resolve => { release = resolve; });
  const didStart = new Promise<void>(resolve => { started = resolve; });
  await page.route('**/cbt/attempts/recovery-test/draft', async route => {
    started();
    await canFinish;
    return route.fulfill({ json: { saved: true } });
  });
  await page.goto('/cbt/session/recovery-test');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  const other = await context.newPage();
  await other.goto('/');
  await page.getByRole('radio', { name: /Option one/ }).click();
  await didStart;
  await other.evaluate(() => localStorage.setItem('edureach-cbt-pending:recovery-test', JSON.stringify({ '1': 1 })));
  release();
  await expect(page.getByText(/different browser copy/i)).toBeVisible();
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('edureach-cbt-pending:recovery-test'))) || '{}')).toEqual({ '1': 1 });
});
