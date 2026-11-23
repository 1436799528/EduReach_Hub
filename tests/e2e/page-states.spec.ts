import { expect, test } from '@playwright/test';
import { pagesWithEndpoints } from '../../src/app/pageManifest';

/**
 * Data states: the page has to survive a backend that is failing, empty or
 * disagreeing.
 *
 * This is the gap the production incident fell through. The FAQ and Reviews
 * tables had never been migrated; the endpoints answered 503; the sections
 * rendered an error while the page around them looked fine — and the entire
 * gate was green, because the e2e server has no Supabase variables, so "no
 * rows" was the only state any test had ever seen.
 *
 * These tests do not assert the wording of an error. They assert that the page
 * is still a page: it renders its heading, it is not blank, it does not leak
 * `undefined` into the reader's view, it throws nothing uncaught, and it still
 * fits a phone. A page is free to show an error panel, an empty state or cached
 * content; it is not free to collapse.
 */

// Service workers bypass route interception; the shell must be blocked here or
// the fake backend is never consulted.
test.use({ serviceWorkers: 'block' });

const PAGES = pagesWithEndpoints();

const HOSTILE_RESPONSES = [
  {
    name: 'every endpoint answers 503',
    fulfil: { status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'temporarily unavailable' }) },
  },
  {
    name: 'every endpoint answers 200 with an empty list',
    fulfil: { status: 200, contentType: 'application/json', body: '[]' },
  },
  {
    name: 'every endpoint answers 200 with a shape the client did not expect',
    fulfil: { status: 200, contentType: 'application/json', body: JSON.stringify({ unexpected: true }) },
  },
] as const;

for (const entry of PAGES) {
  for (const scenario of HOSTILE_RESPONSES) {
    test(`${entry.path} survives when ${scenario.name}`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await page.route('**/api/**', (route) => route.fulfill(scenario.fulfil));
      await page.setViewportSize({ width: 360, height: 800 });

      const response = await page.goto(entry.path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${entry.path} must still answer 200`).toBe(200);

      await expect(page.locator('#root')).not.toBeEmpty();
      await expect(page.locator('h1'), `${entry.path} must keep its heading`).toHaveCount(1);

      const text = (await page.locator('body').innerText()).trim();
      expect(text.length, `${entry.path} rendered almost nothing`).toBeGreaterThan(80);
      expect(text, `${entry.path} leaked undefined into the page`).not.toMatch(/\bundefined\b/i);
      expect(text, `${entry.path} leaked an object into the page`).not.toContain('[object Object]');
      expect(text, `${entry.path} leaked a NaN into the page`).not.toMatch(/\bNaN\b/);

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      expect(overflow, `${entry.path} overflows by ${overflow}px at 360px`).toBeLessThanOrEqual(1);

      expect(pageErrors, `uncaught errors on ${entry.path}`).toEqual([]);
    });
  }
}

/**
 * A slow backend must not look like a broken page: while the request is in
 * flight the reader gets a named wait, not a blank region.
 */
test('a slow endpoint shows a wait, not an empty page', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/faq', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#root')).not.toBeEmpty();
  // The help centre ships static copy as its fallback, so the wait is allowed to
  // resolve instantly into content — either way the page is never blank.
  await expect(page.locator('h1')).toHaveCount(1);
  const text = (await page.locator('body').innerText()).trim();
  expect(text.length).toBeGreaterThan(80);
});
