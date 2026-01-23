import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Go to login page
  await page.goto('/login');

  // Fill in credentials
  await page.fill('input[type="email"]', process.env.E2E_USER_EMAIL || 'test@example.com');
  await page.fill('input[type="password"]', process.env.E2E_USER_PASSWORD || 'testpassword');

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 30000 });

  // Verify we're logged in
  await expect(page.locator('text=Nueva Venta')).toBeVisible({ timeout: 10000 });

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
