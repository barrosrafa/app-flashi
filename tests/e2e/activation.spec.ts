import { test, expect } from '@playwright/test';

test('activation page is protected or safely renders in an unconfigured preview', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/activation');
  if (/\/login/.test(page.url())) {
    await expect(page).toHaveURL(/\/login/);
  } else {
    await expect(page.getByRole('heading').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
