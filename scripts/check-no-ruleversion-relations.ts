#!/usr/bin/env npx tsx
/**
 * CI Guardrail: Prevent ruleVersion relation usage
 *
 * This script is a belt-and-suspenders check alongside ESLint.
 * It catches patterns that ESLint AST selectors might miss (variable
 * indirection, complex nesting, etc.)
 *
 * Run: npx tsx scripts/check-no-ruleversion-relations.ts
 *
 * Exit codes:
 *   0 = clean (no violations)
 *   1 = violations found
 *
 * PR#9: RuleVersion relations removed from PayoutLine/JoppdSubmissionLine
 */

import { readFileSync, readdirSync, statSync } from "fs"
import { join, relative } from "path"

// Patterns to detect
//
// Strategy: Focus on unambiguous violations. ESLint handles context-aware cases.
// This script is belt-and-suspenders for the most dangerous patterns.
const FORBIDDEN_PATTERNS = [
  {
    // Direct include of ruleVersion as a property value (not nested deep)
    // Matches: include: { ruleVersion: true } or include: { ruleVersion: { ... } }
    // This is narrow enough to avoid false positives from RuleVersion's own queries
    regex: /\binclude\s*:\s*\{\s*ruleVersion\s*:/gm,
    description: "include: { ruleVersion: ... }",
  },
  {
    // Direct select of ruleVersion as a property value
    regex: /\bselect\s*:\s*\{\s*ruleVersion\s*:/gm,
    description: "select: { ruleVersion: ... }",
  },
  {
    // line.ruleVersion access pattern (common pattern for PayoutLine/JoppdSubmissionLine)
    regex: /\bline\s*\.\s*ruleVersion\b/gm,
    description: "line.ruleVersion access",
  },
  {
    // payoutLine.ruleVersion access pattern
    regex: /\bpayoutLine\s*\.\s*ruleVersion\b/gm,
    description: "payoutLine.ruleVersion access",
  },
  {
    // submissionLine.ruleVersion access pattern
    regex: /\bsubmissionLine\s*\.\s*ruleVersion\b/gm,
    description: "submissionLine.ruleVersion access",
  },
  {
    // joppdLine.ruleVersion access pattern
    regex: /\bjoppdLine\s*\.\s*ruleVersion\b/gm,
    description: "joppdLine.ruleVersion access",
  },
]

// Files to scan
const INCLUDE_PATTERNS = [/\.tsx?$/]

// Paths to exclude
const EXCLUDE_PATTERNS = [
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/,
  /src\/generated\//,
  /node_modules\//,
  /__tests__\//,
]

interface Violation {
  file: string
  line: number
  column: number
  pattern: string
  snippet: string
}

function shouldScanFile(filePath: string): boolean {
  // Check include patterns
  const matchesInclude = INCLUDE_PATTERNS.some((p) => p.test(filePath))
  if (!matchesInclude) return false

  // Check exclude patterns
  const matchesExclude = EXCLUDE_PATTERNS.some((p) => p.test(filePath))
  if (matchesExclude) return false

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
  console.log("Checking for forbidden ruleVersion relation patterns...\n")

  const srcDir = join(process.cwd(), "src")
  const allFiles = getFilesRecursively(srcDir)
  const filesToScan = allFiles.filter(shouldScanFile)

  console.log(`Scanning ${filesToScan.length} files...\n`)

  const allViolations: Violation[] = []

  for (const file of filesToScan) {
    const violations = scanFile(file)
    allViolations.push(...violations)
  }

  if (allViolations.length === 0) {
    console.log("✓ No forbidden ruleVersion patterns found.\n")
    process.exit(0)
  }

  console.log("ERROR: Forbidden ruleVersion patterns found!\n")

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
  console.log("\nRuleVersion relations were removed in PR#9.")
  console.log("Use AppliedRuleSnapshot via snapshot-reader instead.")
  console.log("See: src/lib/rules/snapshot-reader.ts\n")

  process.exit(1)
}

main()
