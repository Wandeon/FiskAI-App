#!/usr/bin/env npx tsx
/**
 * Lint: Dead Tailwind classes
 *
 * Verifies that critical Tailwind utility classes exist in compiled CSS.
 * Must run AFTER `npm run build`.
 *
 * Usage: npm run build && npx tsx scripts/lint-dead-classes.ts
 */

import { globSync } from "glob"
import { readFileSync } from "fs"

const REQUIRED_PATTERNS = [
  // Primary color (Task 1 — shadcn compatibility)
  "text-primary",
  "bg-primary",
  "border-primary",
  // Shadow utilities (Task 2 — wired to CSS vars)
  "shadow-sm",
  "shadow-lg",
  // Raw palette (Task 3 — marketing gradients)
  "cyan-400",
  "blue-600",
  "purple-500",
  // Ring (Task 1 — shadcn focus rings)
  "ring-offset",
]

const cssFiles = globSync(".next/static/css/*.css", { cwd: process.cwd() })

if (cssFiles.length === 0) {
  console.error("No CSS files found in .next/static/css/. Run `npm run build` first.")
  process.exit(1)
}

const allCss = cssFiles.map((f) => readFileSync(f, "utf-8")).join("\n")

let missing = 0
for (const pattern of REQUIRED_PATTERNS) {
  if (allCss.includes(pattern)) {
    console.log(`  OK: ${pattern}`)
  } else {
    console.error(`  MISSING: ${pattern} — NOT FOUND in compiled CSS`)
    missing++
  }
}

if (missing > 0) {
  console.error(`\n${missing} required class pattern(s) missing from compiled CSS.`)
  console.error("Check tailwind.config.ts colors and ensure classes are used in source.")
  process.exit(1)
} else {
  console.log(`\nAll ${REQUIRED_PATTERNS.length} required patterns found in compiled CSS.`)
  process.exit(0)
}
