import { expect, test, type Page } from '@playwright/test';
import { annotateFailure } from './report';

/**
 * Two surfaces, one file:
 *
 *   * the CBT simulator cards — one shared card, faint examination tint bound
 *     to the canonical exam type rather than the card's position;
 *   * the institution surface — honest empty states, no invented ownership and
 *     no verified tick for data that has not been published.
 *
 * The suite runs against the preview build (no Supabase credentials). Since the
 * Practice hub became data-driven, the browser reads the bank catalogue from
 * Supabase directly (`fetchCbtExams` in `src/lib/api.ts`); it no longer calls
 * `/api/cbt/exams`, so mocking that endpoint cannot reach the app. What the
 * preview build renders is therefore the documented contract asserted below:
 * four built-in discovery cards on the home page, each routed into its own
 * setup wizard and claiming no bank it does not have, and an explicit empty
 * state on `/cbt` rather than cards that could never start a session.
 * Catalogue-backed rendering is covered by the unit suites
 * (`tests/simulator-cards.test.ts`, `tests/simulator-card-render.test.ts`).
 *
 * The institution expectations are written to hold in the unconfigured preview,
 * where the maintained starter list is the directory — so they assert the
 * *absence* of invented facts, which is the property that matters in both modes.
 */

/** The faint surface each examination declares, as the browser reports it. */
const EXPECTED_TINTS: Record<string, string> = {
  jamb: 'rgb(244, 248, 242)',
  waec: 'rgb(242, 246, 251)',
  neco: 'rgb(249, 247, 238)',
  'post-utme': 'rgb(251, 244, 240)',
};

/** The readable title ink each examination uses on its own tint. */
const EXPECTED_INK: Record<string, string> = {
  jamb: 'rgb(23, 51, 44)',
  waec: 'rgb(27, 60, 87)',
  neco: 'rgb(64, 58, 18)',
  'post-utme': 'rgb(77, 36, 24)',
};

/**
 * The site loads Inter from Google in production. The suite stays offline and
 * deterministic by answering with an empty stylesheet instead of aborting the
 * request: an aborted request is logged as a console error, and this file
 * treats console errors as failures.
 */
async function stubFonts(page: Page) {
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  );
  await page.route('https://fonts.gstatic.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'font/woff2', body: '' }),
  );
}

async function surfaceOf(page: Page, type: string) {
  return page.locator(`.er-sim-card[data-exam-type="${type}"]`).evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, image: style.backgroundImage };
  });
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await stubFonts(page);
  (page as unknown as { runtimeErrors: string[] }).runtimeErrors = errors;
});

test.afterEach(async ({ page }, testInfo) => {
  annotateFailure(testInfo);
  expect((page as unknown as { runtimeErrors: string[] }).runtimeErrors).toEqual([]);
});

test('each simulator card keeps its own faint examination tint', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.er-sim-card')).toHaveCount(4);
  for (const type of Object.keys(EXPECTED_TINTS)) {
    const card = page.locator(`.er-sim-card[data-exam-type="${type}"]`);
    await expect(card).toHaveCount(1);

    const { background, image } = await surfaceOf(page, type);
    expect(background, `${type} keeps its faint tint`).toBe(EXPECTED_TINTS[type]);
    expect(image, `${type} is a flat surface, not a gradient`).toBe('none');

    const colour = await card.locator('.er-sim-body > strong').evaluate((element) => getComputedStyle(element).color);
    expect(colour, `${type} uses its readable title ink`).toBe(EXPECTED_INK[type]);

    const href = await card.getAttribute('href');
    expect(href, `${type} routes into its own simulator`).toBe(`/cbt/setup/${type}`);
  }
});

test('a discovery card claims no question bank the catalogue has not returned', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.er-sim-card')).toHaveCount(4);
  for (const type of Object.keys(EXPECTED_TINTS)) {
    const card = page.locator(`.er-sim-card[data-exam-type="${type}"]`);
    // The built-in card names a timed practice session, not a bank, and carries
    // no bank id: an id here would send the wizard looking for a bank that this
    // build has never seen.
    await expect(card).toContainText('Timed practice');
    await expect(card).not.toContainText(/question bank/i);
    expect(await card.getAttribute('href'), `${type} carries no invented bank id`).not.toContain('exam=');
  }
});

test('the simulator cards stay inside a narrow phone viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.locator('.er-sim-card').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    );
    expect(overflow, `simulator cards overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
  for (const [type, tint] of Object.entries(EXPECTED_TINTS)) {
    const { background, image } = await surfaceOf(page, type);
    expect(background, `${type} keeps its tint on a phone`).toBe(tint);
    expect(image, `${type} stays flat on a phone`).toBe('none');
  }
});

test('the public Practice page explains an empty catalogue instead of inventing cards', async ({ page }) => {
  await page.goto('/cbt');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(/practice/i);
  // Results, history and statistics belong to the signed-in dashboard.
  await expect(page.getByText(/practice history|your results|average score/i)).toHaveCount(0);
  await expect(page.locator('.er-bank-card')).toHaveCount(0);
  // No published catalogue in this build: the page says so. Four cards here
  // would be four setup screens that cannot start a session.
  await expect(page.locator('.er-sim-card')).toHaveCount(0);
  await expect(page.getByText('No active public question banks are connected right now.')).toBeVisible();
});

test('news cards keep their own tone system', async ({ page }) => {
  await page.goto('/news');
  const cards = page.locator('.er-news-card');
  if ((await cards.count()) === 0) {
    await expect(page.getByText(/No news content available yet|No current news/i)).toBeVisible();
    return;
  }
  const backgrounds = await cards.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).backgroundColor),
  );
  for (const background of backgrounds) {
    expect(Object.values(EXPECTED_TINTS), 'a news card never borrows a simulator tint').not.toContain(background);
  }
});

test('the finder claims no ownership and no verification it does not have', async ({ page }) => {
  await page.goto('/schools');
  await expect(page.locator('h1')).toHaveText('Find your school');
  await expect(page.locator('.school-finder-result-card').first()).toBeVisible();

  // Ownership is not published for any institution yet, so no pill appears and
  // the ownership filter offers nothing to select.
  await expect(page.locator('.er-ownership-badge')).toHaveCount(0);
  await expect(page.locator('.er-trust--verified')).toHaveCount(0);

  const empty = await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Search for a school"]') as HTMLInputElement | null;
    return Boolean(input);
  });
  expect(empty, 'the search field is present').toBe(true);

  await page.fill('input[aria-label="Search for a school"]', 'zzzz-no-such-school');
  await expect(page.getByRole('heading', { name: 'No school found' })).toBeVisible();
});

test('the finder has no horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/schools');
  await expect(page.locator('h1')).toHaveText('Find your school');
  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('an institution detail page states what it does not have instead of guessing it', async ({ page }) => {
  await page.goto('/schools/university-of-calabar');
  await expect(page.locator('h1')).toContainText('Calabar');
  await expect(page.getByText('No official website recorded for this institution')).toBeVisible();
  await expect(page.getByRole('link', { name: /Request the verified link/ })).toBeVisible();
  // Unpublished intelligence is named once rather than left blank.
  await expect(page.getByRole('heading', { name: /Not published for this institution yet/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
