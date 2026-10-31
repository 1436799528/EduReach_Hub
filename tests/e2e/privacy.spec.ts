import { expect, test } from '@playwright/test';

// Exercise the built app and its actual browser storage; analytics requests are
// intercepted locally and never sent to a hosted service.
test('analytics consent applies across tabs and reloads without replay', async ({ context, page }) => {
  const events: Array<{ event_name?: string; path?: string }> = [];
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/analytics/event', async route => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Accept optional' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(events).toHaveLength(0);

  const second = await context.newPage();
  await second.goto('/services');
  await second.waitForLoadState('networkidle');
  expect(events).toHaveLength(0);

  await page.getByRole('button', { name: 'Accept optional' }).click();
  await expect(page.getByRole('button', { name: 'Cookie settings' })).toBeVisible();
  expect(events).toHaveLength(0); // no previously denied page views replayed
  await second.reload();
  await expect.poll(() => events.filter(event => event.event_name === 'page_view').length).toBe(1);
  expect(events[0].path).toBe('/services');

  await page.getByRole('button', { name: 'Cookie settings' }).click();
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await second.reload();
  await second.waitForLoadState('networkidle');
  expect(events).toHaveLength(1);
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(events).toHaveLength(1);
  await second.close();
});

test('an unwritable consent choice stays visible and does not send analytics', async ({ context, page }) => {
  let events = 0;
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/analytics/event', async route => {
    events++;
    await route.fulfill({ status: 204 });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Accept optional' }).click();
  await page.getByRole('button', { name: 'Cookie settings' }).click();
  await page.evaluate(() => {
    const storage = Object.getPrototypeOf(window.localStorage);
    storage.setItem = () => { throw new Error('storage denied'); };
    storage.removeItem = () => { throw new Error('storage denied'); };
  });
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await expect(page.getByRole('button', { name: 'Reject optional' })).toBeVisible();
  // Use SPA navigation so the storage failure and the tab's fault latch remain.
  await page.locator('a[href="/services"]').first().evaluate((link: HTMLElement) => link.click());
  await expect(page).toHaveURL(/\/services$/);
  await page.waitForLoadState('networkidle');
  expect(events).toBe(0);
});
