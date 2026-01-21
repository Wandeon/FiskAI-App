#!/usr/bin/env npx tsx
/**
 * CI Guard: Verify no regulatory code imports in FiskAI repo
 *
 * This script ensures the clean architectural split between:
 * - FiskAI (accounting/ERP) - this repo
 * - fiskai-intelligence (regulatory platform) - separate repo
 *
 * Cross-system rule: Accounting <-> Intelligence communicate ONLY via HTTP API.
 *
 * Run: npx tsx scripts/check-no-regulatory.ts
 * Exit 0 = clean, Exit 1 = violations found
 */

import { execSync } from "child_process"

const FORBIDDEN_PATTERNS = [
  // Import patterns (simplified regex for shell safety)
  "@/lib/regulatory-truth",
  "@/lib/fiscal-rules",
  "@/lib/assistant",
  "@/lib/db/regulatory",
  // Direct references
  "dbReg",
]

const EXCLUDE_DIRS = [
  "node_modules",
  ".next",
  "dist",
  ".git",
  // Allow this script itself
  "scripts/check-no-regulatory.ts",
]

function main() {
  console.log("Checking for forbidden regulatory imports...")
  console.log("")

  let violations = 0

  for (const pattern of FORBIDDEN_PATTERNS) {
    try {
      const excludeArgs = EXCLUDE_DIRS.map((d) => `--glob '!${d}/**'`).join(" ")
      const cmd = `rg -l "${pattern}" src/ ${excludeArgs} 2>/dev/null || true`
      const result = execSync(cmd, { encoding: "utf8" }).trim()

      if (result) {
        const files = result.split("\n").filter(Boolean)
        for (const file of files) {
          console.log(`VIOLATION: ${file} contains forbidden pattern: ${pattern}`)
          violations++
        }
      }
    } catch {
      // rg returns non-zero when no matches, which is expected
    }
  }

  console.log("")

  if (violations > 0) {
    console.log(`Found ${violations} violation(s).`)
    console.log("")
    console.log("FiskAI must not import regulatory code directly.")
    console.log("Use Intelligence API for regulatory data access.")
    process.exit(1)
  }

  console.log("No forbidden imports found.")
  process.exit(0)
}

main()
