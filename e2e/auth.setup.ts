import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

// Mock user data for E2E tests
const MOCK_USER = {
  id: 'e2e-test-user-00000000-0000-0000-0000-000000000001',
  email: 'e2e-test@cafe-mirador.test',
  aud: 'authenticated',
  role: 'authenticated',
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_metadata: {
    full_name: 'E2E Test User',
  },
  app_metadata: {
    provider: 'email',
  },
};

const MOCK_SESSION = {
  access_token: 'e2e-mock-access-token-' + Date.now(),
  refresh_token: 'e2e-mock-refresh-token-' + Date.now(),
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: MOCK_USER,
};

const MOCK_PROFILE = {
  id: MOCK_USER.id,
  role: 'admin',
  approved: true,
  created_at: new Date().toISOString(),
};

setup('authenticate', async ({ page }) => {
  const hasRealCredentials = process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD;
  const hasE2ECredentials = process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD;

  if (hasRealCredentials || hasE2ECredentials) {
    // Use real credentials if available
    const email = process.env.TEST_USER_EMAIL || process.env.E2E_USER_EMAIL!;
    const password = process.env.TEST_USER_PASSWORD || process.env.E2E_USER_PASSWORD!;

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 30000 });
    await expect(page.locator('text=Nueva Venta')).toBeVisible({ timeout: 10000 });
  } else {
    // Mock authentication when no credentials available
    console.log('🔐 No credentials found, using mocked authentication for E2E tests');

    // Get Supabase URL from env or use default
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://inszvqzpxfqibkjsptsm.supabase.co';

    // Intercept Supabase auth session endpoint
    await page.route(`${supabaseUrl}/auth/v1/token**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION),
      });
    });

    // Intercept getSession calls
    await page.route(`${supabaseUrl}/auth/v1/user`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER),
      });
    });

    // Intercept profile fetch
    await page.route(`${supabaseUrl}/rest/v1/profiles**`, async (route) => {
      const url = route.request().url();
      if (url.includes('select=')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([MOCK_PROFILE]),
        });
      } else {
        await route.continue();
      }
    });

    // Intercept dashboard stats
    await page.route(`${supabaseUrl}/rest/v1/rpc/get_dashboard_stats`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_inventory_grams: 50000,
          sales_today: 150000,
          roasted_coffee_lbs: 110.5,
          low_stock_count: 2,
        }),
      });
    });

    // Intercept pending users (admin)
    await page.route(`${supabaseUrl}/rest/v1/rpc/get_pending_users`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Intercept recent sales
    await page.route(`${supabaseUrl}/rest/v1/sales**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-sale-1',
            created_at: new Date().toISOString(),
            total_amount: 75000,
            payment_method: 'cash',
            customers: {
              full_name: 'Cliente de Prueba',
              address: 'Calle Test 123',
              phone: '3001234567',
            },
          },
        ]),
      });
    });

    // Intercept inventory
    await page.route(`${supabaseUrl}/rest/v1/inventory**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-inv-1',
            name: 'Café de Prueba E2E',
            stock_kg: 5,
            stock_units: 0,
            unit_price: 25000,
            cost_per_unit: 15000,
            min_stock_threshold: 1,
          },
        ]),
      });
    });

    // Intercept customers
    await page.route(`${supabaseUrl}/rest/v1/customers**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-customer-1',
            full_name: 'Cliente de Prueba',
            phone: '3001234567',
            email: 'cliente@test.com',
            address: 'Calle Test 123',
            typical_recurrence_days: 14,
            last_purchase_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ]),
      });
    });

    // Intercept product variants for sale
    await page.route(`${supabaseUrl}/rest/v1/rpc/get_variants_for_sale`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            variant_id: 'mock-variant-1',
            product_id: 'mock-product-1',
            product_name: 'Café de Prueba',
            variant_name: 'Café de Prueba - 500g Grano',
            sku: 'CAFE-TEST-500G',
            presentation_grams: 500,
            grind_type: 'grano',
            base_price: 25000,
            stock_grams: 5000,
          },
        ]),
      });
    });

    // Navigate to login and inject mock session
    await page.goto('/login');

    // Inject the mock session into localStorage before Supabase client initializes
    await page.evaluate((session) => {
      // Supabase stores auth in localStorage with key pattern: sb-<project-ref>-auth-token
      const storageKey = 'sb-inszvqzpxfqibkjsptsm-auth-token';
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, MOCK_SESSION);

    // For mocked auth, we don't need to verify the dashboard here
    // The authenticatedPage fixture in fixtures.ts handles mocking at context level
    // Just save an empty storage state - the fixture will set up proper mocks
  }

  // Save authentication state (empty for mocked auth, real for actual auth)
  await page.context().storageState({ path: authFile });
});
