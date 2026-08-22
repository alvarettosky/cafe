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

### Load tests (k6)

Location: `tests/load/`. Only `api-stress-test.js` runs in CI (nightly, against
production); `soak-test.js` and `spike-test.js` are manual.

```bash
npm run test:load           # api-stress-test.js
npm run test:spike
npm run test:soak

# Against production, with a compressed scenario (the CI one takes 8 min)
k6 run --quiet -e BASE_URL=https://cafe-pi-steel.vercel.app \
  --stage 30s:10 --stage 60s:10 --stage 30s:50 --stage 45s:50 --stage 15s:0 \
  tests/load/api-stress-test.js
```

**Two rules when writing them** — both come from a real failure, see
[`CI_CD.md`](CI_CD.md#load-testing-gate):

1. **Checks assert correctness; percentiles assert speed.** A check like
   `r => r.timings.duration < 1000` is a threshold on the slowest request of
   the whole run, and it will eventually fail on any backend with a long tail.
   Record the duration in a `Trend` and set a `p(95)` threshold instead.
2. **`Rate` needs both outcomes.** Write `errorRate.add(!check(res, {...}))`,
   never `check(res, {...}) || errorRate.add(1)` — the latter records only
   failures, so the rate is 100% as soon as one check fails.

Local numbers are **not** the CI baseline: the GitHub runner is closer to
Vercel than a developer machine. Calibrate thresholds from the `summary.json`
artifacts of real nightly runs.

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

See `.github/workflows/` for CI configuration and
[`CI_CD.md`](CI_CD.md) for the pipeline, the load-test thresholds and how to
read a failed nightly run.

## Troubleshooting

### Common Issues

**Issue**: Tests timeout
**Solution**: Increase timeout in `vitest.config.mts` or use `{ timeout: 10000 }` option

**Issue**: Flaky E2E tests
**Solution**: Add explicit waits with `waitFor` or `waitForLoadState`

**Issue**: Coverage below threshold
**Solution**: Add tests for uncovered branches

**Issue**: Nightly load test fails with exit code 99
**Solution**: That is a k6 _threshold_, not a crashed script. Read which metric
crossed it in the log, then check `summary.json` in the `load-test-results`
artifact before touching any number — see
[`CI_CD.md`](CI_CD.md#debugging-exit-code-99)

**Issue**: MSW handlers not working
**Solution**: Verify server is started in `beforeAll` and reset in `afterEach`
