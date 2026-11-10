import { expect, test } from '@playwright/test';

// A synthetic session and a deliberately slow first write reproduce a race
// without touching a real Supabase account, database, or question bank.
test('a slow earlier save cannot overwrite the latest answer within one tab', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
      access_token: 'isolated-test-token', refresh_token: 'isolated-test-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: 'isolated-test-user', aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
    }));
  });
  await page.route('**/edureach-unconfigured.supabase.co/**', (route) => route.abort());
  await page.route('**/cbt/attempts/order-test/paper', (route) => route.fulfill({ json: {
    serverTime: new Date().toISOString(),
    protocol: { version: 1 },
    attempt: { id: 'order-test', examId: 'test-exam', status: 'in_progress', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), mode: 'practice', durationMinutes: 60, programme: null, subjects: ['Test subject'], plan: [], totalQuestions: 1, questionIndex: 0, savedAnswers: {}, exam: { id: 'test-exam', title: 'Test paper', examBody: 'test', subject: 'Test subject' } },
    questions: [{ position: 1, subject: 'Test subject', id: 'test-question', text: 'Test-only question', options: ['Option one', 'Option two'] }],
  } }));
  let completed = 0;
  let storedAnswer: number | undefined;
  let markSecondStarted!: () => void;
  let releaseSecond!: () => void;
  const secondStarted = new Promise<void>((resolve) => { markSecondStarted = resolve; });
  const secondCanFinish = new Promise<void>((resolve) => { releaseSecond = resolve; });
  await page.route('**/cbt/attempts/order-test/draft', async (route) => {
    const body = route.request().postDataJSON() as { answers: Record<string, number> };
    if (body.answers['1'] === 0) await new Promise((resolve) => setTimeout(resolve, 2400));
    if (body.answers['1'] === 1) { markSecondStarted(); await secondCanFinish; }
    storedAnswer = body.answers['1'];
    completed += 1;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/cbt/session/order-test');
  const rejectOptional = page.getByRole('button', { name: 'Reject optional' });
  if (await rejectOptional.isVisible()) await rejectOptional.click();
  await expect(page.getByRole('heading', { name: 'Test-only question' })).toBeVisible();
  const firstSave = page.waitForRequest((request) => request.url().includes('/cbt/attempts/order-test/draft') && request.method() === 'PATCH');
  await page.getByRole('radio', { name: /Option one/ }).click();
  await firstSave;
  await page.getByRole('radio', { name: /Option two/ }).click();
  await secondStarted;
  const pending = await page.evaluate(() => localStorage.getItem('edureach-cbt-pending:order-test'));
  expect(JSON.parse(pending || '{}')).toEqual({ '1': 1 });
  await expect(page.locator('.er-exam-save-state')).not.toHaveText('saved');
  releaseSecond();
  await expect.poll(() => completed, { timeout: 10000 }).toBe(2);
  expect(storedAnswer).toBe(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('edureach-cbt-pending:order-test'))).toBeNull();
  await expect(page.getByRole('radio', { name: /Option two/ })).toHaveAttribute('aria-checked', 'true');
});
