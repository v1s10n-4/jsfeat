import { test, expect } from '@playwright/test';

test.describe('Docs Page', () => {
  test('docs page loads with API Reference heading', async ({ page }) => {
    await page.goto('/#/docs');
    await expect(page.locator('h1')).toContainText('API Reference');
  });

  test('docs page shows module tabs or content', async ({ page }) => {
    await page.goto('/#/docs');
    await expect(page.locator('h1')).toContainText('API Reference');

    // Should show either tabs (desktop) or a select (mobile) with module names
    // Look for common module names in the content
    const pageContent = await page.textContent('body');
    const hasModuleContent =
      pageContent?.includes('Core') ||
      pageContent?.includes('ImgProc') ||
      pageContent?.includes('Math') ||
      pageContent?.includes('Features');

    expect(hasModuleContent).toBe(true);
  });

  test('docs page shows function signatures', async ({ page }) => {
    await page.goto('/#/docs');
    await expect(page.locator('h1')).toContainText('API Reference');

    // Should contain pre/code blocks with function signatures
    const codeBlocks = page.locator('pre code');
    const count = await codeBlocks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('docs search filters entries', async ({ page }) => {
    await page.goto('/#/docs');
    await expect(page.locator('h1')).toContainText('API Reference');

    // Type a search query for a function that exists in ImgProc
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('grayscale');

    // Wait for filtering
    await page.waitForTimeout(300);

    // The filter should show only matching module tabs -- look for ImgProc tab
    const pageText = await page.textContent('body');
    expect(pageText).toContain('ImgProc');

    // Click the ImgProc tab to see the filtered results
    const imgprocTab = page.getByRole('tab', { name: /ImgProc/i });
    if (await imgprocTab.isVisible()) {
      await imgprocTab.click();
      await page.waitForTimeout(200);
      // Should show code blocks for the filtered function
      const codeBlocks = await page.locator('pre code').count();
      expect(codeBlocks).toBeGreaterThan(0);
    }
  });
});
