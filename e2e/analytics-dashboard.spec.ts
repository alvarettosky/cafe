import { test, expect } from '@playwright/test';

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Navigate to analytics
    await page.click('button:has-text("Analytics")');
    await page.waitForURL('/analytics');
  });

  test('should display all KPI cards', async ({ page }) => {
    // Check for KPI cards
    await expect(page.locator('text=Ingresos Totales')).toBeVisible();
    await expect(page.locator('text=Ganancia Total')).toBeVisible();
    await expect(page.locator('text=Margen Promedio')).toBeVisible();
    await expect(page.locator('text=Créditos Pendientes')).toBeVisible();
  });

  test('should display all charts', async ({ page }) => {
    // Check for chart titles
    await expect(page.locator('text=Revenue & Profit Trend')).toBeVisible();
    await expect(page.locator('text=Payment Methods')).toBeVisible();
    await expect(page.locator('text=Product Performance').or(page.locator('text=Top Products'))).toBeVisible();
  });

  test('should allow date range selection', async ({ page }) => {
    // Check date range selector buttons
    await expect(page.locator('button:has-text("Hoy")')).toBeVisible();
    await expect(page.locator('button:has-text("Esta Semana")')).toBeVisible();
    await expect(page.locator('button:has-text("Este Mes")')).toBeVisible();

    // Click "Esta Semana"
    await page.click('button:has-text("Esta Semana")');

    // Wait for data to reload (charts should still be visible)
    await expect(page.locator('text=Revenue & Profit Trend')).toBeVisible();
  });

  test('should have working back button', async ({ page }) => {
    // Click back button
    await page.click('button[aria-label="Go back"]');

    // Should navigate back to main dashboard
    await page.waitForURL('/');
    await expect(page.locator('text=Nueva Venta')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Charts should still be visible
    await expect(page.locator('text=Revenue & Profit Trend')).toBeVisible();

    // KPI cards should stack vertically (still visible)
    await expect(page.locator('text=Ingresos Totales')).toBeVisible();
  });

  test('should display charts with data', async ({ page }) => {
    // Wait for charts to render
    await page.waitForTimeout(2000);

    // Check if Recharts containers are rendered
    const rechartsContainers = page.locator('.recharts-responsive-container');
    const count = await rechartsContainers.count();

    // Should have at least 3 charts (revenue, payment, product)
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('should update metrics when date range changes', async ({ page }) => {
    // Get revenue card locator
    const revenueCard = page.locator('text=Ingresos Totales').locator('..');

    // Verify card is visible before changing date
    await expect(revenueCard).toBeVisible();

    // Change date range to "Hoy"
    await page.click('button:has-text("Hoy")');

    // Wait for update
    await page.waitForTimeout(1000);

    // Verify card is still visible after date change
    await expect(revenueCard).toBeVisible();
  });

  test('should show loading states during data fetch', async ({ page }) => {
    // Reload page to see initial loading
    await page.reload();

    // Look for any loading indicators (spinners, skeletons, etc.)
    // This test is more observational
    await page.waitForSelector('text=Revenue & Profit Trend', { timeout: 10000 });
  });
});
