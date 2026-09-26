import { expect, test } from '@playwright/test';

// These tests exercise the built production frontend without live credentials.
// Empty/error states are expected; fabricated authentication is never accepted.
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  (page as any).runtimeErrors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as any).runtimeErrors).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Page could not load', exact: true })).toHaveCount(0);
});
const publicRoutes = [
  '/', '/services', '/services/nelfund-loan', '/services/results', '/services/jamb-slip',
  '/services/admission-letters', '/services/apply/results', '/news', '/news/missing-article',
  '/jobs', '/events', '/schools', '/schools/missing-school', '/past-questions', '/search',
  '/jamb', '/waec', '/neco', '/post-utme', '/cbt', '/cbt/setup/jamb', '/cbt/setup/waec',
  '/cbt/setup/neco', '/cbt/setup/post-utme', '/cbt/practice', '/cbt/results',
  '/screening-calculator', '/nabteb', '/support', '/tools', '/admission',
  '/login', '/register', '/forgot-password', '/reset-password', '/verify-email',
];
for (const path of publicRoutes) {
  test(`direct route renders: ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page Not Found', exact: true })).toHaveCount(0);
    await expect(page).toHaveTitle(/EduReach/);
  });
}
for (const path of ['/not-a-page', '/news/%E0%A4%A', '/schools/%invalid', '/services/%']) {
  test(`unknown or malformed route fails safely: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
  });
}
for (const path of ['/dashboard', '/dashboard/services', '/dashboard/cbt', '/dashboard/cbt/results', '/dashboard/tools', '/profile', '/settings', '/services/track', '/admin', '/admin/users', '/admin/cbt', '/admin/content-manager']) {
  test(`anonymous user cannot enter ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.locator('input[type="password"]')).toBeVisible();
    if (!path.startsWith('/admin')) expect(new URL(page.url()).searchParams.get('next')).toBe(path);
  });
}
test('search filters services, updates URL and follows its direct result', async ({ page }) => {
  await page.goto('/search');
  const search = page.locator('main').getByRole('search').getByRole('textbox', { name: 'Search EduReach' });
  await search.fill('nelfund');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=nelfund$/);
  const result = page.locator('.er-search-result').filter({ hasText: 'NELFUND' }).first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/nelfund$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/search\?q=nelfund$/);
  await expect(search).toHaveValue('nelfund');
  await page.goForward();
  await expect(page).toHaveURL(/\/nelfund$/);
});
test('search has an honest no-match state', async ({ page }) => {
  await page.goto('/search?q=zzzz-no-such-service');
  await expect(page.getByRole('heading', { name: 'No matching result' })).toBeVisible();
});
test('unconfigured login fails closed and cannot create a local session', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('student@example.test');
  await page.locator('input[type="password"]').fill('test-password-123');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText('EduReach account sign-in is not available until the live account service is configured.')).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
});
test('navigation opens services on desktop and mobile', async ({ page, isMobile }) => {
  await page.goto('/');
  if (!isMobile) {
    await page.locator('header nav a[href="/services"]').click();
    await expect(page).toHaveURL(/\/services$/);
    return;
  }
  await page.getByRole('button', { name: 'Open mobile menu' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('a[href="/services"]').click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('production serves actual assets and security headers', async ({ page, request }) => {
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  const assets = await page.locator('script[src],link[rel="stylesheet"]').evaluateAll(elements => elements.map(element => element.getAttribute('src') || element.getAttribute('href')));
  for (const asset of assets) {
    if (!asset?.startsWith('/assets/')) continue;
    const response = await request.get(asset);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).not.toContain('text/html');
  }
});

test('server build and source map are not public assets', async ({ request }) => {
  for (const path of ['/server.cjs', '/server.cjs.map', '/build/server.cjs']) {
    const response = await request.get(path);
    const body = await response.text();
    expect(body).not.toContain('getServerSupabaseKey');
    expect(body).not.toContain('sourcesContent');
  }
});
