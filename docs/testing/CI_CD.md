# CI/CD Testing Pipeline

## Overview

The project uses GitHub Actions for continuous integration and deployment, with automated testing at multiple stages.

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**
1. **Lint**: ESLint code quality checks
2. **Unit Tests**: Vitest with coverage reporting
3. **Type Check**: TypeScript type validation
4. **Build**: Next.js production build

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

### 2. E2E Workflow (`.github/workflows/e2e.yml`)

Runs end-to-end tests across multiple browsers.

**Jobs:**
1. **E2E Tests**: Matrix strategy across chromium, firefox, webkit

**Triggers:**
- Push to `main`
- Pull requests to `main`
- Daily schedule at 2 AM UTC

**Production URL:** https://cafe-pi-steel.vercel.app

### 3. Coverage Report (`.github/workflows/coverage-report.yml`)

Generates and uploads coverage reports.

**Jobs:**
1. **Coverage**: Generate coverage, upload to Codecov, create badges

**Triggers:**
- Push to `main`
- Pull requests to `main`

### 4. Nightly Tests (`.github/workflows/nightly.yml`)

Runs advanced tests that take longer to execute.

**Jobs:**
1. **Mutation Testing**: Stryker mutation tests (60 min timeout)
2. **Load Testing**: k6 performance tests

**Triggers:**
- Nightly schedule at 3 AM UTC
- Manual workflow dispatch

## Pre-commit Hooks

Configured with Husky and lint-staged to run before each commit.

**Checks:**
- ESLint (auto-fix)
- Prettier (auto-format)
- TypeScript type check
- Related tests for changed files

**Setup:**
```bash
cd frontend
npm install
npm run prepare  # Initializes Husky hooks
```

## Required GitHub Secrets

Configure these in your repository settings:

| Secret | Description |
|--------|-------------|
| `CODECOV_TOKEN` | Token for Codecov coverage reporting |
| `TEST_USER_EMAIL` | E2E test user email |
| `TEST_USER_PASSWORD` | E2E test user password |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |

## Pipeline Flow

```
Developer Commits
       ↓
Pre-commit Hook
├── Lint (ESLint)
├── Format (Prettier)
├── Type Check (tsc)
└── Related Tests (Vitest)
       ↓
Push to GitHub
       ↓
CI Workflow (parallel)
├── Lint Job
├── Unit Tests Job
├── Type Check Job
└── Build Job
       ↓
E2E Workflow (on main)
├── Chromium Tests
├── Firefox Tests
└── WebKit Tests
       ↓
Coverage Report
├── Generate Coverage
├── Upload to Codecov
└── Comment on PR
       ↓
Nightly (3 AM UTC)
├── Mutation Testing
└── Load Testing
```

## Coverage Enforcement

**Thresholds:**
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

**Enforcement:**
- Pre-commit: Related tests must pass
- CI: Full coverage must meet thresholds
- PR: Coverage report automatically commented

## Artifact Retention

| Artifact | Retention |
|----------|-----------|
| Coverage Reports | 30 days |
| Playwright Reports | 30 days |
| Build Artifacts | 7 days |
| Mutation Reports | 30 days |
| Load Test Results | 30 days |

## Debugging CI Failures

### Lint Failures
```bash
# Run locally
npm run lint

# Auto-fix
npm run lint -- --fix
```

### Test Failures
```bash
# Run tests locally
npm test

# Run specific test
npm test -- path/to/test.tsx

# Run in watch mode
npm run test:watch
```

### Type Check Failures
```bash
# Run locally
npx tsc --noEmit

# Check specific file
npx tsc --noEmit path/to/file.ts
```

### E2E Failures
```bash
# Run locally
npx playwright test

# Run in headed mode
npx playwright test --headed

# Debug mode
npx playwright test --debug

# View trace
npx playwright show-trace trace.zip
```

## Performance Optimization

**Caching:**
- npm dependencies cached per branch
- Playwright browsers cached
- Build artifacts cached for 7 days

**Concurrency:**
- E2E tests run in parallel across browsers
- Mutation tests use 4 concurrent workers
- Load tests simulate realistic user patterns

## Monitoring

**GitHub Actions:**
- View workflow runs in Actions tab
- Download artifacts for failed runs
- Check logs for detailed error messages

**Codecov:**
- Coverage trends over time
- PR impact on coverage
- Uncovered lines highlighted

## Best Practices

1. **Run tests locally before pushing**
2. **Use pre-commit hooks** (installed automatically)
3. **Check CI status before merging PRs**
4. **Review coverage reports on PRs**
5. **Investigate flaky tests immediately**
6. **Keep test data fixtures up-to-date**
7. **Update snapshots intentionally**
8. **Monitor nightly test results**

## Troubleshooting

### Hook Not Running
```bash
cd frontend
npm run prepare
git config core.hooksPath frontend/.husky
```

### CI Timeout
- Increase timeout in workflow file
- Optimize slow tests
- Check for infinite loops

### Flaky Tests
- Add explicit waits
- Use `waitFor` or `waitForLoadState`
- Avoid time-dependent assertions
- Mock unpredictable external services
