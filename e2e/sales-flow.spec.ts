import { test, expect } from './fixtures';

test.describe('Sales Flow', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Wait for dashboard to be fully loaded
    await expect(page.locator('text=Nueva Venta')).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to new sale page', async ({ authenticatedPage: page }) => {
    // Click "Nueva Venta" link/button
    await page.click('text=Nueva Venta');

    // Wait for the new sale page to load
    await expect(page.locator('h1:has-text("Registrar Venta de Café")')).toBeVisible({ timeout: 10000 });

    // Verify form elements are present
    await expect(page.locator('#product-select')).toBeVisible();
    await expect(page.locator('#quantity-input')).toBeVisible();
    await expect(page.locator('#unit-select')).toBeVisible();
  });

  test('should complete a full sale transaction', async ({ authenticatedPage: page }) => {
    // Navigate to new sale page
    await page.click('text=Nueva Venta');
    await expect(page.locator('h1:has-text("Registrar Venta de Café")')).toBeVisible({ timeout: 10000 });

    // Select product using the id
    await page.selectOption('#product-select', { index: 1 });

    // Set quantity
    await page.fill('#quantity-input', '2');

    // Select unit
    await page.selectOption('#unit-select', 'libra');

    // Submit sale
    await page.click('button:has-text("Confirmar Venta")');

    // Wait for navigation back to dashboard (success case)
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Verify dashboard is visible
    await expect(page.locator('text=Ventas Hoy')).toBeVisible();
  });

  test('should show validation error when no product selected', async ({ authenticatedPage: page }) => {
    // Navigate to new sale page
    await page.click('text=Nueva Venta');
    await expect(page.locator('h1:has-text("Registrar Venta de Café")')).toBeVisible({ timeout: 10000 });

    // Try to submit without selecting product
    await page.click('button:has-text("Confirmar Venta")');

    // Should show error
    await expect(page.locator('text=Selecciona un producto')).toBeVisible();
  });

  test('should allow adding a new customer during sale', async ({ authenticatedPage: page }) => {
    // Navigate to new sale page
    await page.click('text=Nueva Venta');
    await expect(page.locator('h1:has-text("Registrar Venta de Café")')).toBeVisible({ timeout: 10000 });

    // Click "+ Nuevo" customer button
    await page.click('button:has-text("+ Nuevo")');

    // Fill new customer form
    await page.fill('input[placeholder="Nombre Completo"]', 'Test Customer');
    await page.fill('input[placeholder="Teléfono (Opcional)"]', '3001234567');

    // Select product
    await page.selectOption('#product-select', { index: 1 });

    // Submit sale
    await page.click('button:has-text("Confirmar Venta")');

    // Should navigate back on success
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should allow selecting different units (libra vs media libra)', async ({ authenticatedPage: page }) => {
    // Navigate to new sale page
    await page.click('text=Nueva Venta');
    await expect(page.locator('h1:has-text("Registrar Venta de Café")')).toBeVisible({ timeout: 10000 });

    // Select product first
    await page.selectOption('#product-select', { index: 1 });

    // Check that both unit options are available
    const unitSelect = page.locator('#unit-select');
    await expect(unitSelect.locator('option[value="libra"]')).toBeAttached();
    await expect(unitSelect.locator('option[value="media_libra"]')).toBeAttached();

    // Select media libra
    await page.selectOption('#unit-select', 'media_libra');

    // Verify price updated (media libra should be $5)
    await expect(page.locator('#price-input')).toHaveValue('5');

    // Complete sale
    await page.click('button:has-text("Confirmar Venta")');

    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should support all payment methods', async ({ authenticatedPage: page }) => {
    // Navigate to new sale page
    await page.click('text=Nueva Venta');
    await expect(page.locator('h1:has-text("Registrar Venta de Café")')).toBeVisible({ timeout: 10000 });

    // Verify all payment methods are available
    const paymentMethods = [
      'Efectivo',
      'Transf. Davivienda',
      'Transf. Bancolombia',
      'Nequi Alvaretto',
      'Nequi La Negra',
      'DaviPlata',
      'Pago a crédito o pendiente'
    ];

    // Find payment method select (it doesn't have an id, use label)
    const paymentSelect = page.locator('select').filter({ has: page.locator('option:has-text("Efectivo")') });

    for (const method of paymentMethods) {
      await expect(paymentSelect.locator(`option:has-text("${method}")`)).toBeAttached();
    }
  });
});
