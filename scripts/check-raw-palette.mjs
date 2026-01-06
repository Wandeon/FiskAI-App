#!/usr/bin/env node
/**
 * Design System Guardrail: Raw Palette Check
 *
 * This script enforces the design system quarantine boundary.
 * It ensures raw Tailwind palette colors don't spread outside quarantined folders.
 *
 * Quarantine folders (raw palette allowed, capped):
 *   - src/components/news/
 *   - src/components/assistant-v2/
 *   - src/components/marketing/
 *   - src/app/(marketing)/
 *
 * Exit codes:
 *   0 - Pass (no violations outside quarantine, quarantine within cap)
 *   1 - Fail (violations outside quarantine OR quarantine exceeded cap)
 *
 * Usage:
 *   node scripts/check-raw-palette.mjs
 *   node scripts/check-raw-palette.mjs --cap 60
 */

import { execSync } from "child_process"
import { existsSync } from "fs"
import path from "path"

// Configuration
// Current baseline: 103 violations (as of 2026-01-06)
// This cap prevents NEW violations from being added - violations must decrease, not increase
const QUARANTINE_CAP = parseInt(process.argv[2]?.replace("--cap=", "") || process.argv[3] || "103", 10)

const RAW_PALETTE_PATTERN =
  "(text|bg|border)-(slate|gray|blue|red|green|amber|emerald|cyan|indigo|orange|purple|pink|rose|yellow|lime|teal|sky|violet|fuchsia)-[0-9]+"

const QUARANTINE_PATHS = [
  "src/components/news/",
  "src/components/assistant-v2/",
  "src/components/marketing/",
  "src/components/knowledge-hub/",
  "src/components/ui/command-palette/",
  "src/app/(marketing)/",
]

// All src paths to check
const SRC_PATH = "src/"

function runGrep(pattern, searchPath, excludePaths = []) {
  const excludeArgs = excludePaths.map((p) => `--exclude-dir=${path.basename(p)}`).join(" ")

  const cmd = `grep -rE "${pattern}" ${searchPath} --include="*.tsx" --include="*.ts" ${excludeArgs} 2>/dev/null || true`

  try {
    const result = execSync(cmd, { encoding: "utf-8", cwd: process.cwd() })
    return result
      .split("\n")
      .filter((line) => line.trim())
      .filter((line) => !line.includes("node_modules"))
  } catch {
    return []
  }
}

function countViolations(lines) {
  return lines.length
}

function isInQuarantine(filePath) {
  return QUARANTINE_PATHS.some((qPath) => filePath.includes(qPath))
}

function main() {
  console.log("=== Design System Raw Palette Check ===\n")

  // Check if src directory exists
  if (!existsSync(SRC_PATH)) {
    console.error("Error: src/ directory not found")
    process.exit(1)
  }

  // Find all violations
  const allLines = runGrep(RAW_PALETTE_PATTERN, SRC_PATH)

  // Separate into quarantine vs outside
  const quarantineLines = allLines.filter((line) => isInQuarantine(line))
  const outsideLines = allLines.filter((line) => !isInQuarantine(line))

  const quarantineCount = countViolations(quarantineLines)
  const outsideCount = countViolations(outsideLines)

  // Report
  console.log("Quarantine folders:")
  QUARANTINE_PATHS.forEach((p) => console.log(`  - ${p}`))
  console.log("")

  console.log(`Violations in quarantine: ${quarantineCount} (cap: ${QUARANTINE_CAP})`)
  console.log(`Violations outside quarantine: ${outsideCount} (must be 0)`)
  console.log("")

  let failed = false

  // Check outside violations
  if (outsideCount > 0) {
    console.log("FAIL: Found raw palette usage outside quarantine:\n")
    outsideLines.forEach((line) => {
      const [file, ...rest] = line.split(":")
      console.log(`  ${file}`)
      console.log(`    ${rest.join(":").trim().slice(0, 100)}...`)
    })
    console.log("")
    failed = true
  }

  // Check quarantine cap
  if (quarantineCount > QUARANTINE_CAP) {
    console.log(`FAIL: Quarantine violations (${quarantineCount}) exceed cap (${QUARANTINE_CAP})`)
    console.log("Quarantine is growing - migrate some files to tokens before adding more.\n")
    failed = true
  }

  if (failed) {
    console.log("=== FAILED ===")
    process.exit(1)
  }

  console.log("=== PASSED ===")
  console.log(`Quarantine healthy: ${quarantineCount}/${QUARANTINE_CAP} violations`)
  console.log("No spread outside quarantine detected.")
  process.exit(0)
}

main()
