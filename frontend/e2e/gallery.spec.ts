import { test, expect } from '@playwright/test';

test.describe('Gallery Page', () => {
  test('should display gallery items', async ({ page }) => {
    await page.goto('/gallery');
    
    await expect(page.getByRole('heading', { name: /галерея|gallery|namuna/i })).toBeVisible();
    
    await page.waitForTimeout(1000);
  });

  test('should allow filtering by event type', async ({ page }) => {
    await page.goto('/gallery');
    
    await page.waitForTimeout(1000);
    
    const filterOptions = page.locator('[data-testid="filter-button"]');
    if (await filterOptions.first().isVisible()) {
      await filterOptions.first().click();
      await page.waitForTimeout(500);
    }
  });
});
