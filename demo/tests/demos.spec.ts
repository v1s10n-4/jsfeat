import { test, expect } from '@playwright/test';

test.describe('Demos Page', () => {
  test('demo grid shows cards', async ({ page }) => {
    await page.goto('/#/demos');
    await expect(page.locator('h1')).toContainText('Demos');

    // Should have demo cards (role="link" cards)
    const cards = page.locator('[role="link"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking a demo card navigates to detail page', async ({ page }) => {
    await page.goto('/#/demos');
    await expect(page.locator('h1')).toContainText('Demos');

    // Click the first demo card
    const firstCard = page.locator('[role="link"]').first();
    await firstCard.click();

    // Should navigate to a demo detail URL
    await expect(page).toHaveURL(/.*#\/demos\/.+/);
  });

  test('demo detail page loads without critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      const msg = err.message;
      // Filter out webcam/media errors which are expected in CI
      if (
        msg.includes('NotAllowedError') ||
        msg.includes('NotFoundError') ||
        msg.includes('getUserMedia') ||
        msg.includes('mediaDevices') ||
        msg.includes('enumerateDevices') ||
        msg.includes('Permission denied') ||
        msg.includes('Requested device not found')
      ) {
        return;
      }
      errors.push(msg);
    });

    // Navigate to the grayscale demo (simplest)
    await page.goto('/#/demos/grayscale');

    // Wait for the page to render
    await page.waitForTimeout(1000);

    // Should not have non-webcam JS errors
    expect(errors).toEqual([]);
  });
});
