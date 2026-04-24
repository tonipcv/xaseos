import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect to login when accessing dashboard unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill login form
    await page.fill('input[type="email"]', 'admin@xase.ai');
    await page.fill('input[type="password"]', 'admin123');

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');

    // Verify we're logged in by checking for dashboard elements
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill form with wrong password
    await page.fill('input[type="email"]', 'admin@xase.ai');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Submit
    await page.click('button[type="submit"]');

    // Should stay on login page
    await expect(page).toHaveURL('/login');

    // Error message should appear
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@xase.ai');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // Click logout (assuming it's in the UI)
    await page.click('text=Logout');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });
});
