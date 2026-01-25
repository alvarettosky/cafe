import { test as base, expect, Page, BrowserContext } from '@playwright/test';

// Mock data for E2E tests
export const MOCK_USER = {
  id: 'e2e-test-user-00000000-0000-0000-0000-000000000001',
  email: 'e2e-test@cafe-mirador.test',
  aud: 'authenticated',
  role: 'authenticated',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  user_metadata: { full_name: 'E2E Test User' },
  app_metadata: { provider: 'email' },
};

// Create a fake but structurally valid JWT (header.payload.signature)
// The payload contains our mock user data
const createFakeJwt = () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: MOCK_USER.id,
    email: MOCK_USER.email,
    role: 'authenticated',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000),
  })).toString('base64url');
  const signature = Buffer.from('fake-signature-for-testing').toString('base64url');
  return `${header}.${payload}.${signature}`;
};

export const MOCK_SESSION = {
  access_token: createFakeJwt(),
  refresh_token: 'e2e-mock-refresh-token-fixed',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  token_type: 'bearer',
  user: MOCK_USER,
};

export const MOCK_PROFILE = {
  id: MOCK_USER.id,
  role: 'admin',
  approved: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

const hasRealCredentials = () => {
  return (process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD) ||
         (process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);
};

// Setup all mocks on a CONTEXT (not page) for better persistence
async function setupMocksOnContext(context: BrowserContext) {
  // Intercept all Supabase API calls
  await context.route((url) => url.toString().includes('supabase.co'), async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Auth endpoints
    if (url.includes('/auth/v1/token') || url.includes('/auth/v1/session')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION),
      });
      return;
    }

    if (url.includes('/auth/v1/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER),
      });
      return;
    }

    // Catch any other auth endpoint
    if (url.includes('/auth/v1/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION),
      });
      return;
    }

    // Profiles - CRITICAL for auth approval
    if (url.includes('/rest/v1/profiles')) {
      const headers = route.request().headers();
      const acceptHeader = headers['accept'] || '';

      // Check if .single() is being used (Accept header indicates single object expected)
      const isSingleQuery = acceptHeader.includes('application/vnd.pgrst.object+json');

      // Return single object for .single() queries, array otherwise
      const profileResponse = isSingleQuery
        ? { role: 'admin', approved: true }
        : [{ role: 'admin', approved: true }];

      await route.fulfill({
        status: 200,
        contentType: isSingleQuery ? 'application/vnd.pgrst.object+json' : 'application/json',
        body: JSON.stringify(profileResponse),
      });
      return;
    }

    // Dashboard stats
    if (url.includes('/rpc/get_dashboard_stats')) {
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
      return;
    }

    // Pending users
    if (url.includes('/rpc/get_pending_users')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    // Analytics
    if (url.includes('/rpc/get_advanced_metrics')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_revenue: 1500000,
          total_profit: 450000,
          sales_count: 45,
          avg_ticket: 33333,
          avg_profit_margin: 30.0,
          inventory_value: 2500000,
          low_stock_items: 2,
          pending_credits: 0,
          top_products: [{ name: 'Café de Prueba', total_sold: 20, revenue: 500000 }],
          payment_methods: [
            { method: 'cash', count: 30, total: 1000000 },
            { method: 'transfer', count: 15, total: 500000 },
          ],
        }),
      });
      return;
    }

    // Pending credits for analytics
    if (url.includes('/rpc/get_pending_credits')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (url.includes('/rpc/get_time_series_data')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { period: '2026-01-20', revenue: 300000, profit: 90000, count: 9 },
          { period: '2026-01-21', revenue: 350000, profit: 105000, count: 11 },
          { period: '2026-01-22', revenue: 400000, profit: 120000, count: 12 },
        ]),
      });
      return;
    }

    if (url.includes('/rpc/get_variants_for_sale')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          variant_id: 'v1', product_id: 'p1', product_name: 'Café Test',
          variant_name: 'Café Test - 500g', sku: 'CT-500', presentation_grams: 500,
          grind_type: 'grano', base_price: 25000, stock_grams: 5000,
        }]),
      });
      return;
    }

    if (url.includes('/rpc/process_coffee_sale')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, sale_id: 'new-sale-' + Date.now() }),
      });
      return;
    }

    // Customer recurrence calculation
    if (url.includes('/rpc/calculate_customer_recurrence')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(14), // Suggest 14 days recurrence
      });
      return;
    }

    // Product performance for analytics
    if (url.includes('/rpc/get_product_performance')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { product_name: 'Café Test', units_sold: 50, revenue: 500000, profit: 150000 },
        ]),
      });
      return;
    }

    // Inventory movements (Kardex)
    if (url.includes('/rpc/get_inventory_movements')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    // Add inventory movement
    if (url.includes('/rpc/add_inventory_movement')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    // Data tables
    if (url.includes('/rest/v1/sales')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 's1', created_at: new Date().toISOString(), total_amount: 75000,
          payment_method: 'cash', status: 'confirmed',
          customers: { full_name: 'Cliente Test', address: 'Test 123', phone: '300123' },
        }]),
      });
      return;
    }

    // Products with variants (used by InventoryList component)
    if (url.includes('/rpc/get_products_with_variants')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          product_id: 'p1',
          product_name: 'Café E2E Test',
          total_grams_available: 5000,
        }]),
      });
      return;
    }

    if (url.includes('/rest/v1/inventory')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          product_id: 'p1',
          product_name: 'Café E2E Test',
          total_grams_available: 5000,
          stock_kg: 5,
          stock_units: 0,
          unit_price: 25000,
          cost_per_unit: 15000,
          min_stock_threshold: 1,
        }]),
      });
      return;
    }

    if (url.includes('/rest/v1/customers')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'c1', full_name: 'Cliente Test', phone: '300123', email: 'test@test.com',
          address: 'Test 123', typical_recurrence_days: 14,
          last_purchase_date: new Date(Date.now() - 7 * 86400000).toISOString(),
        }]),
      });
      return;
    }

    // Default response for any unhandled Supabase endpoint
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    }
  });
}

// Custom test that handles auth automatically
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser }, use) => {
    if (hasRealCredentials()) {
      // Use real auth - context with storageState
      const context = await browser.newContext({
        storageState: '.auth/user.json',
      });
      const page = await context.newPage();
      await use(page);
      await context.close();
    } else {
      // Use mocked auth - create fresh context WITHOUT storageState
      const context = await browser.newContext();

      // Setup mocks on CONTEXT level (persists across all pages and navigations)
      await setupMocksOnContext(context);

      const page = await context.newPage();

      // Inject session into localStorage BEFORE any page loads
      await context.addInitScript((session) => {
        localStorage.setItem('sb-inszvqzpxfqibkjsptsm-auth-token', JSON.stringify(session));
      }, MOCK_SESSION);

      await use(page);
      await context.close();
    }
  },
});

export { expect };
