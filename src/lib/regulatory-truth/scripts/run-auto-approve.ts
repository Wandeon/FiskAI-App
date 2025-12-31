#!/usr/bin/env tsx
// src/lib/regulatory-truth/scripts/run-auto-approve.ts
// Manually trigger auto-approval for eligible PENDING_REVIEW rules
//
// This wraps the autoApproveEligibleRules function from the reviewer agent
// to allow manual execution for testing and batch operations

import { closeCliDb } from "../cli-db"
import { autoApproveEligibleRules } from "../agents/reviewer"

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Auto-Approve Eligible Rules
============================

Automatically approve PENDING_REVIEW rules that meet grace period criteria:
  - In PENDING_REVIEW status for at least 24 hours
  - Confidence >= 0.90
  - Risk tier is T2 or T3 (T0/T1 never auto-approve)
  - No open conflicts

This is normally run by the reviewer worker, but can be triggered manually
for batch operations.

Usage: npx tsx src/lib/regulatory-truth/scripts/run-auto-approve.ts [options]

Options:
  --help, -h  Show this help

Environment Variables:
  AUTO_APPROVE_GRACE_HOURS      Grace period in hours (default: 24)
  AUTO_APPROVE_MIN_CONFIDENCE   Minimum confidence (default: 0.90)

Examples:
  # Run with default settings (24h grace, 0.90 confidence)
  npx tsx src/lib/regulatory-truth/scripts/run-auto-approve.ts

  # Run with 48h grace period
  AUTO_APPROVE_GRACE_HOURS=48 npx tsx src/lib/regulatory-truth/scripts/run-auto-approve.ts

  # Run with higher confidence threshold
  AUTO_APPROVE_MIN_CONFIDENCE=0.95 npx tsx src/lib/regulatory-truth/scripts/run-auto-approve.ts
`)
    await closeCliDb()
    process.exit(0)
  }

  console.log("=".repeat(72))
  console.log("Auto-Approve Eligible Rules")
  console.log("=".repeat(72))

  const gracePeriodHours = parseInt(process.env.AUTO_APPROVE_GRACE_HOURS || "24")
  const minConfidence = parseFloat(process.env.AUTO_APPROVE_MIN_CONFIDENCE || "0.90")

  console.log(`Grace period: ${gracePeriodHours} hours`)
  console.log(`Min confidence: ${minConfidence}`)
  console.log("")

  try {
    const result = await autoApproveEligibleRules()

    console.log("\n" + "=".repeat(72))
    console.log("Auto-Approval Complete")
    console.log("=".repeat(72))
    console.log(`Approved: ${result.approved}`)
    console.log(`Skipped: ${result.skipped}`)
    console.log(`Errors: ${result.errors.length}`)

    if (result.errors.length > 0) {
      console.log("\nErrors:")
      for (const error of result.errors) {
        console.log(`  - ${error}`)
      }
    }

    await closeCliDb()

    // Exit with error if there were failures
    if (result.errors.length > 0) {
      process.exit(1)
    }
  } catch (error) {
    console.error("Auto-approval failed:", error)
    await closeCliDb()
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Script failed:", err)
  closeCliDb().finally(() => process.exit(1))
})
