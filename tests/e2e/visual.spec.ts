import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * Visual regression, on demand.
 *
 * Nothing in this repository compared a page to what it looked like before, so a
 * stylesheet change was reviewed by eye or not at all — the FAQ re-layout in
 * this branch was checked that way.
 *
 * Baselines are not committed yet, and this file skips itself until they are:
 * a snapshot test that silently rewrites its own baseline is worse than no
 * snapshot test. To start enforcing it:
 *
 *   npm ci && npx playwright install chromium
 *   npm run visual:baseline          # writes tests/e2e/visual.spec.ts-snapshots/*.png
 *   git add tests/e2e/visual.spec.ts-snapshots && git commit
 *
 * After that, `npm run test:e2e` fails on a diff larger than 1% of pixels.
 * Regenerate deliberately with `npm run visual:baseline` and read the diff —
 * never accept a baseline without looking at what changed.
 *
 * Cross-origin requests are aborted so a remote photograph or font cannot make
 * the same page render differently on two machines.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = join(here, 'visual.spec.ts-snapshots');
const HAVE_BASELINES = existsSync(SNAPSHOT_DIR);

const PAGES = ['/', '/faq', '/news', '/scholarships', '/reviews', '/past-questions', '/login', '/about'] as const;
const WIDTHS = [360, 768, 1280] as const;

test.skip(
  !HAVE_BASELINES,
  'no visual baselines yet — run `npm run visual:baseline` and commit tests/e2e/visual.spec.ts-snapshots',
);

function slug(path: string): string {
  return path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-');
}

for (const path of PAGES) {
  for (const width of WIDTHS) {
    test(`${path} looks the same at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
      await page.goto(path, { waitUntil: 'load' });

      // The marquee and the skeleton shimmer are animations by design; a
      // baseline must not depend on which frame was captured.
      await page.addStyleTag({
        content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
      });

      await expect(page).toHaveScreenshot(`${slug(path)}-${width}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
        caret: 'hide',
      });
    });
  }
}
