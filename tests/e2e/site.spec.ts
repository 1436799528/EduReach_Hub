import { expect, test } from '@playwright/test';
import { annotateFailure } from './report';

// These tests exercise the built production frontend without live credentials.
// Empty/error states are expected; fabricated authentication is never accepted.
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  (page as any).runtimeErrors = errors;
});
test.afterEach(async ({ page }, testInfo) => {
  annotateFailure(testInfo);
  expect((page as any).runtimeErrors).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Page could not load', exact: true })).toHaveCount(0);
});
const publicRoutes = [
  '/', '/services', '/services/nelfund-loan', '/services/results', '/services/jamb-slip',
  '/services/admission-letters', '/services/apply/results', '/news', '/news/missing-article',
  '/jobs', '/events', '/schools', '/schools/unilag', '/schools/missing-school', '/past-questions', '/search',
  '/jamb', '/waec', '/neco', '/post-utme', '/cbt', '/cbt/setup/jamb', '/cbt/setup/waec',
  '/cbt/setup/neco', '/cbt/setup/post-utme', '/cbt/practice', '/cbt/results',
  '/screening-calculator', '/tools/cgpa-calculator', '/nabteb', '/support', '/about', '/tools', '/admission',
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
for (const path of ['/dashboard', '/dashboard/services', '/dashboard/cbt', '/dashboard/results', '/dashboard/profile', '/dashboard/tools', '/profile', '/settings', '/services/track', '/admin', '/admin/users', '/admin/cbt', '/admin/content-manager', '/admin/question-imports']) {
  test(`anonymous user cannot enter ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 10_000 });
    const password = page.getByLabel('Password', { exact: true });
    await expect(password).toBeVisible();
    await expect(password).toHaveAttribute('type', 'password');
    if (!path.startsWith('/admin')) expect(new URL(page.url()).searchParams.get('next')).toBe(path);
  });
}
test('search filters services, updates URL and follows its direct result', async ({ page }) => {
  await page.goto('/search');
  const search = page.locator('main').getByRole('search').getByRole('combobox', { name: 'Search EduReach' });
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
test('home keeps student results off the public screen and links simulators to real bank ids', async ({ page }) => {
  await page.route('**/api/cbt/exams', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      items: [{
        id: 'live-jamb-bank-42',
        title: 'JAMB UTME Practice Bank',
        exam_body: 'JAMB',
        subject: 'Multiple subjects',
        description: 'A live question bank.',
        duration_minutes: 120,
        question_count: 180,
        subject_count: 4,
      }],
    }),
  }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Latest news' })).toBeVisible();
  await expect(page.getByText('No current news yet')).toBeVisible();
  await expect(page.getByText(/Papers completed|Average score|Best score|Recent activity/)).toHaveCount(0);
  await expect(page.locator('main').getByText('Results', { exact: true })).toHaveCount(0); // navigation remains global; home content has no result link
  const bank = page.locator('.er-sim-card').filter({ hasText: 'JAMB UTME Practice Bank' });
  await expect(bank).toHaveCount(1);
  await expect(bank).toHaveAttribute('href', '/cbt/setup/jamb?exam=live-jamb-bank-42');
  await expect(page.locator('.er-sim-card')).toHaveCount(1); // no invented fallback cards
});
test('global search suggestions expose and support keyboard selection', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('combobox', { name: 'Search services and study resources' });
  await search.fill('nelfund');
  const listbox = page.getByRole('listbox', { name: 'Search suggestions' });
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole('option').first()).toBeVisible();
  await search.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant', /site-search-options-/);
  await search.press('Escape');
  await expect(listbox).toBeHidden();
});
test('search has an honest no-match state', async ({ page }) => {
  await page.goto('/search?q=zzzz-no-such-service');
  // The heading echoes the query (D/Search: an empty result says what was
  // searched and offers a next step), so the assertion is on the rule — a
  // visible heading for this query plus the offer to ask — not on the wording.
  const emptyState = page.locator('.hub-panel.hub-empty');
  await expect(emptyState.getByRole('heading')).toContainText('zzzz-no-such-service');
  await expect(emptyState.getByRole('link', { name: /Ask EduReach/ })).toBeVisible();
});
test('mobile forms and navigation meet touch-size and input-size targets', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch sizing applies to coarse-pointer devices');

  await page.goto('/login');
  for (const field of await page.locator('input:not([type="checkbox"]):not([type="radio"])').all()) {
    await expect(field).toHaveCSS('font-size', '16px');
  }

  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Open mobile menu' });
  const menuBox = await menu.boundingBox();
  expect(menuBox?.width).toBeGreaterThanOrEqual(44);
  expect(menuBox?.height).toBeGreaterThanOrEqual(44);

  const search = page.locator('main').getByRole('search').getByRole('button', { name: 'Search', exact: true });
  const searchBox = await search.boundingBox();
  expect(searchBox?.width).toBeGreaterThanOrEqual(44);
  expect(searchBox?.height).toBeGreaterThanOrEqual(44);

  const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(bottomNav).toBeVisible();
  for (const link of await bottomNav.getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  const footerClearance = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const footer = document.querySelector('footer')?.getBoundingClientRect();
    const nav = document.querySelector('.er-mobile-bottom-nav')?.getBoundingClientRect();
    return footer && nav ? nav.top - footer.bottom : null;
  });
  expect(footerClearance).not.toBeNull();
  expect(footerClearance).toBeGreaterThanOrEqual(0);
});
test('every public shell carries the same compact footer', async ({ page, isMobile }) => {
  for (const path of ['/', '/about', '/terms', '/cookies', '/contact', '/login']) {
    await page.goto(path);
    const footer = page.locator('footer.er-footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByRole('navigation', { name: 'Footer: company and policies' })).toBeVisible();
    for (const name of ['About', 'Contact', 'Terms', 'Privacy', 'Cookies', 'Cookie settings']) {
      await expect(footer.getByRole('link', { name, exact: true }).or(footer.getByRole('button', { name, exact: true }))).toBeVisible();
    }
    const height = await footer.evaluate((element) => element.getBoundingClientRect().height);
    expect(height).toBeLessThan(220);
    if (isMobile && await page.locator('.er-mobile-bottom-nav').count() > 0) {
      const clearance = await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        const bar = document.querySelector('footer.er-footer')?.getBoundingClientRect();
        const nav = document.querySelector('.er-mobile-bottom-nav')?.getBoundingClientRect();
        return bar && nav ? nav.top - bar.bottom : null;
      });
      expect(clearance).not.toBeNull();
      expect(clearance).toBeGreaterThanOrEqual(0);
    }
  }
});
test('unconfigured login fails closed and cannot create a local session', async ({ page }) => {
  await page.goto('/login');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await page.locator('input[type="email"]').fill('student@example.test');
  await page.locator('input[type="password"]').fill('test-password-123');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText('EduReach account sign-in is not available until the live account service is configured.')).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
});
test('mobile CBT simulator cards stack in one column without overlapping', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile card geometry applies to the mobile project');
  await page.route('**/api/cbt/exams', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      items: ['JAMB', 'WAEC', 'NECO', 'POST-UTME'].map((exam, index) => ({
        id: `mobile-bank-${index}`,
        title: `${exam} Sample Bank`,
        exam_body: exam,
        subject: 'Mathematics',
        description: 'Practice with subject-specific questions.',
        duration_minutes: 60,
        question_count: 40,
        subject_count: 4,
      })),
    }),
  }));
  await page.goto('/');
  const cards = page.locator('.er-sim-card');
  await expect(cards).toHaveCount(4);
  const boxes = await cards.evaluateAll((elements) => elements.map((element) => {
    const { left, right, top, bottom } = element.getBoundingClientRect();
    return { left, right, top, bottom };
  }));
  for (let index = 1; index < boxes.length; index += 1) {
    expect(Math.abs(boxes[index].left - boxes[0].left)).toBeLessThan(2);
    expect(boxes[index].top).toBeGreaterThanOrEqual(boxes[index - 1].bottom);
    expect(boxes[index].right).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  }
});
test('registration collects account essentials and only asks students for optional study context', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByLabel('First name')).toBeVisible();
  await expect(page.getByLabel('Last name')).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Phone number')).toBeVisible();
  await expect(page.getByLabel('School or institution')).toBeVisible();
  await expect(page.getByLabel('Current level')).toBeVisible();
  await expect(page.getByLabel('Course or programme')).toBeVisible();

  await expect(page.getByRole('button', { name: /Parent or guardian/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Teacher or educator/ })).toBeDisabled();
  await expect(page.getByText(/Parent and teacher accounts are not available yet/i)).toBeVisible();
  await expect(page.getByLabel('School or institution')).toBeVisible();
  await expect(page.getByLabel('Current level')).toBeVisible();
  await expect(page.getByLabel('Course or programme')).toBeVisible();
  await expect(page.getByText(/never ask for your NIN, BVN/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
});
test('navigation opens services on desktop and mobile', async ({ page, isMobile }) => {
  await page.goto('/');
  if (!isMobile) {
    // UX-7: services is a secondary destination, disclosed from the "More"
    // menu instead of competing with the five student jobs.
    await page.locator('.hub-more summary').click();
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

test('school finder has no horizontal overflow on small mobile viewports and resolves direct school slugs', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/schools');
  await expect(page.locator('h1')).toHaveText('Find your school');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.goto('/schools/unilag');
  await expect(page.locator('h1')).toContainText('University of Lagos');
});

test('core mobile routes do not overflow narrow screens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone viewport audit applies to the mobile project');
  const widths = [320, 360, 375, 390];
  const routes = ['/', '/services', '/news', '/cbt', '/past-questions', '/login'];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of routes) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      const overflow = await page.evaluate(() => Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) - window.innerWidth);
      expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});
test('home page has no horizontal overflow across common viewport widths', async ({ page }) => {
  const widths = [320, 360, 375, 390, 430, 768, 1024, 1280];
  await page.setViewportSize({ width: widths[0], height: 900 });
  await page.goto('/');
  await expect(page.locator('h1').first()).toBeVisible();

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const contentWidth = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ));
    expect(contentWidth, `home page overflows at ${width}px`).toBeLessThanOrEqual(width + 1);
  }
});
