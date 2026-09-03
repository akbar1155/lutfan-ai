import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should display the main hero section', async ({ page }) => {
    await page.goto('/');
    
    await expect(page).toHaveTitle(/Lutfan AI/i);
    
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    
    const loginButton = page.getByText(/кириш|войти|login/i);
    await expect(loginButton).toBeVisible();
  });

  test('should navigate to gallery page', async ({ page }) => {
    await page.goto('/');
    
    const galleryLink = page.getByRole('link', { name: /галерея|gallery|namunalar/i });
    await galleryLink.click();
    
    await expect(page).toHaveURL(/\/gallery/);
  });

  test('should navigate to FAQ page', async ({ page }) => {
    await page.goto('/');
    
    const faqLink = page.getByRole('link', { name: /faq|savol|вопрос/i });
    await faqLink.click();
    
    await expect(page).toHaveURL(/\/faq/);
  });

  test('should navigate to How It Works page', async ({ page }) => {
    await page.goto('/');
    
    const howLink = page.getByRole('link', { name: /qanday|как|how/i });
    await howLink.click();
    
    await expect(page).toHaveURL(/\/how-it-works/);
  });
});
