#!/usr/bin/env npx tsx
/**
 * CI Guardrail: Prevent direct core db.ruleVersion / db.ruleTable usage
 *
 * PR#11: All RuleVersion reads should go through the compatibility store
 * (src/lib/fiscal-rules/ruleversion-store.ts) which handles source switching.
 *
 * Direct db.ruleVersion or db.ruleTable usage is only allowed in:
 * - The compatibility store itself
 * - Migration/parity scripts (scripts/)
 * - DB tests that need to seed data
 *
 * Run: npx tsx scripts/check-no-direct-core-ruleversion.ts
 *
 * Exit codes:
 *   0 = clean (no violations)
 *   1 = violations found
 */

import { readFileSync, readdirSync, statSync } from "fs"
import { join, relative } from "path"

// Patterns that indicate direct core RuleVersion usage
const FORBIDDEN_PATTERNS = [
  {
    // db.ruleTable.* (direct core access)
    regex: /\bdb\s*\.\s*ruleTable\s*\./gm,
    description: "db.ruleTable.* (use store functions instead)",
  },
  {
    // db.ruleVersion.* (direct core access)
    regex: /\bdb\s*\.\s*ruleVersion\s*\./gm,
    description: "db.ruleVersion.* (use store functions instead)",
  },
  {
    // db.ruleSnapshot.* (direct core access)
    regex: /\bdb\s*\.\s*ruleSnapshot\s*\./gm,
    description: "db.ruleSnapshot.* (use dbReg instead)",
  },
  {
    // db.ruleCalculation.* (direct core access)
    regex: /\bdb\s*\.\s*ruleCalculation\s*\./gm,
    description: "db.ruleCalculation.* (use dbReg instead)",
  },
]

// Files to scan
const INCLUDE_PATTERNS = [/\.tsx?$/]

// Paths that are ALLOWED to use direct core access
const ALLOWED_PATHS = [
  // The compatibility store (needs both sources for dual mode)
  /src\/lib\/fiscal-rules\/ruleversion-store\.ts$/,
  // Service layer - writes still go to core until full cutover
  /src\/lib\/fiscal-rules\/service\.ts$/,
  // Migration scripts
  /scripts\/copy-ruleversion-to-regulatory\.ts$/,
  /scripts\/verify-ruleversion-parity\.ts$/,
  /scripts\/seed-ruleversion-bundle\.ts$/,
  // Shatter script (bootstrap/demo data)
  /scripts\/operation-shatter\.ts$/,
  // DB tests (seed data for testing)
  /__tests__\/.*\.db\.test\.tsx?$/,
  /\.db\.test\.tsx?$/,
]

// Paths to always exclude
const EXCLUDE_PATTERNS = [
  /src\/generated\//,
  /node_modules\//,
  // This script itself
  /scripts\/check-no-direct-core-ruleversion\.ts$/,
]

interface Violation {
  file: string
  line: number
  column: number
  pattern: string
  snippet: string
}

function isAllowedPath(filePath: string): boolean {
  return ALLOWED_PATHS.some((p) => p.test(filePath))
}

function shouldScanFile(filePath: string): boolean {
  // Check include patterns
  const matchesInclude = INCLUDE_PATTERNS.some((p) => p.test(filePath))
  if (!matchesInclude) return false

  // Check exclude patterns
  const matchesExclude = EXCLUDE_PATTERNS.some((p) => p.test(filePath))
  if (matchesExclude) return false

  // Skip allowed paths
  if (isAllowedPath(filePath)) return false

  return true
}

function getFilesRecursively(dir: string): string[] {
  const files: string[] = []

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          // Skip node_modules and hidden directories
          if (entry === "node_modules" || entry.startsWith(".")) continue
          files.push(...getFilesRecursively(fullPath))
        } else if (stat.isFile()) {
          files.push(fullPath)
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return files
}

function findLineAndColumn(content: string, matchIndex: number): { line: number; column: number } {
  const lines = content.slice(0, matchIndex).split("\n")
  const line = lines.length
  const column = lines[lines.length - 1].length + 1
  return { line, column }
}

function getSnippet(content: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 20)
  const end = Math.min(content.length, matchIndex + matchLength + 20)
  let snippet = content.slice(start, end)

  // Clean up the snippet
  snippet = snippet.replace(/\n/g, " ").replace(/\s+/g, " ").trim()
  if (start > 0) snippet = "..." + snippet
  if (end < content.length) snippet = snippet + "..."

  return snippet
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = []

  try {
    const content = readFileSync(filePath, "utf-8")

    for (const pattern of FORBIDDEN_PATTERNS) {
      // Reset regex state
      pattern.regex.lastIndex = 0

      let match
      while ((match = pattern.regex.exec(content)) !== null) {
        const { line, column } = findLineAndColumn(content, match.index)
        const snippet = getSnippet(content, match.index, match[0].length)

        violations.push({
          file: filePath,
          line,
          column,
          pattern: pattern.description,
          snippet,
        })
      }
    }
  } catch {
    // Skip files we can't read
  }

  return violations
}

function main(): void {
  console.log("Checking for direct core RuleVersion/RuleTable usage...\n")

  // Scan both src/ and scripts/
  const srcDir = join(process.cwd(), "src")
  const scriptsDir = join(process.cwd(), "scripts")

  const allFiles = [...getFilesRecursively(srcDir), ...getFilesRecursively(scriptsDir)]
  const filesToScan = allFiles.filter(shouldScanFile)

  console.log(`Scanning ${filesToScan.length} files (excluding allowed paths)...\n`)

  const allViolations: Violation[] = []

  for (const file of filesToScan) {
    const violations = scanFile(file)
    allViolations.push(...violations)
  }

  if (allViolations.length === 0) {
    console.log("✓ No direct core RuleVersion/RuleTable usage found.\n")
    console.log("Allowed paths (not scanned):")
    for (const p of ALLOWED_PATHS) {
      console.log(`  - ${p.source}`)
    }
    console.log()
    process.exit(0)
  }

  console.log("ERROR: Direct core RuleVersion/RuleTable usage found!\n")

  // Group by file
  const byFile = new Map<string, Violation[]>()
  for (const v of allViolations) {
    const existing = byFile.get(v.file) || []
    existing.push(v)
    byFile.set(v.file, existing)
  }

  for (const [file, violations] of byFile) {
    const relPath = relative(process.cwd(), file)
    console.log(`${relPath}:`)

    for (const v of violations) {
      console.log(`  Line ${v.line}:${v.column} - ${v.pattern}`)
      console.log(`    ${v.snippet}`)
    }
    console.log()
  }

  console.log(`Found ${allViolations.length} violation(s).`)
  console.log("\nPR#11: RuleVersion bundle migrated to regulatory schema.")
  console.log("Use the compatibility store instead of direct core access:")
  console.log(
    "  import { getRuleTableByKey, getEffectiveRuleVersion } from '@/lib/fiscal-rules/ruleversion-store'"
  )
  console.log("\nSee: docs/operations/ruleversion-cutover-exit-criteria.md\n")

  process.exit(1)
}

main()
