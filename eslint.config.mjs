import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Build outputs
    ".next/**",
    "out/**",
    "dist/**",
    "build/**",
    "next-env.d.ts",
    // Dependencies
    "node_modules/**",
    // Git worktrees (development isolation)
    ".worktrees/**",
    // Generated files
    "*.min.js",
    "coverage/**",
    ".nyc_output/**",
    // Playwright
    ".playwright-mcp/**",
    "playwright-report/**",
    "test-results/**",
    // k6 load testing scripts (use require imports)
    "tests/load/**",
    // Helper scripts (CommonJS)
    "execute-sql-node.js",
    "fix-analytics-auto.js",
  ]),
]);

export default eslintConfig;
