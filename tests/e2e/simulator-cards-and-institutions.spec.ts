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
 * The bank catalogue is mocked because these assertions are about the
 * frontend's behaviour, not about which banks happen to be published today.
 * The institution expectations are written to hold in the unconfigured preview
 * the suite runs in (no Supabase credentials), where the maintained starter
 * list is the directory — so they assert the *absence* of invented facts, which
 * is the property that matters in both modes.
 */

const BANKS = [
  { id: 'bank-waec', title: 'WAEC SSCE Practice Bank', exam_body: 'WAEC', subject: 'Mathematics', description: 'A live WAEC bank.', duration_minutes: 60, question_count: 40, subject_count: 4 },
  { id: 'bank-jamb', title: 'JAMB UTME Practice Bank', exam_body: 'JAMB', subject: 'Multiple subjects', description: 'A live JAMB bank.', duration_minutes: 120, question_count: 180, subject_count: 4 },
  { id: 'bank-post', title: 'Post-UTME Practice Bank', exam_body: 'POST-UTME', subject: 'General', description: 'A live Post-UTME bank.', duration_minutes: 45, question_count: 30, subject_count: 3 },
  { id: 'bank-neco', title: 'NECO SSCE Practice Bank', exam_body: 'NECO', subject: 'English Language', description: 'A live NECO bank.', duration_minutes: 60, question_count: 40, subject_count: 4 },
];

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

async function mockBanks(page: Page, items: typeof BANKS = BANKS) {
  await page.route('**/api/cbt/exams*', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items }) }),
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
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  (page as unknown as { runtimeErrors: string[] }).runtimeErrors = errors;
});

test.afterEach(async ({ page }, testInfo) => {
  annotateFailure(testInfo);
  expect((page as unknown as { runtimeErrors: string[] }).runtimeErrors).toEqual([]);
});

test('each simulator card keeps its own faint examination tint', async ({ page }) => {
  await mockBanks(page);
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
    expect(href, `${type} still routes into its own simulator`).toBeTruthy();
  }
});

test('the tints survive a re-ordered catalogue', async ({ page }) => {
  await mockBanks(page, [...BANKS].reverse());
  await page.goto('/');
  await expect(page.locator('.er-sim-card')).toHaveCount(4);
  for (const [type, tint] of Object.entries(EXPECTED_TINTS)) {
    const { background } = await surfaceOf(page, type);
    expect(background, `${type} is tinted by its exam type, not its position`).toBe(tint);
  }
});

test('the simulator cards stay inside a narrow phone viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await mockBanks(page);
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

test('the public Practice page shows the same simulator cards and no history', async ({ page }) => {
  await mockBanks(page);
  await page.goto('/cbt');

  await expect(page.locator('.er-sim-card')).toHaveCount(4);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/practice/i);
  // Results, history and statistics belong to the signed-in dashboard.
  await expect(page.getByText(/practice history|your results|average score/i)).toHaveCount(0);
  await expect(page.locator('.er-bank-card')).toHaveCount(0);
});

test('news cards keep their own tone system', async ({ page }) => {
  await mockBanks(page);
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
