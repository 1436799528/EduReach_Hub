import { expect, test } from '@playwright/test';

// Browser requests are intercepted; this never contacts a hosted analytics service.
const key = 'edureach-privacy-preferences-v1';
const oldAllow = JSON.stringify({ necessary: true, analytics: true, savedAt: '2026-01-01T00:00:00Z', version: 1 });

test('optional analytics stay disabled across stale tabs, navigation and reload', async ({ context, page }) => {
  let events = 0;
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  await context.route('**/api/analytics/event', route => { events++; return route.fulfill({ status: 204 }); });
  await page.addInitScript(({ preferenceKey, storedAllow }) => localStorage.setItem(preferenceKey, storedAllow), { preferenceKey: key, storedAllow: oldAllow });
  await page.goto('/');
  const second = await context.newPage();
  await second.goto('/services');
  await page.getByRole('button', { name: 'Customize' }).click();
  await expect(page.getByText('Optional analytics are temporarily disabled.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept optional' })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: /Optional analytics/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await second.reload();
  await page.reload();
  await page.locator('a[href="/services"]').first().evaluate((link: HTMLElement) => link.click());
  await expect(page).toHaveURL(/\/services$/);
  await page.waitForLoadState('networkidle');
  await second.waitForLoadState('networkidle');
  expect(events).toBe(0);
});

test('rejection and settings remain available after reload', async ({ context, page }) => {
  await context.route('**/api/analytics/event', route => route.fulfill({ status: 204 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Customize' }).click();
  const analytics = page.getByRole('checkbox', { name: /Optional analytics/ });
  await expect(analytics).not.toBeChecked();
  await expect(analytics).toBeDisabled();
  await page.getByRole('button', { name: 'Save choices' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Cookie settings' }).click();
  await expect(analytics).not.toBeChecked();
  await expect(analytics).toBeDisabled();
  await page.getByRole('button', { name: 'Reject optional' }).click();
});

test('failed withdrawal, corrupt storage and reload never enable analytics', async ({ context, page }) => {
  let events = 0;
  await context.route('**/api/analytics/event', route => { events++; return route.fulfill({ status: 204 }); });
  await page.addInitScript(({ preferenceKey, storedAllow }) => {
    if (!localStorage.getItem(preferenceKey)) localStorage.setItem(preferenceKey, storedAllow);
    const storage = Object.getPrototypeOf(window.localStorage);
    const set = storage.setItem;
    const remove = storage.removeItem;
    storage.setItem = function(name: string, value: string) { if (name === preferenceKey) throw new Error('blocked'); return set.call(this, name, value); };
    storage.removeItem = function(name: string) { if (name === preferenceKey) throw new Error('blocked'); return remove.call(this, name); };
  }, { preferenceKey: key, storedAllow: oldAllow });
  await page.goto('/');
  await page.getByRole('button', { name: 'Reject optional' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await expect(page.getByRole('alert')).toContainText('Optional analytics are disabled');
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(events).toBe(0);
  // A second tab can expose malformed storage but still cannot turn tracking on.
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(preferenceKey => localStorage.setItem(preferenceKey, '{broken'), key);
  await other.reload();
  await expect(other.getByRole('button', { name: 'Accept optional' })).toBeDisabled();
  await other.waitForLoadState('networkidle');
  expect(events).toBe(0);
});
