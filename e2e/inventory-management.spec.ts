import { test, expect } from './fixtures';

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display inventory list', async ({ authenticatedPage: page }) => {
    // Look for inventory section - the actual title is "Inventario en Tiempo Real"
    await expect(page.locator('text=Inventario en Tiempo Real')).toBeVisible({ timeout: 10000 });

    // Should show product name and stock
    await expect(page.locator('text=Café E2E Test')).toBeVisible();
    await expect(page.locator('text=Stock: 5000 g')).toBeVisible();
  });

  test('should show dashboard KPI cards', async ({ authenticatedPage: page }) => {
    // Wait for dashboard KPIs to load
    await expect(page.locator('text=Total en Inventario')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Ventas Hoy')).toBeVisible();
    await expect(page.locator('text=Café Tostado')).toBeVisible();
    await expect(page.locator('text=Alertas Stock')).toBeVisible();
  });

  test('should show low stock alerts count', async ({ authenticatedPage: page }) => {
    // The dashboard shows "Alertas Stock" with count from mock (2)
    await expect(page.locator('text=Alertas Stock')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Items bajo mínimo')).toBeVisible();
  });

  test('should have new product button for admins', async ({ authenticatedPage: page }) => {
    // Mock user is admin, should see "Nuevo Producto" button
    await expect(page.locator('button:has-text("Nuevo Producto")')).toBeVisible({ timeout: 10000 });
  });

  test('should have history button for inventory items', async ({ authenticatedPage: page }) => {
    // The inventory list has a history button for each item
    await expect(page.locator('button[title="Ver historial de movimientos"]')).toBeVisible({ timeout: 10000 });
  });

  test('should display inventory metrics', async ({ authenticatedPage: page }) => {
    // Check for inventory-related metrics in KPI cards
    await expect(page.locator('text=50,000 g')).toBeVisible({ timeout: 10000 }); // Total inventory from mock
    await expect(page.locator('text=110.5 lbs')).toBeVisible(); // Roasted coffee from mock
  });

  test('should display cost and value information', async ({ authenticatedPage: page }) => {
    // Look for currency in sales KPI
    await expect(page.locator('text=$ 150,000')).toBeVisible({ timeout: 10000 }); // Sales today from mock
  });

  test('should handle page without JavaScript errors', async ({ authenticatedPage: page }) => {
    // Collect any JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Inventario en Tiempo Real')).toBeVisible({ timeout: 10000 });

    // Allow some time for any async errors
    await page.waitForTimeout(1000);

    // Page should not have critical JavaScript errors
    // Filter out known React development warnings
    const criticalErrors = errors.filter(e => !e.includes('Warning:') && !e.includes('React'));
    expect(criticalErrors.length).toBe(0);
  });
});
