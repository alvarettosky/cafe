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

# Extract coverage percentages using node (more portable than jq)
LINES=$(node -e "console.log(require('./$COVERAGE_FILE').total.lines.pct)")
FUNCTIONS=$(node -e "console.log(require('./$COVERAGE_FILE').total.functions.pct)")
BRANCHES=$(node -e "console.log(require('./$COVERAGE_FILE').total.branches.pct)")
STATEMENTS=$(node -e "console.log(require('./$COVERAGE_FILE').total.statements.pct)")

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

if (( $(echo "$LINES < $THRESHOLD" | bc -l 2>/dev/null || echo "$LINES < $THRESHOLD" | awk '{print ($1 < $3)}') )); then
  echo "❌ Lines coverage below $THRESHOLD%"
  FAILED=1
fi

if (( $(echo "$FUNCTIONS < $THRESHOLD" | bc -l 2>/dev/null || echo "$FUNCTIONS < $THRESHOLD" | awk '{print ($1 < $3)}') )); then
  echo "❌ Functions coverage below $THRESHOLD%"
  FAILED=1
fi

if (( $(echo "$BRANCHES < $THRESHOLD" | bc -l 2>/dev/null || echo "$BRANCHES < $THRESHOLD" | awk '{print ($1 < $3)}') )); then
  echo "❌ Branches coverage below $THRESHOLD%"
  FAILED=1
fi

if (( $(echo "$STATEMENTS < $THRESHOLD" | bc -l 2>/dev/null || echo "$STATEMENTS < $THRESHOLD" | awk '{print ($1 < $3)}') )); then
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
