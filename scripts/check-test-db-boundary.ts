#!/usr/bin/env npx tsx
/**
 * Test-DB Boundary Guardrail
 *
 * Ensures unit tests (*.test.ts) don't import database clients.
 * Tests that need a real database must be named *.db.test.ts.
 *
 * This prevents DB-dependent tests from running in the Unit Tests CI job,
 * which doesn't provision a Postgres service.
 *
 * Exit codes:
 *   0 = all unit tests are hermetic (no DB imports)
 *   1 = violation(s) found
 */

import fg from "fast-glob"
import { readFile } from "fs/promises"

// Patterns that indicate DB dependency (imports and usage)
const DB_IMPORT_PATTERNS = [
  // Import patterns
  /from\s+["']@\/lib\/db["']/,
  /from\s+["']@\/lib\/db\/regulatory["']/,
  /from\s+["']@\/lib\/prisma["']/,
  /from\s+["']\.\..*\/db["']/,
  /from\s+["']\.\..*\/prisma["']/,
  // @prisma/client imports - only flag if importing PrismaClient (runtime)
  // Type imports (Prisma, Company, etc.) are allowed for type safety
  /import\s*{[^}]*\bPrismaClient\b[^}]*}\s*from\s*["']@prisma\/client["']/,
  /require\(["']@prisma\/client["']\)/,
  // Prisma client instantiation
  /new\s+PrismaClient/,
  // Prisma adapter patterns
  /from\s+["']@prisma\/adapter-pg["']/,
  /new\s+PrismaPg/,
  // pg Pool (direct postgres connection)
  /from\s+["']pg["']/,
  /new\s+Pool\s*\(/,
]

// Files/patterns to exclude (already in vitest.config.ts exclude or properly mocked)
const EXCLUDED_PATTERNS = [
  // Already excluded in vitest.config.ts (won't run in unit job)
  /^src\/lib\/__tests__\//,
  /^src\/lib\/auth\/__tests__\//,
  /^src\/lib\/config\/__tests__\//,
  /^src\/lib\/e-invoice\/__tests__\//,
  /^src\/lib\/guidance\/__tests__\//,
  /^src\/lib\/knowledge-hub\/__tests__\//,
  /^src\/lib\/pos\/__tests__\//,
  /^src\/lib\/regulatory-truth\/__tests__\//,
  /^src\/lib\/stripe\/__tests__\//,
  /^src\/lib\/system-registry\/__tests__\//,
  /^src\/lib\/api\/__tests__\//,
  /^src\/domain\/compliance\/__tests__\//,
  /^src\/domain\/identity\/__tests__\//,
  /^src\/app\/actions\/__tests__\//,
  /^acceptance\//,
  /^tests\//,
  /\/e2e\//,
  // Specific files excluded in vitest.config.ts
  /^src\/lib\/regulatory-truth\/graph\/__tests__\/cycle-detection\.test\.ts$/,
  /^src\/lib\/regulatory-truth\/retrieval\/__tests__\/query-router\.test\.ts$/,
  /^src\/lib\/regulatory-truth\/content-sync\/__tests__\/integration\.test\.ts$/,
  /^src\/lib\/regulatory-truth\/workers\/__tests__\/integration\.test\.ts$/,
  /^src\/lib\/assistant\/__tests__\/fail-closed-integration\.test\.ts$/,
  /^src\/infrastructure\/invoicing\/__tests__\/tenant-isolation\.test\.ts$/,
  /^src\/lib\/pausalni\/__tests__\/threshold-validation\.test\.ts$/,
]

// Files that mock DB properly (verified)
const MOCKED_FILES = [
  "src/lib/assistant/query-engine/__tests__/rule-selector.test.ts",
  "src/lib/assistant/query-engine/__tests__/concept-matcher.test.ts",
  "src/lib/e-invoice/workers/__tests__/eposlovanje-inbound-poller.test.ts",
  "src/lib/e-invoice/providers/__tests__/send-invoice.test.ts",
  "src/lib/regulatory-truth/agents/__tests__/runner-invariants.test.ts",
]

async function main() {
  console.log("=== Test-DB Boundary Check ===\n")

  // Find all *.test.ts files, excluding *.db.test.ts, *.property.test.ts, *.golden.test.ts
  const allTestFiles = await fg("src/**/*.test.ts", {
    ignore: ["**/*.db.test.ts", "**/*.property.test.ts", "**/*.golden.test.ts"],
  })

  // Filter out excluded patterns and mocked files
  const testFiles = allTestFiles.filter((entry) => {
    if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(entry))) return false
    if (MOCKED_FILES.some((f) => entry.endsWith(f.replace(/^src\//, "")))) return false
    return true
  })

  console.log(`Scanning ${testFiles.length} unit test files...\n`)

  const violations: Array<{ file: string; line: number; content: string }> = []

  for (const file of testFiles) {
    const content = await readFile(file, "utf-8")
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check if this line imports DB
      for (const pattern of DB_IMPORT_PATTERNS) {
        if (pattern.test(line)) {
          // Check if it's a mock (vi.mock or jest.mock on the same or previous line)
          const contextStart = Math.max(0, i - 5)
          const context = lines.slice(contextStart, i + 1).join("\n")

          // If it's inside a vi.mock or jest.mock block, it's fine
          if (context.includes("vi.mock") || context.includes("jest.mock")) {
            continue
          }

          violations.push({
            file,
            line: i + 1,
            content: line.trim(),
          })
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log("✅ All unit tests are hermetic (no unmocked DB imports)\n")
    process.exit(0)
  }

  console.error("❌ Found DB imports in unit tests (not mocked):\n")
  console.error("These tests should either:")
  console.error("  1. Be renamed to *.db.test.ts (if they need a real DB)")
  console.error("  2. Mock the DB client properly (if they should be hermetic)\n")

  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`)
    console.error(`    ${v.content}\n`)
  }

  console.error(`\nTotal violations: ${violations.length}`)
  process.exit(1)
}

main().catch((err) => {
  console.error("Error running boundary check:", err)
  process.exit(1)
})
