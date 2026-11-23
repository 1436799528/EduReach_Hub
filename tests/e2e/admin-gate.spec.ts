import { expect, test, type Page } from '@playwright/test';
import { APP_ROUTE_PATHS } from '../../src/app/routePaths.generated';

/**
 * The admin console, from the only angle a test can trust without a fixture:
 * the door.
 *
 * Eighteen admin routes had no browser assertion of any kind. They are noindex
 * and the capabilities are enforced server-side (`tests/authorization.test.ts`),
 * but nothing opened them, so a route that stopped matching the router, or a
 * page that threw before its guard rendered, would have shipped unnoticed — the
 * failure mode would be a blank screen instead of a refusal.
 *
 * The e2e server runs without Supabase variables, so `/api/admin/session`
 * cannot authenticate anyone. That makes this the wrong place to test what an
 * administrator sees and exactly the right place to test what everyone else
 * sees: a refusal, in the shell, with a heading and no leaked controls.
 */

const ADMIN_ROUTES = APP_ROUTE_PATHS.filter((path) => path === '/admin' || path.startsWith('/admin/'));

/** The two honest refusals: no session at all, or a session without the role. */
const REFUSAL = /Administrator access required|Not available for your role/i;

/**
 * Wait for the refusal, and if it never comes, say what the page was showing.
 *
 * A bare "element not found" from a browser test in CI is a day of guessing: no
 * browser here, no DOM to inspect. This turns the failure into the evidence -
 * the URL it ended on, the headings that were there, the text, and any uncaught
 * error - which is what makes the difference between a guess and a fix.
 */
async function expectRefusal(page: Page, path: string, pageErrors: string[]): Promise<void> {
  try {
    await page.getByRole('heading', { level: 1, name: REFUSAL }).waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    const headings = await page.locator('h1, h2').allInnerTexts().catch(() => []);
    const body = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 320);
    throw new Error(
      [
        `${path} never showed the administrator refusal.`,
        `url=${page.url()}`,
        `headings=${JSON.stringify(headings)}`,
        `body="${body}"`,
        `pageErrors=${JSON.stringify(pageErrors)}`,
      ].join(' '),
    );
  }
}

test('the admin surface has one route per console page', () => {
  // A guard on the guard: if the router stops exposing these, the loop below
  // would pass vacuously.
  expect(ADMIN_ROUTES.length).toBeGreaterThanOrEqual(18);
  for (const expected of ['/admin', '/admin/cbt', '/admin/question-imports', '/admin/users', '/admin/site']) {
    expect(ADMIN_ROUTES).toContain(expected);
  }
});

for (const path of ADMIN_ROUTES) {
  test(`${path} refuses an anonymous visitor and renders nothing of the console`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${path} must answer 200 with the shell, not a 404`).toBe(200);

    // It must end in a refusal, not in a permanent "Verifying…" spinner and not
    // in the console.
    await expectRefusal(page, path, pageErrors);

    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.admin-loading-screen')).toHaveCount(0, {
      timeout: 15000,
    });

    // Nothing from the console may be on screen behind the refusal: no
    // navigation to other admin pages, no import controls, no publish actions.
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/Question import|Publish question|Review queue|Bulk import/i);
    await expect(page.locator('nav[aria-label*="Admin" i]')).toHaveCount(0);

    expect(pageErrors, `uncaught errors on ${path}`).toEqual([]);
  });
}
