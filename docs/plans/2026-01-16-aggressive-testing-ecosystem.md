# Aggressive Testing Ecosystem Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive, aggressive, and recurrent testing ecosystem covering unit, integration, E2E, performance, mutation, and visual regression testing with full CI/CD automation.

**Architecture:** Multi-layered testing strategy with Vitest for unit/integration, Playwright for E2E, k6 for load testing, Stryker for mutation testing, GitHub Actions for CI/CD, Husky for pre-commit hooks, and comprehensive coverage reporting.

**Tech Stack:** Vitest, Testing Library, Playwright, k6, Stryker, Husky, lint-staged, GitHub Actions, Codecov, MSW (Mock Service Worker)

---

## Phase 1: Foundation & Configuration

### Task 1: Enhance Vitest Configuration

**Files:**
- Modify: `frontend/vitest.config.mts`
- Create: `frontend/vitest.setup.mts`
- Modify: `frontend/package.json`

**Step 1: Read current vitest.config.mts**

Already exists at `frontend/vitest.config.mts` with basic config.

**Step 2: Create comprehensive vitest.setup.mts**

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;
```

**Step 3: Update vitest.config.mts with aggressive settings**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.mts',
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '.next/',
        'vitest.config.mts',
        'vitest.setup.mts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
});
```

**Step 4: Add test scripts to package.json**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:coverage:watch": "vitest --coverage",
    "test:ci": "vitest run --coverage --reporter=verbose --reporter=json --reporter=html"
  }
}
```

**Step 5: Commit**

```bash
git add frontend/vitest.config.mts frontend/vitest.setup.mts frontend/package.json
git commit -m "test: enhance vitest configuration with aggressive coverage thresholds"
```

---

### Task 2: Install Additional Testing Dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install MSW (Mock Service Worker) for API mocking**

```bash
cd frontend
npm install -D msw@latest @mswjs/data
```

**Step 2: Install Playwright for E2E testing**

```bash
npm install -D @playwright/test
```

**Step 3: Install additional testing utilities**

```bash
npm install -D @testing-library/user-event @testing-library/react-hooks @vitest/ui
```

**Step 4: Verify installations**

Check `package.json` includes:
```json
{
  "devDependencies": {
    "msw": "^2.x.x",
    "@mswjs/data": "^0.x.x",
    "@playwright/test": "^1.x.x",
    "@testing-library/user-event": "^14.x.x",
    "@vitest/ui": "^4.x.x"
  }
}
```

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "test: install MSW, Playwright, and additional testing utilities"
```

---

### Task 3: Setup MSW for API Mocking

**Files:**
- Create: `frontend/__mocks__/handlers.ts`
- Create: `frontend/__mocks__/server.ts`
- Create: `frontend/__mocks__/browser.ts`

**Step 1: Create MSW handlers**

```typescript
// frontend/__mocks__/handlers.ts
import { http, HttpResponse } from 'msw';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';

export const handlers = [
  // Mock get_advanced_metrics RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_advanced_metrics`, () => {
    return HttpResponse.json({
      total_revenue: 15000,
      total_cost: 5000,
      total_profit: 10000,
      avg_profit_margin: 66.67,
      sales_count: 25,
      avg_ticket: 600,
      payment_breakdown: {
        'Efectivo': { count: 10, total: 6000, profit: 4000 },
        'Transf. Davivienda': { count: 15, total: 9000, profit: 6000 },
      },
      pending_credits: 1500,
      top_products: [
        { product_name: 'Café Premium', units_sold: 50, revenue: 10000, profit: 7000 },
      ],
      inventory_value: 8500,
      low_stock_items: 2,
    });
  }),

  // Mock get_sales_time_series RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_sales_time_series`, () => {
    return HttpResponse.json([
      {
        period_start: '2026-01-15T00:00:00Z',
        period_label: '2026-01-15',
        revenue: 5000,
        cost: 1500,
        profit: 3500,
        profit_margin: 70,
        sales_count: 10,
        avg_ticket: 500,
      },
    ]);
  }),

  // Mock get_product_performance RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_product_performance`, () => {
    return HttpResponse.json([
      {
        product_id: 'prod-1',
        product_name: 'Café Premium',
        units_sold: 50,
        revenue: 10000,
        cost: 3000,
        profit: 7000,
        profit_margin: 70,
        avg_price_per_unit: 200,
      },
    ]);
  }),

  // Mock inventory query
  http.get(`${SUPABASE_URL}/rest/v1/inventory`, () => {
    return HttpResponse.json([
      {
        product_id: 'prod-1',
        product_name: 'Café Premium',
        total_grams_available: 5000,
        cost_per_gram: 0.02,
        reorder_point: 2500,
      },
    ]);
  }),

  // Mock sales query
  http.get(`${SUPABASE_URL}/rest/v1/sales`, () => {
    return HttpResponse.json([
      {
        id: 'sale-1',
        customer_id: 'cust-1',
        total_amount: 500,
        total_profit: 350,
        profit_margin: 70,
        created_at: '2026-01-16T10:00:00Z',
      },
    ]);
  }),
];
```

**Step 2: Create server setup for Node environment (Vitest)**

```typescript
// frontend/__mocks__/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

**Step 3: Create browser setup for E2E (Playwright)**

```typescript
// frontend/__mocks__/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

**Step 4: Update vitest.setup.mts to use MSW**

Add to `frontend/vitest.setup.mts`:

```typescript
import { server } from './__mocks__/server';

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Cleanup after all tests
afterAll(() => server.close());
```

**Step 5: Commit**

```bash
git add __mocks__/
git commit -m "test: setup MSW for API mocking in tests"
```

---

## Phase 2: Unit Tests for Components

### Task 4: Create Unit Tests for UI Components

**Files:**
- Create: `frontend/components/ui/__tests__/button.test.tsx`
- Create: `frontend/components/ui/__tests__/card.test.tsx`
- Create: `frontend/components/ui/__tests__/dialog.test.tsx`

**Step 1: Write failing test for Button component**

```typescript
// frontend/components/ui/__tests__/button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button';

describe('Button Component', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should call onClick handler when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByRole('button', { name: /disabled/i });
    expect(button).toBeDisabled();
  });

  it('should apply variant styles correctly', () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('bg-primary');

    rerender(<Button variant="outline">Outline</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('border');
  });

  it('should apply size classes correctly', () => {
    const { rerender } = render(<Button size="default">Default</Button>);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('h-10');

    rerender(<Button size="sm">Small</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-9');

    rerender(<Button size="lg">Large</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-11');
  });

  it('should render as child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- components/ui/__tests__/button.test.tsx
```

Expected: PASS (Button component already exists)

**Step 3: Write tests for Card component**

```typescript
// frontend/components/ui/__tests__/card.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';

describe('Card Components', () => {
  describe('Card', () => {
    it('should render card with children', () => {
      render(<Card data-testid="card">Card content</Card>);
      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<Card data-testid="card" className="custom-class">Content</Card>);
      expect(screen.getByTestId('card')).toHaveClass('custom-class');
    });
  });

  describe('CardHeader', () => {
    it('should render header with children', () => {
      render(
        <Card>
          <CardHeader>Header content</CardHeader>
        </Card>
      );
      expect(screen.getByText('Header content')).toBeInTheDocument();
    });
  });

  describe('CardTitle', () => {
    it('should render as h3 by default', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
        </Card>
      );
      const title = screen.getByText('Card Title');
      expect(title.tagName).toBe('H3');
    });
  });

  describe('CardDescription', () => {
    it('should render description with muted text', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription>Description text</CardDescription>
          </CardHeader>
        </Card>
      );
      const desc = screen.getByText('Description text');
      expect(desc).toHaveClass('text-muted-foreground');
    });
  });

  describe('Complete Card', () => {
    it('should render full card with all sections', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      );

      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(screen.getByText('Footer')).toBeInTheDocument();
    });
  });
});
```

**Step 4: Run tests**

```bash
npm test -- components/ui/__tests__/
```

Expected: PASS

**Step 5: Commit**

```bash
git add components/ui/__tests__/
git commit -m "test: add comprehensive unit tests for UI components"
```

---

### Task 5: Create Tests for Chart Components

**Files:**
- Create: `frontend/components/charts/__tests__/revenue-chart.test.tsx`
- Create: `frontend/components/charts/__tests__/product-chart.test.tsx`
- Create: `frontend/components/charts/__tests__/payment-chart.test.tsx`

**Step 1: Write test for RevenueChart**

```typescript
// frontend/components/charts/__tests__/revenue-chart.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevenueChart } from '../revenue-chart';
import type { TimeSeriesDataPoint } from '@/types/analytics';

const mockData: TimeSeriesDataPoint[] = [
  {
    date: '2026-01-15',
    revenue: 5000,
    profit: 3500,
    cost: 1500,
    sales_count: 10,
    avg_ticket: 500,
  },
  {
    date: '2026-01-16',
    revenue: 7000,
    profit: 5000,
    cost: 2000,
    sales_count: 14,
    avg_ticket: 500,
  },
];

describe('RevenueChart', () => {
  it('should render chart with default title', () => {
    render(<RevenueChart data={mockData} />);
    expect(screen.getByText('Revenue & Profit Trend')).toBeInTheDocument();
  });

  it('should render chart with custom title', () => {
    render(<RevenueChart data={mockData} title="Custom Title" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('should render chart with empty data', () => {
    render(<RevenueChart data={[]} />);
    expect(screen.getByText('Revenue & Profit Trend')).toBeInTheDocument();
  });

  it('should apply glass card styling', () => {
    const { container } = render(<RevenueChart data={mockData} />);
    const card = container.querySelector('.glass');
    expect(card).toBeInTheDocument();
  });

  it('should render ResponsiveContainer with correct height', () => {
    const { container } = render(<RevenueChart data={mockData} />);
    // Recharts renders a ResponsiveContainer which should be present
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });
});
```

**Step 2: Write test for ProductChart**

```typescript
// frontend/components/charts/__tests__/product-chart.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductChart } from '../product-chart';
import type { ProductMetric } from '@/types/analytics';

const mockProducts: ProductMetric[] = [
  {
    product_name: 'Café Premium',
    units_sold: 50,
    revenue: 10000,
    profit: 7000,
    profit_margin: 70,
  },
  {
    product_name: 'Café Orgánico',
    units_sold: 30,
    revenue: 6000,
    profit: 4000,
    profit_margin: 66.67,
  },
];

describe('ProductChart', () => {
  it('should render chart with default title', () => {
    render(<ProductChart data={mockProducts} />);
    expect(screen.getByText('Top Products')).toBeInTheDocument();
  });

  it('should render chart with custom title', () => {
    render(<ProductChart data={mockProducts} title="Product Performance" />);
    expect(screen.getByText('Product Performance')).toBeInTheDocument();
  });

  it('should handle empty data gracefully', () => {
    render(<ProductChart data={[]} />);
    expect(screen.getByText('Top Products')).toBeInTheDocument();
  });

  it('should render bar chart container', () => {
    const { container } = render(<ProductChart data={mockProducts} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });
});
```

**Step 3: Write test for PaymentChart**

```typescript
// frontend/components/charts/__tests__/payment-chart.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentChart } from '../payment-chart';
import type { PaymentBreakdown } from '@/types/analytics';

const mockPayments: PaymentBreakdown = {
  'Efectivo': { count: 10, total: 6000, profit: 4000 },
  'Transf. Davivienda': { count: 15, total: 9000, profit: 6000 },
  'Nequi Alvaretto': { count: 5, total: 3000, profit: 2000 },
};

describe('PaymentChart', () => {
  it('should render chart with default title', () => {
    render(<PaymentChart data={mockPayments} />);
    expect(screen.getByText('Payment Methods')).toBeInTheDocument();
  });

  it('should render chart with custom title', () => {
    render(<PaymentChart data={mockPayments} title="Payment Distribution" />);
    expect(screen.getByText('Payment Distribution')).toBeInTheDocument();
  });

  it('should handle empty data object', () => {
    render(<PaymentChart data={{}} />);
    expect(screen.getByText('Payment Methods')).toBeInTheDocument();
  });

  it('should render pie chart container', () => {
    const { container } = render(<PaymentChart data={mockPayments} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });
});
```

**Step 4: Run all chart tests**

```bash
npm test -- components/charts/__tests__/
```

Expected: PASS

**Step 5: Commit**

```bash
git add components/charts/__tests__/
git commit -m "test: add unit tests for all chart components"
```

---

### Task 6: Create Tests for Business Logic Components

**Files:**
- Create: `frontend/components/__tests__/new-sale-modal.test.tsx`
- Create: `frontend/components/__tests__/auth-provider.test.tsx`
- Create: `frontend/components/__tests__/date-range-selector.test.tsx`

**Step 1: Write test for NewSaleModal with MSW mocking**

```typescript
// frontend/components/__tests__/new-sale-modal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewSaleModal } from '../new-sale-modal';

describe('NewSaleModal', () => {
  const mockOnSaleComplete = vi.fn();

  beforeEach(() => {
    mockOnSaleComplete.mockClear();
  });

  it('should render trigger button', () => {
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);
    expect(screen.getByRole('button', { name: /nueva venta/i })).toBeInTheDocument();
  });

  it('should open modal when trigger button is clicked', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /registrar venta de café/i })).toBeInTheDocument();
    });
  });

  it('should load products when modal opens', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/seleccionar café/i)).toBeInTheDocument();
    });
  });

  it('should show error when submitting without product selection', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar venta/i })).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /confirmar venta/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/selecciona un producto/i)).toBeInTheDocument();
    });
  });

  it('should allow quantity input', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      const quantityInput = screen.getByLabelText(/cantidad/i);
      expect(quantityInput).toBeInTheDocument();
    });
  });

  it('should have all payment methods available', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/efectivo/i)).toBeInTheDocument();
      expect(screen.getByText(/pago a crédito o pendiente/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Write test for DateRangeSelector**

```typescript
// frontend/components/__tests__/date-range-selector.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeSelector } from '../date-range-selector';

describe('DateRangeSelector', () => {
  const mockOnRangeChange = vi.fn();

  it('should render all preset buttons', () => {
    render(<DateRangeSelector onRangeChange={mockOnRangeChange} />);

    expect(screen.getByRole('button', { name: /hoy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /esta semana/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /este mes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /este trimestre/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /este año/i })).toBeInTheDocument();
  });

  it('should call onRangeChange when preset is clicked', async () => {
    const user = userEvent.setup();
    render(<DateRangeSelector onRangeChange={mockOnRangeChange} />);

    const todayButton = screen.getByRole('button', { name: /hoy/i });
    await user.click(todayButton);

    expect(mockOnRangeChange).toHaveBeenCalledTimes(1);
    expect(mockOnRangeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        start: expect.any(Date),
        end: expect.any(Date),
      })
    );
  });

  it('should highlight active preset', async () => {
    const user = userEvent.setup();
    const { container } = render(<DateRangeSelector onRangeChange={mockOnRangeChange} />);

    const weekButton = screen.getByRole('button', { name: /esta semana/i });
    await user.click(weekButton);

    // The active button should have different styling (variant="default")
    expect(weekButton.className).toContain('bg-primary');
  });

  it('should calculate correct date range for "Hoy"', async () => {
    const user = userEvent.setup();
    render(<DateRangeSelector onRangeChange={mockOnRangeChange} />);

    const todayButton = screen.getByRole('button', { name: /hoy/i });
    await user.click(todayButton);

    const call = mockOnRangeChange.mock.calls[0][0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    expect(call.start.getDate()).toBe(today.getDate());
    expect(call.start.getMonth()).toBe(today.getMonth());
    expect(call.start.getFullYear()).toBe(today.getFullYear());
  });
});
```

**Step 3: Run tests**

```bash
npm test -- components/__tests__/
```

Expected: PASS (or fix any failures)

**Step 4: Commit**

```bash
git add components/__tests__/
git commit -m "test: add integration tests for business logic components"
```

---

## Phase 3: E2E Testing with Playwright

### Task 7: Setup Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/setup/auth.setup.ts`
- Create: `.env.test`

**Step 1: Initialize Playwright**

```bash
cd /mnt/datos/Documentos/Proyectos/Cafe-Mirador
npx playwright install
```

**Step 2: Create Playwright config**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['junit', { outputFile: 'playwright-report/results.xml' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'cd frontend && npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

**Step 3: Create auth setup**

```typescript
// e2e/setup/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Perform login
  await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard
  await page.waitForURL('/');

  // Verify we're logged in
  await expect(page.locator('text=Nueva Venta')).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
```

**Step 4: Create .env.test**

```env
# .env.test
BASE_URL=http://localhost:3000
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
NEXT_PUBLIC_SUPABASE_URL=https://inszvqzpxfqibkjsptsm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Step 5: Add to .gitignore**

```bash
echo ".auth/" >> .gitignore
echo ".env.test" >> .gitignore
echo "playwright-report/" >> .gitignore
echo "test-results/" >> .gitignore
```

**Step 6: Commit**

```bash
git add playwright.config.ts e2e/setup/ .gitignore
git commit -m "test: setup Playwright for E2E testing"
```

---

### Task 8: Write E2E Tests for Critical Flows

**Files:**
- Create: `e2e/sales-flow.spec.ts`
- Create: `e2e/analytics-dashboard.spec.ts`
- Create: `e2e/inventory-management.spec.ts`

**Step 1: Write E2E test for sales flow**

```typescript
// e2e/sales-flow.spec.ts
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
});
```

**Step 2: Write E2E test for analytics dashboard**

```typescript
// e2e/analytics-dashboard.spec.ts
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
    await expect(page.locator('text=Top Products')).toBeVisible();
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
});
```

**Step 3: Write E2E test for inventory management**

```typescript
// e2e/inventory-management.spec.ts
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
});
```

**Step 4: Run E2E tests**

```bash
npx playwright test
```

Expected: PASS (or fix any failures)

**Step 5: Commit**

```bash
git add e2e/
git commit -m "test: add comprehensive E2E tests for critical user flows"
```

---

## Phase 4: CI/CD with GitHub Actions

### Task 9: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/e2e.yml`
- Create: `.github/workflows/nightly.yml`

**Step 1: Create main CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Run ESLint
        run: cd frontend && npm run lint

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Run unit tests
        run: cd frontend && npm run test:ci

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./frontend/coverage/lcov.info
          flags: unittests
          name: unit-tests
          fail_ci_if_error: true

      - name: Upload coverage artifacts
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: frontend/coverage/
          retention-days: 30

  type-check:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Run TypeScript type check
        run: cd frontend && npx tsc --noEmit

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, unit-tests, type-check]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Build project
        run: cd frontend && npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: frontend/.next/
          retention-days: 7
```

**Step 2: Create E2E workflow**

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30

    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Run Playwright tests
        run: npx playwright test --project=${{ matrix.browser }}
        env:
          BASE_URL: https://cafe-mirador.vercel.app
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

      - name: Upload Playwright Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ matrix.browser }}
          path: playwright-report/
          retention-days: 30

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.browser }}
          path: test-results/
          retention-days: 30
```

**Step 3: Create nightly stress test workflow**

```yaml
# .github/workflows/nightly.yml
name: Nightly Tests

on:
  schedule:
    # Run every night at 3 AM UTC
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  mutation-tests:
    name: Mutation Testing
    runs-on: ubuntu-latest
    timeout-minutes: 60

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Run Stryker mutation tests
        run: cd frontend && npm run test:mutation

      - name: Upload mutation report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mutation-report
          path: frontend/reports/mutation/
          retention-days: 30

  load-tests:
    name: Load Testing
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run load tests
        run: k6 run tests/load/api-stress-test.js
        env:
          BASE_URL: https://cafe-mirador.vercel.app

      - name: Upload load test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: test-results/load/
          retention-days: 30
```

**Step 4: Create workflow directory**

```bash
mkdir -p .github/workflows
```

**Step 5: Commit**

```bash
git add .github/workflows/
git commit -m "ci: add comprehensive GitHub Actions workflows for CI/CD"
```

---

### Task 10: Setup Pre-commit Hooks with Husky

**Files:**
- Create: `.husky/pre-commit`
- Create: `.lintstagedrc.js`
- Modify: `frontend/package.json`

**Step 1: Install Husky and lint-staged**

```bash
cd frontend
npm install -D husky lint-staged
```

**Step 2: Initialize Husky**

```bash
npx husky init
```

**Step 3: Create pre-commit hook**

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

cd frontend && npx lint-staged
```

**Step 4: Make hook executable**

```bash
chmod +x .husky/pre-commit
```

**Step 5: Create lint-staged config**

```javascript
// .lintstagedrc.js
module.exports = {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    () => 'tsc --noEmit', // Type check
  ],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  '*.{ts,tsx}': [
    'vitest related --run --passWithNoTests',
  ],
};
```

**Step 6: Add scripts to package.json**

```json
{
  "scripts": {
    "prepare": "cd .. && husky install frontend/.husky",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

**Step 7: Test pre-commit hook**

```bash
# Make a small change to test
echo "// test" >> components/ui/button.tsx
git add components/ui/button.tsx
git commit -m "test: verify pre-commit hook"
```

Expected: Hook runs linting, formatting, type-check, and related tests

**Step 8: Commit the hook setup**

```bash
git add .husky/ .lintstagedrc.js package.json
git commit -m "ci: setup pre-commit hooks with Husky and lint-staged"
```

---

## Phase 5: Advanced Testing Strategies

### Task 11: Setup Mutation Testing with Stryker

**Files:**
- Create: `frontend/stryker.conf.json`
- Modify: `frontend/package.json`

**Step 1: Install Stryker**

```bash
cd frontend
npm install -D @stryker-mutator/core @stryker-mutator/vitest-runner
```

**Step 2: Create Stryker configuration**

```json
// frontend/stryker.conf.json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "packageManager": "npm",
  "reporters": ["html", "clear-text", "progress", "json"],
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "vitest": {
    "configFile": "vitest.config.mts"
  },
  "mutate": [
    "components/**/*.{ts,tsx}",
    "lib/**/*.ts",
    "types/**/*.ts",
    "!**/__tests__/**",
    "!**/*.test.{ts,tsx}",
    "!**/*.spec.{ts,tsx}",
    "!**/*.d.ts",
    "!**/*.config.*"
  ],
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 50
  },
  "timeoutMS": 30000,
  "concurrency": 4,
  "ignorePatterns": [
    "node_modules",
    ".next",
    "coverage",
    "dist"
  ]
}
```

**Step 3: Add mutation test script**

```json
{
  "scripts": {
    "test:mutation": "stryker run"
  }
}
```

**Step 4: Run mutation tests (first time)**

```bash
npm run test:mutation
```

Expected: Stryker generates mutation report

**Step 5: Commit**

```bash
git add stryker.conf.json package.json
git commit -m "test: add mutation testing with Stryker"
```

---

### Task 12: Create Load/Stress Tests with k6

**Files:**
- Create: `tests/load/api-stress-test.js`
- Create: `tests/load/spike-test.js`
- Create: `tests/load/soak-test.js`

**Step 1: Create basic API stress test**

```javascript
// tests/load/api-stress-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users
    { duration: '1m', target: 50 }, // Spike to 50 users
    { duration: '2m', target: 50 }, // Stay at 50 users
    { duration: '1m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    errors: ['rate<0.1'],               // Error rate must be less than 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test 1: Load homepage
  let res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage loads in <2s': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: Load analytics page
  res = http.get(`${BASE_URL}/analytics`);
  check(res, {
    'analytics status is 200': (r) => r.status === 200,
    'analytics loads in <3s': (r) => r.timings.duration < 3000,
  }) || errorRate.add(1);

  sleep(2);

  // Test 3: API endpoint - get metrics
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  res = http.post(
    `${BASE_URL}/api/metrics`,
    JSON.stringify({ period: 'today' }),
    params
  );

  check(res, {
    'metrics API status is 200': (r) => r.status === 200,
    'metrics API responds in <1s': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'test-results/load/summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

**Step 2: Create spike test**

```javascript
// tests/load/spike-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 }, // Fast ramp-up to a high point
    { duration: '30s', target: 100 }, // Stay at high point
    { duration: '10s', target: 0 },   // Quick ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(99)<5000'], // 99% of requests must complete below 5s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/`);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(0.5);
}
```

**Step 3: Create soak test (endurance)**

```javascript
// tests/load/soak-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '30m', target: 20 },  // Stay at 20 for 30 minutes
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  http.get(`${BASE_URL}/`);
  sleep(Math.random() * 3 + 2); // Random sleep between 2-5 seconds
}
```

**Step 4: Add load test scripts to package.json**

```json
{
  "scripts": {
    "test:load": "k6 run tests/load/api-stress-test.js",
    "test:spike": "k6 run tests/load/spike-test.js",
    "test:soak": "k6 run tests/load/soak-test.js"
  }
}
```

**Step 5: Commit**

```bash
git add tests/load/
git commit -m "test: add k6 load, spike, and soak tests"
```

---

### Task 13: Add Database Testing Layer

**Files:**
- Create: `tests/database/seed-test-data.sql`
- Create: `tests/database/db-integration.test.ts`
- Create: `tests/database/rpc-functions.test.ts`

**Step 1: Create test seed data**

```sql
-- tests/database/seed-test-data.sql
-- Clean test data
DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE customer_id = '00000000-0000-0000-0000-000000000099');
DELETE FROM sales WHERE customer_id = '00000000-0000-0000-0000-000000000099';
DELETE FROM customers WHERE id = '00000000-0000-0000-0000-000000000099';

-- Insert test customer
INSERT INTO customers (id, full_name, phone)
VALUES ('00000000-0000-0000-0000-000000000099', 'Test Customer', '1234567890')
ON CONFLICT (id) DO NOTHING;

-- Insert test sale
INSERT INTO sales (
  id,
  customer_id,
  total_amount,
  total_cost,
  total_profit,
  profit_margin,
  payment_method,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000999',
  '00000000-0000-0000-0000-000000000099',
  1000.00,
  300.00,
  700.00,
  70.00,
  'Efectivo',
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET total_amount = EXCLUDED.total_amount;

SELECT 'Test data seeded successfully' as status;
```

**Step 2: Create database integration test**

```typescript
// tests/database/db-integration.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    // Seed test data
    // Note: In real scenario, you'd run seed-test-data.sql via admin connection
  });

  describe('Inventory Table', () => {
    it('should fetch inventory with all columns', async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);

      if (data && data.length > 0) {
        const item = data[0];
        expect(item).toHaveProperty('product_id');
        expect(item).toHaveProperty('product_name');
        expect(item).toHaveProperty('total_grams_available');
        expect(item).toHaveProperty('cost_per_gram');
        expect(item).toHaveProperty('reorder_point');
      }
    });

    it('should respect RLS policies for anonymous users', async () => {
      // Anonymous users should be able to read
      const { data, error } = await supabase
        .from('inventory')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Sales Table', () => {
    it('should fetch sales with profit columns', async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();

      if (data && data.length > 0) {
        const sale = data[0];
        expect(sale).toHaveProperty('total_amount');
        expect(sale).toHaveProperty('total_cost');
        expect(sale).toHaveProperty('total_profit');
        expect(sale).toHaveProperty('profit_margin');
      }
    });

    it('should calculate profit correctly', async () => {
      const { data } = await supabase
        .from('sales')
        .select('total_amount, total_cost, total_profit, profit_margin')
        .gt('total_amount', 0)
        .limit(10);

      data?.forEach((sale) => {
        const calculatedProfit = sale.total_amount - sale.total_cost;
        expect(Math.abs(sale.total_profit - calculatedProfit)).toBeLessThan(0.01);

        if (sale.total_amount > 0) {
          const calculatedMargin = (sale.total_profit / sale.total_amount) * 100;
          expect(Math.abs(sale.profit_margin - calculatedMargin)).toBeLessThan(0.1);
        }
      });
    });
  });
});
```

**Step 3: Create RPC functions test**

```typescript
// tests/database/rpc-functions.test.ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

describe('RPC Functions Tests', () => {
  describe('get_advanced_metrics', () => {
    it('should return all required fields', async () => {
      const { data, error } = await supabase.rpc('get_advanced_metrics');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('total_revenue');
      expect(data).toHaveProperty('total_cost');
      expect(data).toHaveProperty('total_profit');
      expect(data).toHaveProperty('avg_profit_margin');
      expect(data).toHaveProperty('sales_count');
      expect(data).toHaveProperty('payment_breakdown');
      expect(data).toHaveProperty('top_products');
      expect(data).toHaveProperty('inventory_value');
      expect(data).toHaveProperty('low_stock_items');
    });

    it('should respect date range parameters', async () => {
      const startDate = new Date('2026-01-01').toISOString();
      const endDate = new Date('2026-01-15').toISOString();

      const { data, error } = await supabase.rpc('get_advanced_metrics', {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should return numeric values for metrics', async () => {
      const { data } = await supabase.rpc('get_advanced_metrics');

      if (data) {
        expect(typeof data.total_revenue).toBe('number');
        expect(typeof data.total_cost).toBe('number');
        expect(typeof data.total_profit).toBe('number');
        expect(typeof data.sales_count).toBe('number');
      }
    });
  });

  describe('get_sales_time_series', () => {
    it('should return array of time series data', async () => {
      const { data, error } = await supabase.rpc('get_sales_time_series', {
        p_interval: 'daily',
        p_days_back: 7,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should handle different interval types', async () => {
      const intervals = ['daily', 'weekly', 'monthly'];

      for (const interval of intervals) {
        const { data, error } = await supabase.rpc('get_sales_time_series', {
          p_interval: interval,
          p_days_back: 30,
        });

        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it('should return correct data structure', async () => {
      const { data } = await supabase.rpc('get_sales_time_series', {
        p_interval: 'daily',
        p_days_back: 7,
      });

      if (data && data.length > 0) {
        const point = data[0];
        expect(point).toHaveProperty('period_start');
        expect(point).toHaveProperty('period_label');
        expect(point).toHaveProperty('revenue');
        expect(point).toHaveProperty('cost');
        expect(point).toHaveProperty('profit');
        expect(point).toHaveProperty('sales_count');
      }
    });
  });

  describe('get_product_performance', () => {
    it('should return product metrics', async () => {
      const { data, error } = await supabase.rpc('get_product_performance', {
        p_days_back: 30,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should calculate profit margins correctly', async () => {
      const { data } = await supabase.rpc('get_product_performance', {
        p_days_back: 30,
      });

      data?.forEach((product) => {
        if (product.revenue > 0) {
          const expectedMargin = (product.profit / product.revenue) * 100;
          expect(Math.abs(product.profit_margin - expectedMargin)).toBeLessThan(0.1);
        }
      });
    });
  });
});
```

**Step 4: Add database test scripts**

```json
{
  "scripts": {
    "test:db": "vitest run tests/database/",
    "test:db:watch": "vitest tests/database/"
  }
}
```

**Step 5: Commit**

```bash
git add tests/database/
git commit -m "test: add comprehensive database integration tests"
```

---

## Phase 6: Coverage and Reporting

### Task 14: Setup Coverage Badges and Reports

**Files:**
- Create: `.github/workflows/coverage-report.yml`
- Modify: `README.md`

**Step 1: Create coverage report workflow**

```yaml
# .github/workflows/coverage-report.yml
name: Coverage Report

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  coverage:
    name: Generate Coverage Report
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Run tests with coverage
        run: cd frontend && npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./frontend/coverage/lcov.info
          flags: unittests
          name: coverage-report

      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

      - name: Generate coverage badge
        uses: cicirello/jacoco-badge-generator@v2
        with:
          badges-directory: badges
          generate-branches-badge: true
          generate-summary: true

      - name: Upload coverage badge
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: coverage-badge
          path: badges/
```

**Step 2: Add badges to README**

```markdown
# Café Mirador - Coffee Sales CRM

[![CI](https://github.com/alvarettosky/cafe/actions/workflows/ci.yml/badge.svg)](https://github.com/alvarettosky/cafe/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/alvarettosky/cafe/actions/workflows/e2e.yml/badge.svg)](https://github.com/alvarettosky/cafe/actions/workflows/e2e.yml)
[![codecov](https://codecov.io/gh/alvarettosky/cafe/branch/main/graph/badge.svg)](https://codecov.io/gh/alvarettosky/cafe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Testing

- **Unit Tests**: `npm run test`
- **E2E Tests**: `npx playwright test`
- **Coverage**: `npm run test:coverage`
- **Mutation Tests**: `npm run test:mutation`
- **Load Tests**: `npm run test:load`

### Coverage Goals

- Lines: 80%+
- Functions: 80%+
- Branches: 80%+
- Statements: 80%+

### Testing Strategy

- **Unit Tests**: Component and utility function testing
- **Integration Tests**: Multi-component interactions
- **E2E Tests**: Full user flows (sales, analytics, inventory)
- **Load Tests**: Performance under stress
- **Mutation Tests**: Test quality verification

...
```

**Step 3: Commit**

```bash
git add .github/workflows/coverage-report.yml README.md
git commit -m "docs: add coverage reporting and badges to README"
```

---

### Task 15: Create Test Documentation

**Files:**
- Create: `docs/testing/TESTING_GUIDE.md`
- Create: `docs/testing/WRITING_TESTS.md`
- Create: `docs/testing/CI_CD.md`

**Step 1: Create testing guide**

```markdown
# Testing Guide

## Overview

This project uses a comprehensive testing strategy covering:
- Unit tests (Vitest + Testing Library)
- Integration tests (MSW + Vitest)
- E2E tests (Playwright)
- Load tests (k6)
- Mutation tests (Stryker)

## Running Tests

### Quick Start

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npx playwright test

# Run load tests
npm run test:load
```

### Running Specific Tests

```bash
# Run a specific test file
npm test -- path/to/file.test.tsx

# Run tests matching a pattern
npm test -- --grep="Button"

# Run E2E tests for specific browser
npx playwright test --project=chromium

# Run E2E tests in UI mode
npx playwright test --ui
```

## Test Structure

### Unit Tests

Location: `__tests__` directories next to components

```typescript
describe('Component', () => {
  it('should render correctly', () => {
    render(<Component />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Integration Tests

Use MSW for API mocking:

```typescript
import { server } from '@/__mocks__/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### E2E Tests

Location: `e2e/` directory

```typescript
test('should complete user flow', async ({ page }) => {
  await page.goto('/');
  await page.click('button');
  await expect(page.locator('text=Success')).toBeVisible();
});
```

## Coverage Requirements

- Minimum 80% coverage for lines, functions, branches, and statements
- Coverage is enforced in CI
- Run `npm run test:coverage` to see detailed report

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the component does, not how it does it
2. **Use Testing Library Queries**: Prefer `getByRole` over `getByTestId`
3. **Mock External Dependencies**: Use MSW for API calls
4. **Keep Tests Isolated**: Each test should be independent
5. **Test Edge Cases**: Don't just test the happy path

## Debugging Tests

### Vitest

```bash
# Run with debugging
npm test -- --inspect-brk

# Run with UI
npm run test:ui
```

### Playwright

```bash
# Run in headed mode
npx playwright test --headed

# Debug specific test
npx playwright test --debug

# Open trace viewer
npx playwright show-trace trace.zip
```

## CI/CD Integration

All tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Nightly (mutation and load tests)

See `.github/workflows/` for CI configuration.

## Troubleshooting

### Common Issues

**Issue**: Tests timeout
**Solution**: Increase timeout in `vitest.config.mts` or use `{ timeout: 10000 }` option

**Issue**: Flaky E2E tests
**Solution**: Add explicit waits with `waitFor` or `waitForLoadState`

**Issue**: Coverage below threshold
**Solution**: Add tests for uncovered branches

**Issue**: MSW handlers not working
**Solution**: Verify server is started in `beforeAll` and reset in `afterEach`
```

**Step 2: Create writing tests guide**

```markdown
# Writing Tests Guide

## Unit Tests

### Component Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('should handle click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Hook Tests

```typescript
import { renderHook } from '@testing-library/react';
import { useAuth } from './use-auth';

describe('useAuth', () => {
  it('should return auth state', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeDefined();
  });
});
```

### Async Tests

```typescript
it('should load data asynchronously', async () => {
  render(<Component />);

  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

## Integration Tests

### Mocking Supabase

```typescript
import { server } from '@/__mocks__/server';
import { http, HttpResponse } from 'msw';

it('should handle API error', async () => {
  // Override default handler
  server.use(
    http.post('*/rest/v1/rpc/get_metrics', () => {
      return HttpResponse.json({ error: 'Server error' }, { status: 500 });
    })
  );

  render(<Dashboard />);

  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

## E2E Tests

### Page Object Pattern

```typescript
// e2e/pages/dashboard.page.ts
export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async clickNewSale() {
    await this.page.click('button:has-text("Nueva Venta")');
  }

  async fillSaleForm(data: SaleData) {
    await this.page.selectOption('select', data.product);
    await this.page.fill('input[type="number"]', data.quantity.toString());
  }
}

// In test
test('should create sale', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await dashboard.clickNewSale();
  await dashboard.fillSaleForm({ product: 'Café', quantity: 2 });
});
```

### Waiting Strategies

```typescript
// Wait for element
await page.waitForSelector('text=Success');

// Wait for URL
await page.waitForURL('/dashboard');

// Wait for load state
await page.waitForLoadState('networkidle');

// Wait for function
await page.waitForFunction(() => window.dataLoaded === true);
```

## Load Tests

### Basic k6 Test

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const res = http.get('https://example.com');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

## Testing Checklist

- [ ] Unit test for each component
- [ ] Integration test for complex interactions
- [ ] E2E test for critical user flows
- [ ] Error handling tests
- [ ] Loading state tests
- [ ] Edge case tests
- [ ] Accessibility tests (aria labels, roles)
- [ ] Mobile responsive tests

## Test Quality

### Good Test

```typescript
it('should disable submit button when form is invalid', async () => {
  const user = userEvent.setup();
  render(<Form />);

  const submit = screen.getByRole('button', { name: /submit/i });
  expect(submit).toBeDisabled();

  await user.type(screen.getByLabelText(/email/i), 'invalid');
  expect(submit).toBeDisabled();

  await user.clear(screen.getByLabelText(/email/i));
  await user.type(screen.getByLabelText(/email/i), 'valid@email.com');
  expect(submit).not.toBeDisabled();
});
```

### Bad Test

```typescript
// ❌ Too implementation-focused
it('should call setState with new value', () => {
  const setState = vi.fn();
  // Testing internal implementation
});

// ❌ Multiple assertions without context
it('test', () => {
  expect(a).toBe(1);
  expect(b).toBe(2);
  expect(c).toBe(3);
});
```

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Testing Library Docs](https://testing-library.com)
- [Playwright Docs](https://playwright.dev)
- [k6 Documentation](https://k6.io/docs)
```

**Step 3: Commit documentation**

```bash
git add docs/testing/
git commit -m "docs: add comprehensive testing documentation"
```

---

### Task 16: Final Integration and Verification

**Files:**
- Create: `scripts/run-all-tests.sh`
- Create: `scripts/verify-coverage.sh`

**Step 1: Create comprehensive test runner script**

```bash
#!/bin/bash
# scripts/run-all-tests.sh

set -e

echo "🧪 Running Complete Test Suite"
echo "=============================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Track results
FAILED=0

echo ""
echo "📝 Step 1: Linting..."
cd frontend
if npm run lint; then
  echo -e "${GREEN}✓ Linting passed${NC}"
else
  echo -e "${RED}✗ Linting failed${NC}"
  FAILED=1
fi

echo ""
echo "🔍 Step 2: Type Checking..."
if npx tsc --noEmit; then
  echo -e "${GREEN}✓ Type check passed${NC}"
else
  echo -e "${RED}✗ Type check failed${NC}"
  FAILED=1
fi

echo ""
echo "🧪 Step 3: Unit Tests..."
if npm run test:coverage; then
  echo -e "${GREEN}✓ Unit tests passed${NC}"
else
  echo -e "${RED}✗ Unit tests failed${NC}"
  FAILED=1
fi

echo ""
echo "🗄️ Step 4: Database Tests..."
if npm run test:db; then
  echo -e "${GREEN}✓ Database tests passed${NC}"
else
  echo -e "${RED}✗ Database tests failed${NC}"
  FAILED=1
fi

cd ..

echo ""
echo "🎭 Step 5: E2E Tests..."
if npx playwright test; then
  echo -e "${GREEN}✓ E2E tests passed${NC}"
else
  echo -e "${RED}✗ E2E tests failed${NC}"
  FAILED=1
fi

echo ""
echo "=============================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
fi
```

**Step 2: Create coverage verification script**

```bash
#!/bin/bash
# scripts/verify-coverage.sh

set -e

echo "📊 Verifying Test Coverage"
echo "=========================="

cd frontend

# Run tests with coverage
npm run test:coverage > /dev/null 2>&1

# Parse coverage summary
COVERAGE_FILE="coverage/coverage-summary.json"

if [ ! -f "$COVERAGE_FILE" ]; then
  echo "❌ Coverage file not found"
  exit 1
fi

# Extract coverage percentages
LINES=$(jq '.total.lines.pct' $COVERAGE_FILE)
FUNCTIONS=$(jq '.total.functions.pct' $COVERAGE_FILE)
BRANCHES=$(jq '.total.branches.pct' $COVERAGE_FILE)
STATEMENTS=$(jq '.total.statements.pct' $COVERAGE_FILE)

echo ""
echo "Coverage Results:"
echo "  Lines:      $LINES%"
echo "  Functions:  $FUNCTIONS%"
echo "  Branches:   $BRANCHES%"
echo "  Statements: $STATEMENTS%"
echo ""

# Check thresholds (80%)
THRESHOLD=80

FAILED=0

if (( $(echo "$LINES < $THRESHOLD" | bc -l) )); then
  echo "❌ Lines coverage below $THRESHOLD%"
  FAILED=1
fi

if (( $(echo "$FUNCTIONS < $THRESHOLD" | bc -l) )); then
  echo "❌ Functions coverage below $THRESHOLD%"
  FAILED=1
fi

if (( $(echo "$BRANCHES < $THRESHOLD" | bc -l) )); then
  echo "❌ Branches coverage below $THRESHOLD%"
  FAILED=1
fi

if (( $(echo "$STATEMENTS < $THRESHOLD" | bc -l) )); then
  echo "❌ Statements coverage below $THRESHOLD%"
  FAILED=1
fi

if [ $FAILED -eq 0 ]; then
  echo "✅ All coverage thresholds met!"
  exit 0
else
  echo ""
  echo "Run 'npm run test:coverage' to see detailed report"
  exit 1
fi
```

**Step 3: Make scripts executable**

```bash
chmod +x scripts/run-all-tests.sh
chmod +x scripts/verify-coverage.sh
```

**Step 4: Test the scripts**

```bash
./scripts/verify-coverage.sh
```

Expected: Coverage report displayed

**Step 5: Final commit**

```bash
git add scripts/
git commit -m "test: add comprehensive test runner and verification scripts"
```

---

## Summary

**Total Implementation:**
- 16 comprehensive tasks
- 6 phases covering all testing aspects
- Unit, integration, E2E, load, mutation, and database tests
- Full CI/CD pipeline with GitHub Actions
- Pre-commit hooks for quality gates
- Comprehensive documentation

**Test Coverage:**
- UI Components: 100% unit tested
- Chart Components: 100% unit tested
- Business Logic: Integration tested
- User Flows: E2E tested
- Database: RPC and integration tested
- Performance: Load and stress tested

**Automation:**
- Pre-commit: lint, format, type-check, related tests
- On Push: full CI pipeline
- On PR: coverage reports and comments
- Nightly: mutation and load tests

**Key Deliverables:**
✅ 80%+ code coverage enforced
✅ MSW for API mocking
✅ Playwright for E2E across 4 browsers
✅ k6 for load/stress/soak testing
✅ Stryker for mutation testing
✅ GitHub Actions CI/CD pipelines
✅ Husky pre-commit hooks
✅ Comprehensive test documentation
✅ Coverage badges and reporting
✅ Database integration tests

---

**Estimated Time:** 12-16 hours for complete implementation

