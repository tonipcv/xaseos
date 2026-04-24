import { test, expect } from '@playwright/test';

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@xase.ai');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should navigate to tasks page', async ({ page }) => {
    await page.click('text=Tasks');
    await expect(page).toHaveURL('/tasks');
    await expect(page.locator('text=New Task')).toBeVisible();
  });

  test('should create a new task', async ({ page }) => {
    await page.goto('/tasks');

    // Click new task button
    await page.click('text=New Task');

    // Fill form
    await page.fill('input[name="name"]', 'E2E Test Task');
    await page.fill('textarea[name="userPrompt"]', 'This is a test prompt for E2E');

    // Select a model
    await page.click('text=GPT-4o');

    // Save
    await page.click('button:has-text("Save")');

    // Verify task appears in list
    await expect(page.locator('text=E2E Test Task')).toBeVisible();
  });

  test('should edit a task', async ({ page }) => {
    await page.goto('/tasks');

    // Find and click edit on first task
    await page.locator('button[aria-label="Edit"]').first().click();

    // Update name
    await page.fill('input[name="name"]', 'Updated Task Name');

    // Save
    await page.click('button:has-text("Save")');

    // Verify updated
    await expect(page.locator('text=Updated Task Name')).toBeVisible();
  });
});
