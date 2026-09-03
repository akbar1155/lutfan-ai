import { test, expect } from '@playwright/test';

test.describe('Invitation Creation Flow', () => {
  test.skip('should complete full invitation creation flow', async ({ page, context }) => {
    await page.goto('/');
    
    const devLoginEnabled = process.env.VITE_ENABLE_DEV_LOGIN !== 'false';
    if (!devLoginEnabled) {
      test.skip();
      return;
    }

    const devLoginButton = page.getByText(/dev.*login|тест/i);
    if (await devLoginButton.isVisible()) {
      await devLoginButton.click();
      await page.waitForTimeout(500);
    }

    await page.goto('/create');
    await expect(page).toHaveURL(/\/create/);

    await expect(page.getByText(/nikoh|aqiqa|sunnat/i).first()).toBeVisible();

    const eventCard = page.locator('[data-testid="event-card"]').first();
    await eventCard.click();

    await page.waitForURL(/\/create\/.*\/details/);

    const nextButton = page.getByRole('button', { name: /keyingi|далее|next/i });
    await nextButton.click();

    await page.waitForURL(/\/create\/.*\/data/);

    await page.waitForTimeout(1000);
  });

  test('should display event cards on create page', async ({ page, context }) => {
    const devLoginEnabled = process.env.VITE_ENABLE_DEV_LOGIN !== 'false';
    if (!devLoginEnabled) {
      test.skip();
      return;
    }

    const devLoginButton = page.getByText(/dev.*login|тест/i);
    if (await devLoginButton.isVisible()) {
      await page.goto('/');
      await devLoginButton.click();
      await page.waitForTimeout(500);
    }

    await page.goto('/create');

    const eventNames = ['nikoh', 'aqiqa', 'sunnat', 'birthday', 'hudoyi', 'hayit'];
    for (const eventName of eventNames) {
      const element = page.getByText(new RegExp(eventName, 'i'));
      await expect(element.first()).toBeVisible();
    }
  });
});
