import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The CMS response is synthetic: no hosted policy is read or changed.
test('privacy and terms retain CMS text, flag review needs and remain accessible', async ({ page }) => {
  await page.route('**/api/site-content', route => route.fulfill({ json: {
    settings: {},
    pages: [
      { slug: 'privacy', title: 'Privacy notice', body: '<p>CMS privacy text awaiting review.</p>', status: 'published', reviewState: 'pending', revision: 1 },
      { slug: 'terms', title: 'Terms of use', body: '<p>CMS terms text awaiting review.</p>', status: 'published', reviewState: 'pending', revision: 1 },
    ],
  } }));
  await page.route('https://*.supabase.co/**', route => route.abort());
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.goto('/privacy');
  const consent = page.getByRole('button', { name: 'Reject optional' });
  if (await consent.isVisible()) await consent.click();
  await expect(page.getByRole('heading', { name: 'Privacy notice' })).toBeVisible();
  await expect(page.getByText('CMS privacy text awaiting review.')).toBeVisible();
  await expect(page.getByRole('note', { name: 'Privacy information requiring review' })).toContainText('Retention and age claims');
  await expect(page.getByRole('note', { name: 'Privacy information requiring review' })).toContainText('deletion and data export are not currently available');
  await expect(page.getByText('Draft pending legal review.')).toBeVisible();
  const terms = page.getByRole('navigation', { name: 'Other policies' }).getByRole('link', { name: 'Terms', exact: true });
  await terms.focus();
  await expect(terms).toBeFocused();
  const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations;
  expect(violations.map(v => `${v.id}: ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { name: 'Terms of use' })).toBeVisible();
  await expect(page.getByText('CMS terms text awaiting review.')).toBeVisible();
  const termsViolations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations;
  expect(termsViolations.map(v => v.id)).toEqual([]);
});
