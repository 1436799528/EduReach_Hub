import { expect, test } from '@playwright/test';

// All auth and API data in this test are synthetic and stay inside the browser.
// In particular the failed draft never reaches a real server or database.
test('CBT does not claim an unconfirmed draft or submission was saved', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
      access_token: 'isolated-test-token', refresh_token: 'isolated-test-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: 'isolated-test-user', aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
    }));
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('edureach-cbt-pending:')) throw new DOMException('Storage unavailable', 'QuotaExceededError');
      return originalSet.call(this, key, value);
    };
  });
  await page.route('**/edureach-unconfigured.supabase.co/**', (route) => route.abort());
  await page.route('**/cbt/attempts/test-attempt/paper', (route) => route.fulfill({ json: {
    serverTime: new Date().toISOString(),
    protocol: { version: 1 },
    attempt: { id: 'test-attempt', examId: 'test-exam', status: 'in_progress', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), mode: 'practice', durationMinutes: 60, programme: null, subjects: ['Test subject'], plan: [], totalQuestions: 1, questionIndex: 0, savedAnswers: {}, exam: { id: 'test-exam', title: 'Test paper', examBody: 'test', subject: 'Test subject' } },
    questions: [{ position: 1, subject: 'Test subject', id: 'test-question', text: 'Test-only question', options: ['Option one', 'Option two'] }],
  } }));
  await page.route('**/cbt/attempts/test-attempt/draft', (route) => route.fulfill({ status: 503, json: { error: 'Service unavailable' } }));
  await page.route('**/cbt/attempts/test-attempt/submit', (route) => route.fulfill({ status: 503, json: { error: 'Service unavailable' } }));
  await page.goto('/cbt/session/test-attempt');
  const rejectOptional = page.getByRole('button', { name: 'Reject optional' });
  if (await rejectOptional.isVisible()) await rejectOptional.click();
  await expect(page.getByRole('heading', { name: 'Test-only question' })).toBeVisible();
  await page.getByRole('radio', { name: /Option one/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'not yet saved' })).toContainText('keep this page open');
  await page.getByRole('button', { name: 'End test', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'End this test now?' })).toContainText('Changes that have not been saved may be lost.');
  await page.getByRole('button', { name: 'Continue the test' }).click();
  await page.getByRole('button', { name: 'Submit Examination' }).first().click();
  await page.getByRole('dialog', { name: 'Submit examination?' }).getByRole('button', { name: 'Submit Examination' }).click();
  await expect(page.getByRole('alert')).toContainText('Your submission could not be confirmed.');
  await expect(page.getByRole('alert')).toContainText('check your connection and your results before trying again');
});

test('a CBT paper outage offers retry instead of claiming the attempt is missing', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
      access_token: 'isolated-test-token', refresh_token: 'isolated-test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600,
      token_type: 'bearer', user: { id: 'isolated-test-user', aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
    }));
  });
  await page.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
  let loads = 0;
  await page.route('**/cbt/attempts/unavailable-test/paper', route => {
    loads++;
    return route.fulfill({ status: 503, json: { error: 'Unable to load this CBT attempt. Please try again.' } });
  });
  await page.goto('/cbt/session/unavailable-test');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByText('EduReach is having a problem')).toBeVisible();
  await expect(page.getByText('This item may have been removed or never existed.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect.poll(() => loads).toBe(2);
});
