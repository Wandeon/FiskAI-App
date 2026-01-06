#!/usr/bin/env npx tsx
/**
 * Phase 5: Legacy Secret Access Check
 *
 * This script verifies that no NEW code accesses legacy secret env vars.
 * It maintains an allowlist of existing legacy files that are protected
 * by the enforcement gate (FF_ENFORCE_INTEGRATION_ACCOUNT).
 *
 * Legacy patterns forbidden in new code:
 * - process.env.EPOSLOVANJE_*
 * - process.env.IE_RACUNI_*
 * - process.env.FISCAL_CERT_*
 *
 * Run: npx tsx scripts/check-legacy-secrets.ts
 * Exit code: 0 = pass, 1 = fail
 *
 * @module scripts/check-legacy-secrets
 * @since Phase 5 - Enforcement & Cleanup
 */

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"

// Files that existed before Phase 5 with legacy secret access
// These are protected by enforcement gates and will be removed in cleanup
const ALLOWLIST = new Set([
  // E-invoice providers (legacy paths blocked by enforcement)
  "src/lib/e-invoice/provider.ts",
  "src/lib/e-invoice/poll-inbound.ts",
  "src/lib/e-invoice/poll-inbound-v2.ts",
  "src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts",
  "src/lib/e-invoice/providers/eposlovanje-einvoice.ts",
  "src/lib/e-invoice/providers/ie-racuni.ts",
])

// Patterns to detect
const FORBIDDEN_PATTERNS = [
  "process\\.env\\.EPOSLOVANJE",
  "process\\.env\\.IE_RACUNI",
  "process\\.env\\.FISCAL_CERT",
]

interface Violation {
  file: string
  line: number
  content: string
  pattern: string
}

function findViolations(): Violation[] {
  const violations: Violation[] = []

  for (const pattern of FORBIDDEN_PATTERNS) {
    try {
      const result = execSync(
        `grep -rn "${pattern}" --include="*.ts" --include="*.tsx" src/ 2>/dev/null || true`,
        { encoding: "utf-8" }
      )

      const lines = result.trim().split("\n").filter(Boolean)

      for (const line of lines) {
        // Parse grep output: file:line:content
        const match = line.match(/^([^:]+):(\d+):(.*)$/)
        if (!match) continue

        const [, file, lineNum, content] = match
        const relativePath = file.replace(/^\.\//, "")

        // Skip test files
        if (relativePath.includes(".test.") || relativePath.includes("__tests__")) {
          continue
        }

        // Skip allowlisted files
        if (ALLOWLIST.has(relativePath)) {
          continue
        }

        violations.push({
          file: relativePath,
          line: parseInt(lineNum, 10),
          content: content.trim(),
          pattern,
        })
      }
    } catch {
      // grep returns non-zero if no matches, which is fine
    }
  }

  return violations
}

function main() {
  console.log("🔍 Phase 5: Checking for legacy secret access...")
  console.log("")
  console.log("Forbidden patterns:")
  for (const pattern of FORBIDDEN_PATTERNS) {
    console.log(`  - ${pattern.replace(/\\\\/g, "\\")}`)
  }
  console.log("")
  console.log(`Allowlisted files (protected by enforcement): ${ALLOWLIST.size}`)
  console.log("")

  const violations = findViolations()

  if (violations.length === 0) {
    console.log("✅ No legacy secret access violations found.")
    console.log("")
    console.log("SAFE: All legacy secret access is in allowlisted files")
    console.log("      protected by FF_ENFORCE_INTEGRATION_ACCOUNT.")
    process.exit(0)
  }

  console.log("❌ LEGACY SECRET ACCESS VIOLATIONS FOUND")
  console.log("")
  console.log("The following files contain forbidden legacy secret env var access:")
  console.log("")

  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}`)
    console.log(`    Pattern: ${v.pattern.replace(/\\\\/g, "\\")}`)
    console.log(`    Content: ${v.content.substring(0, 80)}...`)
    console.log("")
  }

  console.log("REQUIRED ACTION:")
  console.log("  Use IntegrationAccount + vault for all secret access.")
  console.log("  See src/lib/integration/repository.ts for the correct pattern.")
  console.log("")
  console.log("If this is a legitimate legacy file that needs migration:")
  console.log("  1. Add it to the ALLOWLIST in this script")
  console.log("  2. Add enforcement gate (assertLegacyPathAllowed)")
  console.log("  3. File a task to migrate to IntegrationAccount")

  process.exit(1)
}

main()
