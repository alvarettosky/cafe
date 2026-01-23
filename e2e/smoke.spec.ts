import { test, expect } from '@playwright/test';

test.describe('Smoke Tests (No Auth Required)', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');

    // Verify login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login page has correct title', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Mirador/i);
  });

  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto('/');
    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test('portal auth page loads', async ({ page }) => {
    await page.goto('/portal/auth');
    // Should show some content (either form or redirect)
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('pendiente page loads for unapproved users', async ({ page }) => {
    await page.goto('/pendiente');
    // Should show waiting message or redirect to login
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('application responds with valid HTML', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');
  });

  test('static assets load correctly', async ({ page }) => {
    await page.goto('/login');

    // Check that no critical resources failed to load
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      failedRequests.push(request.url());
    });

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // No critical failures
    const criticalFailures = failedRequests.filter(url =>
      !url.includes('favicon') && !url.includes('analytics')
    );
    expect(criticalFailures).toHaveLength(0);
  });
});
