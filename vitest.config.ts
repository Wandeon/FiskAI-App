import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Explicit include to support standard *.test.ts and *.vitest.ts naming
    // Note: *.db.test.ts files are excluded here (run with vitest.config.db.ts instead)
    include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)", "**/*.vitest.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/domain/**/*.ts",
        "src/application/**/*.ts",
        "src/infrastructure/**/*.ts",
        "src/interfaces/**/*.ts",
      ],
      exclude: ["**/__tests__/**", "**/*.test.ts", "**/index.ts"],
      thresholds: {
        // Critical domain modules require high coverage
        "src/domain/shared/**/*.ts": {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
        "src/domain/tax/**/*.ts": {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
        "src/domain/invoicing/**/*.ts": {
          statements: 75,
          branches: 70,
          functions: 75,
          lines: 75,
        },
        "src/domain/fiscalization/**/*.ts": {
          statements: 75,
          branches: 70,
          functions: 75,
          lines: 75,
        },
      },
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**",
      // DB tests run with vitest.config.db.ts (require database connection)
      "**/*.db.test.ts",
      ".worktrees/**",
      "architecture-erp/**",
      "**/tests/marketing-audit/**",
      "**/*.spec.ts", // Playwright spec files
      // Files using node:test (to be run with Node test runner instead)
      "src/lib/__tests__/**",
      "src/lib/auth/otp.test.ts",
      "src/app/actions/__tests__/**",
      // Note: src/lib/auth/__tests__/** migrated to vitest
      "src/lib/config/__tests__/**",
      "src/lib/e-invoice/__tests__/**",
      // Fiscal tests using node:test (golden tests use vitest)
      "src/lib/fiscal/__tests__/xml-builder.test.ts",
      "src/lib/fiscal/__tests__/pos-fiscalize.test.ts",
      "src/lib/fiscal/__tests__/porezna-client.test.ts",
      "src/lib/fiscal/__tests__/certificate-parser.test.ts",
      "src/lib/guidance/__tests__/**",
      "src/lib/knowledge-hub/__tests__/**",
      "src/lib/pos/__tests__/**",
      "src/lib/regulatory-truth/__tests__/**",
      "src/lib/stripe/__tests__/**",
      "src/lib/system-registry/__tests__/**",
      // Domain tests using node:test
      "src/domain/compliance/__tests__/**",
      "src/domain/identity/__tests__/**",
      // API validation tests using node:test
      "src/lib/api/__tests__/**",
      // Tests needing comprehensive refactoring (run with node:test)
      "tests/lib/tenant-isolation.test.ts",
      "src/lib/assistant/query-engine/__tests__/answer-synthesizer.test.ts",
      "src/lib/regulatory-truth/graph/__tests__/cycle-detection.test.ts",
      "src/lib/regulatory-truth/retrieval/__tests__/query-router.test.ts",
      "src/lib/pausalni/__tests__/threshold-validation.test.ts",
      // Integration tests requiring infrastructure (database, Redis)
      "src/lib/regulatory-truth/content-sync/__tests__/integration.test.ts",
      "src/lib/regulatory-truth/workers/__tests__/integration.test.ts",
      "src/lib/assistant/__tests__/fail-closed-integration.test.ts",
      // RTL worker tests using node:test
      "src/lib/regulatory-truth/workers/__tests__/budget-governor.test.ts",
      "src/lib/regulatory-truth/workers/__tests__/routing-decisions.test.ts",
      "src/lib/regulatory-truth/workers/__tests__/source-health.test.ts",
      // Acceptance and infrastructure tests using node:test
      "acceptance/**",
      "src/infrastructure/invoicing/__tests__/tenant-isolation.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Mock server-only package for tests (Next.js server component marker)
      "server-only": path.resolve(__dirname, "./src/test-utils/server-only-mock.ts"),
    },
  },
})
