import { test, expect } from '@playwright/test';

test.describe('Responsive Layout', () => {
  test('mobile viewport shows hamburger menu button', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // The hamburger menu button should be visible
    const menuButton = page.getByRole('button', { name: /open menu/i });
    await expect(menuButton).toBeVisible();
  });

  test('clicking hamburger menu shows navigation links', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Click the hamburger menu
    const menuButton = page.getByRole('button', { name: /open menu/i });
    await menuButton.click();

    // Navigation links should appear in the sheet
    await expect(page.getByText('Navigation')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pipeline' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Demos' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Docs' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'About' })).toBeVisible();
  });

  test('desktop viewport does not show hamburger menu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // Hamburger menu should not be visible
    const menuButton = page.getByRole('button', { name: /open menu/i });
    await expect(menuButton).not.toBeVisible();

    // Nav links should be directly visible
    await expect(page.getByRole('link', { name: 'Pipeline' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Demos' })).toBeVisible();
  });
});
