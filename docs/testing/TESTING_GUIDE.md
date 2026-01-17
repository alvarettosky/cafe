# Testing Guide

## Overview

This project uses a comprehensive testing strategy covering:
- Unit tests (Vitest + Testing Library)
- Integration tests (MSW + Vitest)
- E2E tests (Playwright)
- Load tests (k6)
- Mutation tests (Stryker)
- Database tests (Vitest + Supabase)

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
