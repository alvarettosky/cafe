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
