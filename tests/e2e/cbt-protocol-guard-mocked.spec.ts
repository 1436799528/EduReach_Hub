import { expect, test } from '@playwright/test';

// Synthetic paper responses and pending data only. These tests establish the
// fail-closed guard, not a working v2 queue or a multi-tab concurrency proof.
for (const [description, protocol] of [
  ['missing', undefined],
  ['malformed', { version: 2 }],
  ['advertised rehearsal', { version: 2, scope: 'local-rehearsal' }],
] as const) {
  test(`session blocks ${description} protocol without changing pending work or writing`, async ({ page }) => {
    const pendingKey = 'edureach-cbt-pending:protocol-test';
    const pending = JSON.stringify({ '1': 0 });
    await page.addInitScript(({ key, value }) => {
      localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
        access_token: 'isolated-test-token', refresh_token: 'isolated-test-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
        user: { id: 'isolated-test-user', aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
      }));
      if (!localStorage.getItem('protocol-seeded')) {
        localStorage.setItem(key, value);
        localStorage.setItem('protocol-seeded', '1');
      }
    }, { key: pendingKey, value: pending });
    await page.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
    let writes = 0;
    await page.route('**/api/cbt/**', route => {
      if (route.request().url().endsWith('/paper')) {
        return route.fulfill({ json: {
          serverTime: new Date().toISOString(), protocol,
          attempt: { id: 'protocol-test', examId: 'test-exam', status: 'in_progress', startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), mode: 'practice', durationMinutes: 60, programme: null, subjects: ['Test'], plan: [], totalQuestions: 1, questionIndex: 0, savedAnswers: {}, exam: { id: 'test-exam', title: 'Test paper', examBody: 'test', subject: 'Test' } },
          questions: [{ position: 1, subject: 'Test', id: 'test-question', text: 'Test-only question', options: ['Option one', 'Option two'] }],
        } });
      }
      if (route.request().method() !== 'GET') writes++;
      return route.fulfill({ status: 503, json: { error: 'Unexpected request' } });
    });
    await page.goto('/cbt/session/protocol-test');
    await expect(page.getByRole('alert').filter({ hasText: 'cannot be opened safely' })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await page.keyboard.press('1');
    await page.keyboard.press('ArrowRight');
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'cannot be opened safely' })).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), pendingKey)).toBe(pending);
    expect(writes).toBe(0);
  });
}
