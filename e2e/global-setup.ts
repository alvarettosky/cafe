import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

// Mock data - same as fixtures.ts
const MOCK_USER = {
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

const MOCK_SESSION = {
  access_token: 'e2e-mock-access-token-fixed',
  refresh_token: 'e2e-mock-refresh-token-fixed',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  token_type: 'bearer',
  user: MOCK_USER,
};

const MOCK_PROFILE = {
  id: MOCK_USER.id,
  role: 'admin',
  approved: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

async function globalSetup(config: FullConfig) {
  const hasRealCredentials = process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD;

  if (hasRealCredentials) {
    // Use real credentials - handled by auth.setup.ts
    return;
  }

  console.log('🔐 Global setup: Creating mocked auth state');

  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Setup route mocks before any navigation
  await context.route('**/supabase.co/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/auth/v1/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(url.includes('/user') ? MOCK_USER : MOCK_SESSION),
      });
      return;
    }

    if (url.includes('/rest/v1/profiles')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_PROFILE]),
      });
      return;
    }

    // Default mock for other endpoints
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  const page = await context.newPage();
  const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3000';

  // Navigate to app and inject session
  await page.goto(baseURL + '/login');

  // Inject mock session into localStorage
  await page.evaluate((session) => {
    localStorage.setItem('sb-inszvqzpxfqibkjsptsm-auth-token', JSON.stringify(session));
  }, MOCK_SESSION);

  // Navigate to dashboard to trigger auth
  await page.goto(baseURL + '/');
  await page.waitForLoadState('networkidle');

  // Save state
  await context.storageState({ path: authFile });

  await browser.close();
  console.log('✅ Global setup: Auth state saved to', authFile);
}

export default globalSetup;
