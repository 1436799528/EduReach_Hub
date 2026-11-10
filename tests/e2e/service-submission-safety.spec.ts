import { expect, test } from '@playwright/test';

// Unconfigured local preview: never talks to hosted accounts or databases.
test('an unavailable service backend cannot create a fake confirmed request', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('edureach-service-draft-results', JSON.stringify({
      step: 3,
      form: { fullName: 'Synthetic Student', phone: '08012345678', institution: 'Synthetic Institution', notes: 'Test draft' },
    }));
  });
  await page.goto('/services/apply/results');
  await expect(page.getByRole('status').filter({ hasText: 'Preview build' })).toContainText(/service requests cannot be submitted/i);
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole('button', { name: 'Confirm & Submit' }).click();
  await expect(page.getByRole('alert')).toContainText(/unavailable.*not been submitted/i);
  await expect(page.getByText('REQUEST CONFIRMED')).toHaveCount(0);
  await expect(page.getByText('Application Successfully Logged')).toHaveCount(0);
  const saved = await page.evaluate(() => sessionStorage.getItem('edureach-service-draft-results'));
  expect(saved).toContain('Synthetic Student');
});

test('legacy local preview requests are labeled as not submitted and remain stored', async ({ page }) => {
  const key = 'edureach-local:student-example-test:service-requests';
  await page.addInitScript((storageKey) => {
    localStorage.setItem('edureach-local-user-email', 'student@example.test');
    localStorage.setItem(storageKey, JSON.stringify([{ id: 'legacy-local', status: 'submitted', reference_code: 'LOCAL-ONLY', created_at: '2026-01-01T00:00:00Z', form_data: { serviceTitle: 'Synthetic service' } }]));
    localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
      access_token: 'isolated-test-token', refresh_token: 'isolated-test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600, token_type: 'bearer', user: { id: 'isolated-student', aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
    }));
  }, key);
  await page.route('**/edureach-unconfigured.supabase.co/**', route => route.abort());
  await page.goto('/dashboard/services');
  await expect(page.getByText(/local preview records were not submitted to EduReach/i)).toBeVisible();
  await expect(page.getByText('LOCAL-ONLY').first()).toBeAttached();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toContain('LOCAL-ONLY');
});
