import { test, expect } from '@playwright/test';

test('activation page is protected', async ({ page }) => {
  await page.goto('/activation');
  await expect(page).toHaveURL(/\/login/);
});
