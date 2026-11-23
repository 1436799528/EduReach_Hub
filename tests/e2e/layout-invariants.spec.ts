import { expect, test } from '@playwright/test';

/**
 * Layout assertions that need no baseline image.
 *
 * A screenshot diff needs a stored PNG and a person to accept it. These checks
 * need neither and still catch the regressions that matter at this level: a
 * two-column help centre that silently became one column, a rail that stopped
 * being sticky, a topic list that stopped stacking, and the homepage block
 * drifting away from the page it mirrors.
 *
 * They are deliberately about computed layout, not pixels: a colour change or a
 * new icon does not fail them.
 */

const FAQ_FIXTURE = {
  categories: [
    {
      id: 'general',
      label: 'General questions',
      description: 'What EduReach Hub is and how to reach a person.',
      questions: [
        { id: 'q1', question: 'What is EduReach Hub?', answer: 'A Nigerian study platform for CBT practice and student services.' },
        { id: 'q2', question: 'How do I contact support?', answer: 'Use the contact page or the details in the footer.' },
      ],
    },
    {
      id: 'cbt',
      label: 'CBT simulators',
      description: 'Timed practice, scoring and papers.',
      questions: [
        { id: 'q3', question: 'How does the simulator work?', answer: 'Pick an exam body, then your subjects, then start a paper.' },
      ],
    },
  ],
};

/** The homepage block only renders once it has categories, so give it some. */
async function mockFaqs(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/faqs', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAQ_FIXTURE) }),
  );
}

async function columnsOf(page: import('@playwright/test').Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((element) => {
    const template = getComputedStyle(element).gridTemplateColumns;
    return template.split(' ').filter((value) => value.trim().length > 0 && value !== 'none').length;
  });
}

test.describe('help centre', () => {
  test('is two columns on a desktop, with the rail staying in view', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/faq', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.er-faq-layout')).toBeVisible();
    expect(await columnsOf(page, '.er-faq-layout')).toBe(2);

    const rail = page.locator('.er-faq-aside');
    expect(await rail.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');

    // The topic list is a stack, not a row, while it lives in the rail.
    expect(
      await page.locator('.er-faq-topics').evaluate((element) => getComputedStyle(element).flexDirection),
    ).toBe('column');
  });

  test('is one column on a phone, with the topics scrolled sideways above the questions', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/faq', { waitUntil: 'domcontentloaded' });

    expect(await columnsOf(page, '.er-faq-layout')).toBe(1);
    expect(await page.locator('.er-faq-aside').evaluate((element) => getComputedStyle(element).position)).toBe(
      'static',
    );
    expect(
      await page.locator('.er-faq-topics').evaluate((element) => getComputedStyle(element).flexDirection),
    ).toBe('row');
  });

  test('picking a topic replaces the questions instead of scrolling past them', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/faq', { waitUntil: 'domcontentloaded' });

    const topics = page.locator('.er-faq-topic');
    // Wait for the rail to render before counting: `count()` does not retry, and
    // the first version of this test read 0 topics from a page that was still
    // hydrating.
    await expect(topics.first()).toBeVisible();
    const count = await topics.count();
    expect(count, 'the rail lists every topic plus "All questions"').toBeGreaterThan(2);

    const second = topics.nth(1);
    const label = (await second.innerText()).trim();
    await second.click();
    await expect(second).toHaveAttribute('aria-current', 'true');

    // One topic on screen: its heading is the only group heading rendered.
    await expect(page.locator('.er-faq-group-head h2')).toHaveCount(1);
    expect(label.length).toBeGreaterThan(0);
  });
});

test.describe('homepage FAQ block', () => {
  test('uses the same two-column shape on a desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await mockFaqs(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const block = page.locator('.er-home-faq-layout');
    await expect(block).toBeVisible();
    expect(await columnsOf(page, '.er-home-faq-layout')).toBe(2);
  });

  test('collapses to one column on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockFaqs(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.er-home-faq-layout')).toBeVisible();
    expect(await columnsOf(page, '.er-home-faq-layout')).toBe(1);
  });
});
