import { expect, test } from '@playwright/test';

// This verifies the temporary block in two real session pages. It does not
// exercise concurrent v2 edits, which remain unimplemented.
test('two session pages cannot fall back to legacy writes for a v2 paper', async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
      access_token: 'isolated-test-token', refresh_token: 'isolated-test-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: 'isolated-test-user', aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
    }));
  });
  await context.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
  let writes = 0;
  await context.route('**/api/cbt/**', route => {
    if (route.request().url().endsWith('/paper')) return route.fulfill({ json: {
      protocol: { version: 2, scope: 'local-rehearsal' }, serverTime: new Date().toISOString(),
      attempt: { id: 'two-page-test', examId: 'test-exam', status: 'in_progress', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), mode: 'practice', durationMinutes: 60, programme: null, subjects: ['Test'], plan: [], totalQuestions: 1, questionIndex: 0, savedAnswers: {}, exam: { id: 'test-exam', title: 'Test paper', examBody: 'test', subject: 'Test' } },
      questions: [{ position: 1, subject: 'Test', id: 'test-question', text: 'Test-only question', options: ['Option one', 'Option two'] }],
    } });
    if (route.request().method() !== 'GET') writes++;
    return route.fulfill({ status: 503, json: { error: 'Unexpected request' } });
  });
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  await Promise.all(pages.map(page => page.goto('/cbt/session/two-page-test')));
  for (const page of pages) {
    await expect(page.getByRole('alert').filter({ hasText: 'cannot be opened safely' })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await page.keyboard.press('1');
  }
  expect(writes).toBe(0);
});
