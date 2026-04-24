import { test, expect } from '@playwright/test';

test.describe('Datasets', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@xase.ai');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should navigate to datasets page', async ({ page }) => {
    await page.click('text=Datasets');
    await expect(page).toHaveURL('/datasets');
    await expect(page.locator('text=Create first dataset')).toBeVisible();
  });

  test('should create a dataset with selected runs', async ({ page }) => {
    await page.goto('/datasets');

    // Click create
    await page.click('text=Create first dataset');

    // Fill form
    await page.fill('input[name="name"]', 'E2E Test Dataset');

    // Select runs (checkboxes)
    await page.locator('input[type="checkbox"]').first().check();

    // Create
    await page.click('button:has-text("Create Dataset")');

    // Verify dataset appears
    await expect(page.locator('text=E2E Test Dataset')).toBeVisible();
    await expect(page.locator('text=1 runs')).toBeVisible();
  });

  test('should export dataset', async ({ page }) => {
    await page.goto('/datasets');

    // Create a dataset first if none exists
    const noDatasets = await page.locator('text=No datasets yet').isVisible().catch(() => false);

    if (noDatasets) {
      await page.click('text=Create first dataset');
      await page.fill('input[name="name"]', 'Export Test Dataset');
      await page.locator('input[type="checkbox"]').first().check();
      await page.click('button:has-text("Create Dataset")');
    }

    // Click export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("JSONL")'),
    ]);

    expect(download.suggestedFilename()).toContain('.jsonl');
  });
});
