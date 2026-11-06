import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { capabilitiesForRole } from '../../src/lib/capabilities';

// Isolated browser fixture: no real account, Supabase connection or database.
// The production build uses the unconfigured Supabase fallback in this suite;
// API responses and the local auth session below exist only inside this page.
async function mockAdmin(page: Page, options: { analyticsFails?: boolean; capabilities?: string[] } = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
      access_token: 'isolated-test-token', refresh_token: 'isolated-test-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: 'isolated-test-user', aud: 'authenticated', email: 'operator@example.test', app_metadata: {}, user_metadata: {} },
    }));
  });
  await page.route('**/edureach-unconfigured.supabase.co/**', (route) => route.abort());
  await page.route('**/admin/session', (route) => route.fulfill({ json: { user: {
    id: 'isolated-test-user', email: 'operator@example.test', fullName: 'Test Operator', role: 'super_admin',
    capabilities: options.capabilities ?? [...capabilitiesForRole('super_admin')],
  } } }));
  await page.route('**/admin/analytics', (route) => options.analyticsFails
    ? route.fulfill({ status: 503, json: { error: 'Analytics unavailable' } })
    : route.fulfill({ json: { metrics: { pending_requests: 0, service_requests: 0, users: 0, admins: 0, events_24h: 0, sessions_24h: 0, events_7d: 0, completed_requests: 0, rejected_requests: 0, cbt_attempts: 0, cbt_submitted: 0, average_cbt_score: 0, published_news: 0, institutions: 0, active_services: 0 }, activity: null, audit: [], recentRequests: [], recentUsers: [] } }));
  await page.route('**/admin/service-requests?*', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/admin/news?*', (route) => route.fulfill({ json: { items: [], page: 1, hasMore: false } }));
}

test('admin shell adapts at narrow, tablet and desktop widths without losing navigation', async ({ page }) => {
  await mockAdmin(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Operations Control' })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open admin menu' });
  const nav = page.getByRole('navigation', { name: 'Administration' });
  await expect(nav).toBeHidden();
  await menu.click();
  await expect(page.getByRole('button', { name: 'Close admin menu' })).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.getByRole('link', { name: 'Newsroom CMS' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(menu).toBeFocused();
  await menu.click();
  await nav.getByRole('link', { name: 'Newsroom CMS' }).click();
  await expect(page.getByRole('heading', { name: 'Newsroom CMS' })).toBeVisible();
  await expect(nav).toBeHidden();
  await menu.click();
  await expect(nav.getByRole('link', { name: 'Newsroom CMS' })).toHaveAttribute('aria-current', 'page');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expect(page.getByRole('button', { name: /admin menu/i })).toBeHidden();
  await expect(nav.getByRole('link', { name: 'Newsroom CMS' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('dashboard failure does not present invented zero metrics or a clear queue', async ({ page }) => {
  await mockAdmin(page, { analyticsFails: true });
  await page.goto('/admin');
  await expect(page.getByRole('alert')).toContainText(/unavailable|unable/i);
  await expect(page.getByText('Active Queue', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Queue is clear. No active service requests.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Process Queue/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('navigation continues to respect server-provided capabilities', async ({ page }) => {
  await mockAdmin(page, { capabilities: ['news.read'] });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Operations Control' })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open admin menu' });
  if (await menu.isVisible()) await menu.click();
  const nav = page.getByRole('navigation', { name: 'Administration' });
  await expect(nav.getByRole('link', { name: 'Newsroom CMS' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Student Accounts' })).toHaveCount(0);
});

test('rendered mocked admin shell has no axe WCAG A/AA violations', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Operations Control' })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open admin menu' });
  if (await menu.isVisible()) await menu.click();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

test('queue load failure is not shown as an empty queue and recovers on retry', async ({ page }) => {
  await mockAdmin(page);
  let attempts = 0;
  await page.route('**/admin/service-requests?*', route => {
    attempts++;
    return attempts === 1
      ? route.fulfill({ status: 503, json: { error: 'Unable to load service queue.' } })
      : route.fulfill({ json: { items: [] } });
  });
  await page.goto('/admin/queue');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('alert')).toContainText(/unable to load/i);
  await expect(page.getByText('No matching service requests.')).toHaveCount(0);
  await expect(page.getByText('0 requests', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Unavailable', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('No matching service requests.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('an ambiguous service update requires a refresh before another action', async ({ page }) => {
  await mockAdmin(page);
  let patches = 0;
  let reads = 0;
  const row = { id: 'request-1', user_id: 'student-1', status: 'submitted', form_data: {}, admin_note: null, reference_code: 'ER-TEST', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', service_catalog: { title: 'Test service' } };
  await page.route('**/admin/service-requests?*', route => {
    reads++;
    return route.fulfill({ json: { items: [reads === 1 ? row : { ...row, status: 'reviewing', updated_at: '2026-01-01T00:00:01Z' }] } });
  });
  await page.route('**/admin/service-requests/request-1', route => {
    patches++;
    return route.fulfill({ status: 503, json: { error: 'Unable to confirm the update. Refresh the queue before retrying.' } });
  });
  await page.goto('/admin/queue');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/confirm.*refresh/i);
  await expect(page.getByRole('button', { name: 'Review', exact: true })).toBeDisabled();
  expect(patches).toBe(1);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('reviewing', { exact: true })).toBeVisible();
  expect(patches).toBe(1);
});

test('service action buttons match the server transition rules', async ({ page }) => {
  await mockAdmin(page);
  const base = { user_id: 'student-1', form_data: {}, admin_note: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', service_catalog: { title: 'Test service' } };
  await page.route('**/admin/service-requests?*', route => route.fulfill({ json: { items: [
    { ...base, id: 'request-submitted', status: 'submitted', reference_code: 'SUBMITTED' },
    { ...base, id: 'request-waiting', status: 'awaiting_information', reference_code: 'WAITING' },
  ] } }));
  await page.goto('/admin/queue');
  const submitted = page.getByRole('row').filter({ hasText: 'SUBMITTED' });
  const waiting = page.getByRole('row').filter({ hasText: 'WAITING' });
  await expect(submitted.getByRole('button', { name: 'Review', exact: true })).toBeVisible();
  await expect(submitted.getByRole('button', { name: 'Complete', exact: true })).toHaveCount(0);
  await expect(waiting.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0);
  await expect(waiting.getByRole('button', { name: 'Review', exact: true })).toBeVisible();
  await expect(waiting.getByRole('button', { name: 'Process', exact: true })).toBeVisible();
});
