import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Perform login
  await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard
  await page.waitForURL('/');

  // Verify we're logged in
  await expect(page.locator('text=Nueva Venta')).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
