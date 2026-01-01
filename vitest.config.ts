import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**",
      "**/tests/marketing-audit/**",
      "**/*.spec.ts", // Playwright spec files
      // Files using node:test (to be run with Node test runner instead)
      "src/lib/__tests__/**",
      "src/lib/auth/otp.test.ts",
      "src/app/actions/__tests__/**",
      "src/lib/auth/__tests__/**",
      "src/lib/config/__tests__/**",
      "src/lib/e-invoice/__tests__/**",
      "src/lib/fiscal/__tests__/**",
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
      "src/lib/pausalni/__tests__/threshold-validation.test.ts",
      // Integration tests requiring infrastructure (database, Redis)
      "src/lib/regulatory-truth/content-sync/__tests__/integration.test.ts",
      "src/lib/regulatory-truth/workers/__tests__/integration.test.ts",
      "src/lib/assistant/__tests__/fail-closed-integration.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
