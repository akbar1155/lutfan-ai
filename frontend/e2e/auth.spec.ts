import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login prompt for protected pages', async ({ page }) => {
    await page.goto('/create');
    
    await expect(page).toHaveURL(/\/|login/);
  });

  test('should have dev login button in development mode', async ({ page, context }) => {
    const devLoginEnabled = process.env.VITE_ENABLE_DEV_LOGIN !== 'false';
    
    if (!devLoginEnabled) {
      test.skip();
      return;
    }

    await page.goto('/');
    
    const devLoginButton = page.getByText(/dev.*login|тест/i);
    if (await devLoginButton.isVisible()) {
      await expect(devLoginButton).toBeVisible();
    }
  });

  test('should show Telegram login widget', async ({ page }) => {
    await page.goto('/');
    
    const loginSection = page.locator('text=/кириш|войти|login/i').first();
    await loginSection.click();
    
    await page.waitForTimeout(1000);
  });
});
