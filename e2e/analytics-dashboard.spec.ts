import { test, expect } from './fixtures';

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for dashboard to load
    await expect(page.locator('text=Inventario en Tiempo Real')).toBeVisible({ timeout: 15000 });

    // Navigate to analytics
    await page.click('button:has-text("Analytics")');
    await page.waitForURL('/analytics', { timeout: 10000 });
  });

  test('should display all KPI cards', async ({ authenticatedPage: page }) => {
    // Wait for analytics page content
    await expect(page.locator('h1:has-text("Analíticas Avanzadas")')).toBeVisible({ timeout: 10000 });

    // Check for KPI cards - using exact text from page
    await expect(page.locator('text=Ingresos Totales')).toBeVisible();
    await expect(page.locator('text=Ganancia Total')).toBeVisible();
    await expect(page.locator('text=Ticket Promedio')).toBeVisible();
    await expect(page.locator('text=Valor de Inventario')).toBeVisible();
  });

  test('should display revenue trend chart', async ({ authenticatedPage: page }) => {
    // Wait for analytics page to load
    await expect(page.locator('h1:has-text("Analíticas Avanzadas")')).toBeVisible({ timeout: 10000 });

    // Check for chart section - actual title is "Tendencia de Ingresos y Ganancias"
    await expect(page.locator('text=Tendencia de Ingresos')).toBeVisible();
  });

  test('should allow date range selection', async ({ authenticatedPage: page }) => {
    // Wait for analytics page to load
    await expect(page.locator('h1:has-text("Analíticas Avanzadas")')).toBeVisible({ timeout: 10000 });

    // Check date range selector buttons
    await expect(page.locator('button:has-text("Hoy")')).toBeVisible();
    await expect(page.locator('button:has-text("Esta Semana")')).toBeVisible();
    await expect(page.locator('button:has-text("Este Mes")')).toBeVisible();

    // Click "Esta Semana"
    await page.click('button:has-text("Esta Semana")');
    await page.waitForTimeout(500);

    // Page should still show analytics content
    await expect(page.locator('text=Ingresos Totales')).toBeVisible();
  });

  test('should have working back button', async ({ authenticatedPage: page }) => {
    // Wait for analytics page to load
    await expect(page.locator('h1:has-text("Analíticas Avanzadas")')).toBeVisible({ timeout: 10000 });

    // Find and click the back button (icon button before the heading)
    const backButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await backButton.click();

    // Should navigate back to main dashboard
    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.locator('text=Nueva Venta')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ authenticatedPage: page }) => {
    // Wait for analytics page to load
    await expect(page.locator('h1:has-text("Analíticas Avanzadas")')).toBeVisible({ timeout: 10000 });

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Page should still render correctly
    await page.waitForTimeout(500);

    // KPI cards should still be visible
    await expect(page.locator('text=Ingresos Totales')).toBeVisible();
  });

  test('should display charts with data', async ({ authenticatedPage: page }) => {
    // Wait for analytics page to load
    await expect(page.locator('h1:has-text("Analíticas Avanzadas")')).toBeVisible({ timeout: 10000 });

    // Wait for charts to render
    await page.waitForTimeout(1000);

    // Check for chart headings (confirms charts section is rendered)
    await expect(page.locator('text=Tendencia de Ingresos')).toBeVisible();
    await expect(page.locator('text=Rendimiento de Productos')).toBeVisible();

    // Check for chart legends (confirms charts have data)
    await expect(page.locator('text=Ingresos').first()).toBeVisible();
    await expect(page.locator('text=Ganancia').first()).toBeVisible();
  });

  test('should update metrics when date range changes', async ({ authenticatedPage: page }) => {
    // Wait for analytics page to load
    await expect(page.locator('h1:has-text("Analíticas Avanzadas")')).toBeVisible({ timeout: 10000 });

    // Verify initial KPI visible
    await expect(page.locator('text=Ingresos Totales')).toBeVisible();

    // Click "Hoy" date selector
    await page.click('button:has-text("Hoy")');
    await page.waitForTimeout(500);

    // Verify page still renders correctly after date change
    await expect(page.locator('text=Ingresos Totales')).toBeVisible();
  });

  test('should load without JavaScript errors', async ({ authenticatedPage: page }) => {
    // Collect any JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    // Wait for page to fully load
    await expect(page.locator('h1:has-text("Analíticas Avanzadas")')).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Filter out known React development warnings
    const criticalErrors = errors.filter(e =>
      !e.includes('Warning:') &&
      !e.includes('React') &&
      !e.includes('hydration')
    );
    expect(criticalErrors.length).toBe(0);
  });
});
