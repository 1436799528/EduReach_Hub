import AxeBuilder from '@axe-core/playwright';
import type { AxeResults } from 'axe-core';
import { expect, test, type Page } from '@playwright/test';

// A11Y-1: the rendered-page half of the verification.
//
// tests/a11y.test.ts proves the posture in source; this proves it in a browser
// running the production build. It covers the public routes an anonymous
// visitor can reach — the admin console needs credentials, which this suite
// deliberately does not have (see the limitation in docs/features/A11Y-1.md;
// admin markup is covered by the static rules instead).
//
// No rule is disabled and no violation is downgraded: a failure here is a real
// failure, and the report prints the rule, the node count and the first
// selector so the fix is obvious from the CI log alone.

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// A red gate must say what broke. GitHub turns `::error::` lines into
// annotations on the check run, so a failing test names its own rule and node
// instead of making the reviewer open a log — and in an environment where the
// browser cannot be installed, the annotation is the only channel back.
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  if (testInfo.title.startsWith('axe:')) return; // the aggregate report below is more useful
  const detail = testInfo.errors
    .map((error) => error.message ?? String(error))
    .join(' | ')
    .replace(/\s+/g, ' ')
    .slice(0, 900);
  console.log(`::error title=e2e a11y::${testInfo.title} — ${detail}`);
});

/**
 * Every failing node, once. axe reports one rule with N nodes per page, and the
 * same node usually fails on several pages; the aggregate is what makes a
 * palette decision possible from the check run alone.
 */
const axeReport = new Map<string, Set<string>>();
test.afterAll(() => {
  if (axeReport.size === 0) return;
  const lines = [...axeReport.entries()].map(([detail, routes]) => `${[...routes].join(',')} → ${detail}`);
  console.log(`::error title=axe report (${lines.length} distinct)::${lines.join(' || ').slice(0, 12000)}`);
});

/** Public routes: the five flows the product is for, plus the entry points. */
const ROUTES = [
  '/',
  '/services',
  '/services/apply/results',
  '/news',
  '/jobs',
  '/schools',
  '/past-questions',
  '/search',
  '/cbt',
  '/cbt/setup/jamb',
  '/login',
  '/register',
  '/support',
];

async function collect(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return { violations: results.violations, summary: summarise(results.violations) };
}

function summarise(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']): string[] {
  return violations.map(
    (violation) =>
      `${violation.id} [${violation.impact}] x${violation.nodes.length} ${violation.nodes[0]?.target?.join(' ')}`.trim(),
  );
}

/**
 * axe reports one violation with many nodes. For a colour failure the useful
 * detail is which element, on which background, at what ratio — so emit that:
 * the next person fixes the palette instead of hunting for the node.
 */
function annotateViolations(route: string, violations: AxeResults['violations']) {
  for (const violation of violations) {
    for (const node of violation.nodes) {
      const data = node.any?.[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
      const colour = data?.contrastRatio ? ` [${data.fgColor} on ${data.bgColor} = ${data.contrastRatio}:1]` : '';
      const detail = `${violation.id}: ${node.target.join(' ')}${colour}`;
      const routes = axeReport.get(detail) ?? new Set<string>();
      routes.add(route);
      axeReport.set(detail, routes);
    }
  }
}

for (const route of ROUTES) {
  test(`axe: ${route}`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('#root')).not.toBeEmpty();
    const { violations, summary } = await collect(page);
    annotateViolations(route, violations);
    expect(summary).toEqual([]);
  });
}

test('axe: home on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 720 });
  await page.goto('/');
  const phone = await collect(page);
  annotateViolations('/', phone.violations);
  expect(phone.summary).toEqual([]);
  // The mobile navigation is the surface a phone user actually reaches.
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
});

test('axe: the mobile menu drawer, open', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 720 });
  await page.goto('/');
  await page.getByRole('button', { name: /menu/i }).first().click();
  await expect(page.locator('#hub-mobile-menu')).toBeVisible();
  const drawer = await collect(page);
  annotateViolations('/ (drawer open)', drawer.violations);
  expect(drawer.summary).toEqual([]);
});

test('the first Tab reaches a working skip link and Enter lands in main', async ({ page }) => {
  await page.goto('/services');
  await page.keyboard.press('Tab');
  const skip = page.locator('.er-skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('Escape closes the mobile drawer and focus returns to its trigger', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 720 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /menu/i }).first();
  await trigger.click();
  await expect(page.locator('#hub-mobile-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#hub-mobile-menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('answer options are reachable and operable by keyboard', async ({ page }) => {
  await page.goto('/cbt/practice');
  const options = page.getByRole('radio');
  const count = await options.count();
  test.skip(count === 0, 'no exam available without live content — covered by the static rules instead');
  await options.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(options.nth(1)).toBeFocused();
  await expect(options.nth(1)).toHaveAttribute('aria-checked', 'true');
  // N still moves between questions; arrows belong to the answer group.
  await page.keyboard.press('n');
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
});
