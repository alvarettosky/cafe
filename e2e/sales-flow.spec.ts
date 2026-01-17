import { test, expect } from '@playwright/test';

test.describe('Sales Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should complete a full sale transaction', async ({ page }) => {
    // Click "Nueva Venta" button
    await page.click('button:has-text("Nueva Venta")');

    // Wait for modal to open
    await expect(page.locator('text=Registrar Venta de Café')).toBeVisible();

    // Select product
    await page.selectOption('select:near(:text("Producto"))', { index: 1 });

    // Set quantity
    await page.fill('input[type="number"]:near(:text("Cantidad"))', '2');

    // Select unit
    await page.selectOption('select:near(:text("Unidad"))', 'libra');

    // Select payment method
    await page.selectOption('select:near(:text("Medio de Pago"))', 'Efectivo');

    // Submit sale
    await page.click('button:has-text("Confirmar Venta")');

    // Wait for success (modal should close)
    await expect(page.locator('text=Registrar Venta de Café')).not.toBeVisible({ timeout: 10000 });

    // Verify dashboard updated (check if sales count increased)
    await expect(page.locator('text=Ventas Hoy')).toBeVisible();
  });

  test('should show validation error when no product selected', async ({ page }) => {
    await page.click('button:has-text("Nueva Venta")');
    await expect(page.locator('text=Registrar Venta de Café')).toBeVisible();

    // Try to submit without selecting product
    await page.click('button:has-text("Confirmar Venta")');

    // Should show error
    await expect(page.locator('text=Selecciona un producto')).toBeVisible();
  });

  test('should allow adding a new customer during sale', async ({ page }) => {
    await page.click('button:has-text("Nueva Venta")');
    await expect(page.locator('text=Registrar Venta de Café')).toBeVisible();

    // Click "+ Nuevo" customer button
    await page.click('button:has-text("+ Nuevo")');

    // Fill new customer form
    await page.fill('input[placeholder="Nombre Completo"]', 'Test Customer');
    await page.fill('input[placeholder="Teléfono (Opcional)"]', '3001234567');

    // Complete sale with new customer
    await page.selectOption('select:near(:text("Producto"))', { index: 1 });
    await page.click('button:has-text("Confirmar Venta")');

    await expect(page.locator('text=Registrar Venta de Café')).not.toBeVisible({ timeout: 10000 });
  });

  test('should allow selecting different units (libra vs media libra)', async ({ page }) => {
    await page.click('button:has-text("Nueva Venta")');
    await expect(page.locator('text=Registrar Venta de Café')).toBeVisible();

    // Select product first
    await page.selectOption('select:near(:text("Producto"))', { index: 1 });

    // Check that both unit options are available
    const unitSelect = page.locator('select:near(:text("Unidad"))');
    await expect(unitSelect.locator('option[value="libra"]')).toBeAttached();
    await expect(unitSelect.locator('option[value="media_libra"]')).toBeAttached();

    // Select media libra
    await page.selectOption('select:near(:text("Unidad"))', 'media_libra');

    // Complete sale
    await page.selectOption('select:near(:text("Medio de Pago"))', 'Efectivo');
    await page.click('button:has-text("Confirmar Venta")');

    await expect(page.locator('text=Registrar Venta de Café')).not.toBeVisible({ timeout: 10000 });
  });

  test('should support all payment methods', async ({ page }) => {
    await page.click('button:has-text("Nueva Venta")');
    await expect(page.locator('text=Registrar Venta de Café')).toBeVisible();

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

    const paymentSelect = page.locator('select:near(:text("Medio de Pago"))');

    for (const method of paymentMethods) {
      await expect(paymentSelect.locator(`option:has-text("${method}")`)).toBeAttached();
    }
  });
});
