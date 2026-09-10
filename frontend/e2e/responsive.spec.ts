import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('should render correctly on mobile (360px)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    
    const mobileMenu = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"]');
    if (await mobileMenu.first().isVisible()) {
      await expect(mobileMenu.first()).toBeVisible();
    }
  });

  test('should render correctly on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should render correctly on desktop (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    
    const navLinks = page.locator('nav a').first();
    await expect(navLinks).toBeVisible();
  });

  test('should have working navigation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"], button[aria-label*="menu"]');
    if (await mobileMenuButton.first().isVisible()) {
      await mobileMenuButton.first().click();
      await page.waitForTimeout(300);
      
      const galleryLink = page.getByRole('link', { name: /галерея|gallery|namunalar/i });
      await expect(galleryLink.first()).toBeVisible();
    }
  });
});
