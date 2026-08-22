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
2. **Load Testing**: k6 performance tests against production (30 min timeout)

**Triggers:**

- Nightly schedule at 3 AM UTC
- Manual workflow dispatch

#### Load Testing gate

`tests/load/api-stress-test.js` runs an 8-minute scenario (10 -> 50 VUs)
against the production URL and produces ~3,700 iterations, 3 requests each.
k6 is pinned to a fixed version via `grafana/setup-k6-action`, so the gate
cannot change behaviour without a commit.

**CI baseline** (run #107, the first green one after the fix): global p95 95.3 ms,
p99 143.6 ms; per endpoint homepage 26.8 ms, login 26.9 ms, export 117.3 ms. The export
endpoint is ~4.4x the other two and owns the tail — its 950 ms max was the run's global
max. Local runs are **not** comparable: the GitHub runner sits closer to Vercel.

**Thresholds** — calibrated against four real CI runs (#103-#106), not guessed:

| Metric                | Threshold    | Rationale                                             |
| --------------------- | ------------ | ----------------------------------------------------- |
| `http_req_duration`   | `p(95)<300`  | 3.1x the worst p95 measured in CI (74-97 ms)          |
| `http_req_duration`   | `p(99)<2000` | absorbs serverless cold starts                        |
| `homepage_duration`   | `p(95)<300`  | per-endpoint Trend                                    |
| `login_duration`      | `p(95)<300`  | per-endpoint Trend                                    |
| `export_api_duration` | `p(95)<800`  | extra headroom for this endpoint's cold start         |
| `errors`              | `rate<0.01`  | ~110 of a night's ~11,000 checks                      |
| `checks`              | `rate>0.99`  | correctness only — status codes, never latency        |
| `http_req_failed`     | `rate<0.01`  | the expected 401 is registered via `responseCallback` |

**Two rules this file exists to preserve:**

1. **Latency is watched by percentile, never by a per-request check.** A
   `check(res, { 'responds in <1s': ... })` is a threshold on the _slowest_
   request of the run (p100). This backend's tail measures 11-16x its p95
   consistently — including on nights that pass — so with 11,000 requests the
   p100 will always cross any fixed ceiling eventually. Checks assert status
   codes; Trends and percentiles assert speed.
2. **A `Rate` must record successes as well as failures.** `check(...) ||
errorRate.add(1)` only ever records `1`, so the rate is 100% the moment a
   single check fails and 0% otherwise — a declared `rate<0.1` is really "zero
   failures tolerated". Always write `errorRate.add(!check(...))`.

Both rules were learned the hard way: runs #104-#106 failed on the _same commit_
that had passed five nights running, each time on a single failed check out of
~22,000. See [`TESTING_GUIDE.md`](TESTING_GUIDE.md#load-tests-k6) for how to run
it locally and [`../../CLAUDE.md`](../../CLAUDE.md) for the repository's gate
inventory.

#### Debugging exit code 99

k6 exits `99` when a **threshold** is crossed — not when the script errors
(that is `107`+) and not when a request fails. The log line naming the metric
is the diagnosis:

```
level=error msg="thresholds on metrics 'errors' have been crossed"
```

Download the `load-test-results` artifact and read `summary.json`: every
threshold carries its own `{"ok": true|false}`, and `root_group.checks` names
the check that failed and how many times.

```bash
gh run download <run-id> --repo alvarettosky/cafe -n load-test-results
```

Before changing a threshold, confirm the metric actually regressed. A single
failure out of thousands is a tail event, not a regression — raising the
ceiling until it passes hides the next real one.

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

| Secret                          | Description                          |
| ------------------------------- | ------------------------------------ |
| `CODECOV_TOKEN`                 | Token for Codecov coverage reporting |
| `TEST_USER_EMAIL`               | E2E test user email                  |
| `TEST_USER_PASSWORD`            | E2E test user password               |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key               |

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

| Artifact           | Retention |
| ------------------ | --------- |
| Coverage Reports   | 30 days   |
| Playwright Reports | 30 days   |
| Build Artifacts    | 7 days    |
| Mutation Reports   | 30 days   |
| Load Test Results  | 30 days   |

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

## Action versions

All actions run on the Node 24 runtime. GitHub deprecated Node 20 on the
runners, and any action still targeting it emits a warning on every job.

| Action                    | Version                    | Note                                     |
| ------------------------- | -------------------------- | ---------------------------------------- |
| `actions/checkout`        | `v7`                       | `v5`+ is Node 24                         |
| `actions/setup-node`      | `v7`                       | `v5`+ is Node 24; auto-caches by default |
| `actions/upload-artifact` | `v7`                       | **`v5` is still Node 20** — needs `v6`+  |
| `codecov/codecov-action`  | pinned by SHA (`fb8b358…`) | third-party: pin, don't float            |
| `grafana/setup-k6-action` | pinned by SHA (`db07bd9…`) | third-party: pin, don't float            |

Check the runtime before bumping — `upload-artifact@v5` looks like a fix and
is not:

```bash
gh api "repos/actions/upload-artifact/contents/action.yml?ref=v5" \
  --jq '.content' | base64 -d | grep 'using:'
```

Run [`actionlint`](https://github.com/rhysd/actionlint) over the workflows
before pushing any change to them.

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
