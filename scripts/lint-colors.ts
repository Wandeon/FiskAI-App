#!/usr/bin/env npx tsx
/**
 * Lint: Forbidden raw palette colors
 *
 * Catches raw Tailwind palette usage that should use semantic tokens.
 * Run: npx tsx scripts/lint-colors.ts
 *
 * ALLOWED raw palette (marketing gradients, decorative):
 *   cyan-*, blue-*, purple-*, violet-*, slate-* — added to tailwind.config.ts
 *   These are for gradient stops and decorative effects only.
 *   For semantic meaning, always use design system tokens.
 */

import { globSync } from "glob"
import { readFileSync } from "fs"

const FORBIDDEN_PATTERNS = [
  // Raw palette — use semantic tokens instead
  { pattern: /\btext-red-\d+/, suggestion: "Use text-danger-text" },
  { pattern: /\btext-green-\d+/, suggestion: "Use text-success-text" },
  { pattern: /\btext-yellow-\d+/, suggestion: "Use text-warning-text" },
  { pattern: /\btext-orange-\d+/, suggestion: "Use text-warning-text" },
  { pattern: /\bbg-red-\d+/, suggestion: "Use bg-danger-bg" },
  { pattern: /\bbg-green-\d+/, suggestion: "Use bg-success-bg" },
  { pattern: /\bbg-yellow-\d+/, suggestion: "Use bg-warning-bg" },
  { pattern: /\bbg-orange-\d+/, suggestion: "Use bg-warning-bg" },
  { pattern: /\bborder-red-\d+/, suggestion: "Use border-danger-border" },
  { pattern: /\bborder-green-\d+/, suggestion: "Use border-success-border" },
  { pattern: /\bborder-yellow-\d+/, suggestion: "Use border-warning-border" },
  // Raw grays — use semantic surface/text tokens
  { pattern: /\bbg-gray-\d+/, suggestion: "Use bg-surface or bg-base" },
  { pattern: /\btext-gray-\d+/, suggestion: "Use text-secondary or text-tertiary" },
  { pattern: /\bborder-gray-\d+/, suggestion: "Use border-default or border-subtle" },
]

let violations = 0

const files = globSync("src/**/*.{tsx,ts}", {
  cwd: process.cwd(),
  ignore: ["**/node_modules/**"],
})

for (const file of files) {
  const content = readFileSync(file, "utf-8")
  const lines = content.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const { pattern, suggestion } of FORBIDDEN_PATTERNS) {
      const match = line.match(pattern)
      if (match) {
        console.error(`${file}:${i + 1}: ${match[0]} → ${suggestion}`)
        violations++
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} forbidden color(s) found. Use semantic tokens instead.`)
  process.exit(1)
} else {
  console.log("No forbidden color violations found.")
  process.exit(0)
}
