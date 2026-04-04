import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('homepage loads and shows Pipeline content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Pipeline');
  });

  test('navigate to /demos shows demo grid', async ({ page }) => {
    await page.goto('/#/demos');
    await expect(page.locator('h1')).toContainText('Demos');
    // Should have at least one demo card
    await expect(page.locator('[role="link"]').first()).toBeVisible();
  });

  test('navigate to /docs shows API Reference', async ({ page }) => {
    await page.goto('/#/docs');
    await expect(page.locator('h1')).toContainText('API Reference');
  });

  test('navigate to /about shows jsfeat heading', async ({ page }) => {
    await page.goto('/#/about');
    await expect(page.locator('h1')).toContainText('jsfeat');
  });

  test('nav links work from homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Pipeline');

    // Click Demos link
    await page.getByRole('link', { name: 'Demos' }).click();
    await expect(page).toHaveURL(/.*#\/demos/);
    await expect(page.locator('h1')).toContainText('Demos');

    // Click Docs link
    await page.getByRole('link', { name: 'Docs' }).click();
    await expect(page).toHaveURL(/.*#\/docs/);
    await expect(page.locator('h1')).toContainText('API Reference');

    // Click About link
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/.*#\/about/);
    await expect(page.locator('h1')).toContainText('jsfeat');

    // Click Pipeline link to go home
    await page.getByRole('link', { name: 'Pipeline' }).click();
    await expect(page).toHaveURL(/.*#\//);
    await expect(page.locator('h1')).toContainText('Pipeline');
  });
});
