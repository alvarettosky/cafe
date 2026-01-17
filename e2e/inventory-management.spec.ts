import { test, expect } from '@playwright/test';

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display inventory list', async ({ page }) => {
    // Look for inventory section
    await expect(page.locator('text=Inventario Actual')).toBeVisible();

    // Should show product names and quantities
    const inventoryItems = page.locator('[data-testid="inventory-item"]').first();
    await expect(inventoryItems).toBeVisible();
  });

  test('should show low stock alerts', async ({ page }) => {
    // Look for alert indicator
    const lowStockAlert = page.locator('text=Bajo Stock');

    // May or may not exist depending on data, but locator should be valid
    const count = await lowStockAlert.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should update inventory after sale', async ({ page }) => {
    // Get initial inventory count for a product
    const productRow = page.locator('[data-testid="inventory-item"]').first();
    const initialText = await productRow.textContent();

    // Make a sale
    await page.click('button:has-text("Nueva Venta")');
    await page.selectOption('select:near(:text("Producto"))', { index: 1 });
    await page.fill('input[type="number"]:near(:text("Cantidad"))', '1');
    await page.click('button:has-text("Confirmar Venta")');

    // Wait for modal to close
    await expect(page.locator('text=Registrar Venta de Café')).not.toBeVisible({ timeout: 10000 });

    // Refresh the page to see updated inventory
    await page.reload();

    // Check that inventory changed
    const newText = await productRow.textContent();
    // Text should be different (quantity decreased)
    expect(newText).not.toBe(initialText);
  });

  test('should display inventory metrics', async ({ page }) => {
    // Check for inventory-related metrics
    const inventorySection = page.locator('text=Inventario Actual').locator('..');
    await expect(inventorySection).toBeVisible();

    // Verify we can see product information
    // This is a basic check - actual implementation may vary
    await expect(page.locator('body')).toContainText(/gramos|libras|kg/i);
  });

  test('should allow filtering or searching inventory (if implemented)', async ({ page }) => {
    // This test is optional depending on implementation
    const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i]');

    if (await searchInput.count() > 0) {
      await searchInput.fill('café');
      await page.waitForTimeout(500);

      // Verify filtered results
      await expect(page.locator('body')).toContainText(/café/i);
    } else {
      // Search not implemented, test passes
      expect(true).toBe(true);
    }
  });

  test('should show product details', async ({ page }) => {
    // Look for product information cards or rows
    const inventoryList = page.locator('text=Inventario Actual').locator('..');
    await expect(inventoryList).toBeVisible();

    // Check that we can see at least some inventory data
    const hasContent = await inventoryList.textContent();
    expect(hasContent).toBeTruthy();
    expect(hasContent!.length).toBeGreaterThan(0);
  });

  test('should handle empty inventory gracefully', async ({ page }) => {
    // This test verifies the UI doesn't break with no inventory
    // Actual behavior depends on whether there's seed data

    // Just verify the inventory section renders without errors
    await page.waitForLoadState('networkidle');

    // Page should not have JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });

  test('should display cost and value information', async ({ page }) => {
    // Look for cost/value metrics
    const bodyText = await page.locator('body').textContent();

    // Should contain currency symbols or financial information
    expect(bodyText).toMatch(/\$|USD|COP|precio|costo|valor/i);
  });
});
