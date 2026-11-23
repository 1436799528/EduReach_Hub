import { expect, test } from '@playwright/test';
import { fullCoveragePages } from '../../src/app/pageManifest';

/**
 * Route coverage, generated from `src/app/pageManifest.ts`.
 *
 * The axe spec names thirteen routes by hand and the performance spec names
 * three. Nothing opened the rest, which is how the FAQ and Reviews sections
 * shipped broken while the gate was green: the tables were missing, the
 * sections rendered an error, and no test ever loaded those pages.
 *
 * These are the assertions every declared page must survive, on both the
 * desktop and the mobile project:
 *
 * - the response is a 200, not the shell with an error;
 * - the root is not empty, so a page that threw during render fails;
 * - exactly one `h1`, so a page has a findable subject;
 * - a document title that names the site, so a shared link is not anonymous;
 * - no uncaught page error;
 * - no 4xx on a hashed asset, so a stale or missing chunk fails.
 *
 * Deliberately not asserted here: that data is on screen. The e2e server runs
 * with the Supabase variables emptied, so "no rows" is the honest state; the
 * post-deploy crawl (`npm run smoke -- <url> --pages`) is what proves the data
 * path against a real backend.
 */

const PAGES = fullCoveragePages();

for (const entry of PAGES) {
  test(`${entry.path} (${entry.name}) renders as a real page`, async ({ page }) => {
    const pageErrors: string[] = [];
    const failedAssets: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/assets/') && response.status() >= 400) {
        failedAssets.push(`${response.status()} ${url}`);
      }
    });

    const response = await page.goto(entry.path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${entry.path} must answer 200`).toBe(200);

    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);

    expect((await page.title()).trim(), `${entry.path} must name the site in its title`).toContain('EduReach Hub');

    for (const landmark of entry.landmarks ?? []) {
      await expect(page.locator(landmark).first(), `${entry.path} must render ${landmark}`).toBeVisible();
    }

    expect(pageErrors, `uncaught errors on ${entry.path}`).toEqual([]);
    expect(failedAssets, `failed assets on ${entry.path}`).toEqual([]);
  });
}

/**
 * Layout invariants.
 *
 * A page that scrolls sideways on a phone is broken in a way no functional test
 * notices and no console error reports. Three widths is enough to catch the
 * usual causes: a fixed width that never shrinks, a grid with a min-content
 * track, an image without `max-width`.
 */
const WIDTHS = [320, 768, 1440];
const OVERFLOW_SAFE = PAGES.filter((entry) => entry.overflowSafe);

for (const entry of OVERFLOW_SAFE) {
  test.describe(`${entry.path} keeps its width`, () => {
    for (const width of WIDTHS) {
      test(`no horizontal scroll at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(entry.path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('#root')).not.toBeEmpty();

        // The document must fit its own viewport. One pixel of rounding slack;
        // anything more is content the reader cannot reach without panning.
        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          return root.scrollWidth - root.clientWidth;
        });
        expect(overflow, `${entry.path} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(1);
      });
    }
  });
}
