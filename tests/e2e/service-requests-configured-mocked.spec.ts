import { expect, test } from '@playwright/test';

// Runs separately against a build with a synthetic Supabase origin. All requests
// are intercepted; this is not hosted Auth/PostgREST or staging verification.
test.skip(process.env.RUN_CONFIGURED_SERVICE_TESTS !== '1', 'requires the separately built configured-client fixture');

test('a failed student request read is unavailable rather than an empty list', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb-student-fixture-auth-token', JSON.stringify({
      access_token: 'isolated-test-token', refresh_token: 'isolated-test-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: 'isolated-student', aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} },
    }));
  });
  let mode: 'failure' | 'malformed' | 'empty' = 'failure';
  await page.route('https://student-fixture.supabase.co/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/rest/v1/service_requests') {
      if (mode === 'failure') return route.fulfill({ status: 400, json: { message: 'Synthetic request read failure', code: 'FIXTURE' } });
      return route.fulfill({ json: mode === 'malformed' ? null : [] });
    }
    if (path === '/rest/v1/profiles') return route.fulfill({ json: [{ id: 'isolated-student', role: 'student', full_name: 'Synthetic Student' }] });
    if (path === '/auth/v1/user') return route.fulfill({ json: { id: 'isolated-student', aud: 'authenticated', email: 'student@example.test', app_metadata: {}, user_metadata: {} } });
    return route.fulfill({ json: [] });
  });
  await page.route('**/api/admin/session', route => route.fulfill({ status: 403, json: { error: 'Permission denied' } }));
  await page.goto('/dashboard/services');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('heading', { name: 'My Requests' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/could not load your requests/i);
  await expect(page.getByText('Request status is unavailable.')).toBeVisible();
  await expect(page.getByText('No service requests yet.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh page' })).toBeVisible();
  mode = 'malformed';
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(/could not load your requests/i);
  await expect(page.getByText('No service requests yet.', { exact: false })).toHaveCount(0);
  mode = 'empty';
  await page.reload();
  await expect(page.getByText('No service requests yet.', { exact: false })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
