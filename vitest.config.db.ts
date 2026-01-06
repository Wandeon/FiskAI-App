import { defineConfig } from "vitest/config"
import path from "path"

/**
 * Vitest config for DB tests (*.db.test.ts)
 *
 * DB tests require a real database connection and should NOT use
 * the fail-fast mocks from vitest.setup.ts.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    // Only include .db.test.ts files
    include: ["**/*.db.test.ts"],
    // No setupFiles - DB tests use real database, not mocks
    setupFiles: [],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", ".worktrees/**", "architecture-erp/**"],
    // Force serial execution to prevent race conditions on shared DB state
    // This is a temporary stabilizer until proper test isolation is implemented
    fileParallelism: false,
    // Also disable concurrency within files
    sequence: {
      concurrent: false,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
