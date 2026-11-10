import { expect, test } from '@playwright/test';

// Requires a synthetic configured build. All Supabase calls are intercepted;
// this never reaches hosted Auth or a real student account.
test.skip(process.env.RUN_CONFIGURED_SERVICE_TESTS !== '1', 'requires the separately built configured-client fixture');

test('student service drafts stay private across account switches in one tab', async ({ page }) => {
  const token = (id: string) => JSON.stringify({
    access_token: `isolated-${id}`, refresh_token: 'isolated-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600, token_type: 'bearer', user: { id, aud: 'authenticated', email: `${id}@example.test`, app_metadata: {}, user_metadata: {} },
  });
  let account = 'student-a';
  await page.addInitScript((initialToken) => {
    if (!sessionStorage.getItem('fixture-initialized')) {
      sessionStorage.setItem('fixture-initialized', 'yes');
      sessionStorage.setItem('edureach-service-draft-results', JSON.stringify({ step: 1, form: { fullName: 'Legacy Former Student' } }));
      localStorage.setItem('sb-student-fixture-auth-token', initialToken);
    }
  }, token(account));
  await page.route('https://student-fixture.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/v1/user') return route.fulfill({ json: { id: account, aud: 'authenticated', email: `${account}@example.test`, app_metadata: {}, user_metadata: {} } });
    if (path === '/rest/v1/service_catalog') return route.fulfill({ json: { id: 'service-id', service_key: 'results', title: 'Results', description: 'Synthetic', active: true, application_url: null } });
    if (path === '/rest/v1/profiles') return route.fulfill({ json: null });
    return route.fulfill({ json: [] });
  });
  await page.route('**/api/admin/session', route => route.fulfill({ status: 403, json: { error: 'Permission denied' } }));
  await page.goto('/services/apply/results');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  const name = page.getByLabel('Full Name *');
  await expect(name).toBeVisible();
  await expect(name).toHaveValue('');
  await name.fill('Synthetic Student A');
  await expect.poll(() => page.evaluate(() => Object.values(sessionStorage).some(value => value.includes('Synthetic Student A')))).toBe(true);

  account = 'student-b';
  await page.evaluate((nextToken) => {
    localStorage.setItem('sb-student-fixture-auth-token', nextToken);
    window.dispatchEvent(new Event('edureach-auth-changed'));
  }, token(account));
  await expect(name).toBeVisible();
  await expect(name).toHaveValue('');
  await name.fill('Synthetic Student B');
  await expect.poll(() => page.evaluate(() => Object.values(sessionStorage).some(value => value.includes('Synthetic Student B')))).toBe(true);
  await page.reload();
  await expect(name).toHaveValue('Synthetic Student B');

  account = 'student-a';
  await page.evaluate((nextToken) => localStorage.setItem('sb-student-fixture-auth-token', nextToken), token(account));
  await page.reload();
  await expect(name).toHaveValue('Synthetic Student A');
  expect(await page.evaluate(() => sessionStorage.getItem('edureach-service-draft-results'))).toContain('Legacy Former Student');
});
