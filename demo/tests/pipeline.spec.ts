import { test, expect } from '@playwright/test';

test.describe('Pipeline Studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Pipeline');
  });

  test('default pipeline has stage cards', async ({ page }) => {
    const cards = page.locator('[data-testid="stage-card"]');
    // Default pipeline: grayscale, gaussianBlur, canny, fastCorners
    await expect(cards).toHaveCount(4);
  });

  test('can add a stage via the add button', async ({ page }) => {
    const cardsBefore = await page.locator('[data-testid="stage-card"]').count();

    // Click the add stage button
    await page.locator('[data-testid="add-stage-btn"]').click();

    // Wait for the dialog to appear
    await expect(page.getByText('Add Pipeline Stage')).toBeVisible();

    // Pick the first available stage button in the dialog
    const stageButtons = page.locator('[role="dialog"] button').filter({ hasNotText: /close/i });
    await stageButtons.first().click();

    // Verify a new card was added
    const cardsAfter = await page.locator('[data-testid="stage-card"]').count();
    expect(cardsAfter).toBe(cardsBefore + 1);
  });

  test('can remove a stage', async ({ page }) => {
    const cardsBefore = await page.locator('[data-testid="stage-card"]').count();
    expect(cardsBefore).toBeGreaterThan(0);

    // Click the delete button on the first card
    const firstCard = page.locator('[data-testid="stage-card"]').first();
    await firstCard.getByRole('button', { name: /remove/i }).click();

    const cardsAfter = await page.locator('[data-testid="stage-card"]').count();
    expect(cardsAfter).toBe(cardsBefore - 1);
  });

  test('reset to default button works', async ({ page }) => {
    // Remove a stage first
    const firstCard = page.locator('[data-testid="stage-card"]').first();
    await firstCard.getByRole('button', { name: /remove/i }).click();

    const cardsAfterDelete = await page.locator('[data-testid="stage-card"]').count();
    expect(cardsAfterDelete).toBe(3);

    // Click reset
    await page.locator('[data-testid="reset-pipeline-btn"]').click();

    // Should be back to 4 default stages
    await expect(page.locator('[data-testid="stage-card"]')).toHaveCount(4);
  });
});
