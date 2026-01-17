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

## Database Tests

### Testing RPC Functions

```typescript
describe('get_advanced_metrics', () => {
  it('should return all required fields', async () => {
    const { data, error } = await supabase.rpc('get_advanced_metrics');

    expect(error).toBeNull();
    expect(data).toHaveProperty('total_revenue');
    expect(data).toHaveProperty('total_profit');
  });

  it('should calculate metrics correctly', async () => {
    const { data } = await supabase.rpc('get_advanced_metrics');

    if (data) {
      expect(typeof data.total_revenue).toBe('number');
      expect(data.total_profit).toBeLessThanOrEqual(data.total_revenue);
    }
  });
});
```

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Testing Library Docs](https://testing-library.com)
- [Playwright Docs](https://playwright.dev)
- [k6 Documentation](https://k6.io/docs)
- [MSW Documentation](https://mswjs.io)
