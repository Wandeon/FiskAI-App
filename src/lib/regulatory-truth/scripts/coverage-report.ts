#!/usr/bin/env tsx
// src/lib/regulatory-truth/scripts/coverage-report.ts

import { collectCoverageMetrics, formatCoverageReport } from "../utils/coverage-metrics"
import { closeCliDb } from "../cli-db"

async function main() {
  const metrics = await collectCoverageMetrics()
  console.log(formatCoverageReport(metrics))

  // Also output JSON for machine consumption
  if (process.argv.includes("--json")) {
    console.log("\n--- JSON ---\n")
    console.log(JSON.stringify(metrics, null, 2))
  }

  await closeCliDb()
}

main().catch((err) => {
  console.error("Coverage report failed:", err)
  process.exit(1)
})
