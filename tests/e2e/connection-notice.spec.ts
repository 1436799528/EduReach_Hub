import { expect, test } from '@playwright/test';

test('offline notice explains that saves may fail and disappears on reconnection', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  const notice = page.getByRole('status').filter({ hasText: 'You are offline.' });
  await expect(notice).toHaveCount(0);
  await context.setOffline(true);
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Some actions may not be saved or submitted.');
  await expect(notice).toContainText('retry');
  await expect(notice).not.toContainText('sent when you reconnect');
  await context.setOffline(false);
  await expect(notice).toHaveCount(0);
});
