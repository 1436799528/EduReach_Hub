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
 * The e2e server runs without Supabase variables, so no administrator can be
 * verified. That makes this the wrong place to test what an administrator sees
 * and exactly the right place to test what everyone else sees. The console has
 * two honest answers for an anonymous visitor, and both are covered here:
 *
 *   - it refuses in place ("Administrator access required"), which is what the
 *     shell renders while it decides; or
 *   - it navigates to `/login?next=<the page it was asked for>`, which is what
 *     `AdminLayout` does once verification fails, so the destination survives
 *     the sign-in.
 *
 * Either way: one heading, no console navigation, no import or publish control,
 * and no uncaught error. What must never happen is the console itself.
 */

const ADMIN_ROUTES = APP_ROUTE_PATHS.filter((path) => path === '/admin' || path.startsWith('/admin/'));

/** The two honest refusals: no session at all, or a session without the role. */
const REFUSAL = /Administrator access required|Not available for your role/i;

type Outcome = 'refusal' | 'sign-in' | 'waiting';

/**
 * Wait for whichever refusal the console gives, and if neither comes, say what
 * the page was showing.
 *
 * A bare "element not found" from a browser test in CI is a day of guessing: no
 * browser here, no DOM to inspect. This turns a failure into the evidence — the
 * URL it ended on, the headings that were there, the text, and any uncaught
 * error.
 */
async function settle(page: Page, path: string, pageErrors: string[]): Promise<Outcome> {
  try {
    await expect
      .poll<Outcome>(
        async () => {
          if (new URL(page.url()).pathname === '/login') return 'sign-in';
          if (await page.getByRole('heading', { level: 1, name: REFUSAL }).isVisible().catch(() => false)) return 'refusal';
          return 'waiting';
        },
        { timeout: 20000, message: `${path} neither refused in place nor asked for a sign-in` },
      )
      .not.toBe('waiting');
  } catch {
    const headings = await page.locator('h1, h2').allInnerTexts().catch(() => []);
    const body = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 320);
    throw new Error(
      [
        `${path} neither refused in place nor asked for a sign-in.`,
        `url=${page.url()}`,
        `headings=${JSON.stringify(headings)}`,
        `body="${body}"`,
        `pageErrors=${JSON.stringify(pageErrors)}`,
      ].join(' '),
    );
  }
  return new URL(page.url()).pathname === '/login' ? 'sign-in' : 'refusal';
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

    const outcome = await settle(page, path, pageErrors);

    // It must never sit on the verification spinner.
    await expect(page.locator('.admin-loading-screen')).toHaveCount(0);

    if (outcome === 'sign-in') {
      // The destination must survive, or signing in lands the administrator on
      // the wrong page for the rest of the session.
      const next = new URL(page.url()).searchParams.get('next');
      expect(next, `${path} must remember where the visitor was going`).toBe(path);
    }

    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);

    // Nothing from the console may be on screen behind the refusal: no
    // navigation to other admin pages, no import controls, no publish actions.
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/Question import|Publish question|Review queue|Bulk import/i);
    await expect(page.locator('nav[aria-label*="Admin" i]')).toHaveCount(0);

    expect(pageErrors, `uncaught errors on ${path}`).toEqual([]);
  });
}
