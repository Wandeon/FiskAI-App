#!/usr/bin/env npx tsx
// src/lib/regulatory-truth/scripts/run-consolidator.ts
// Manual script to run consolidation and clean up duplicate rules
//
// Usage:
//   npx tsx src/lib/regulatory-truth/scripts/run-consolidator.ts --dry-run --report
//   npx tsx src/lib/regulatory-truth/scripts/run-consolidator.ts --apply --report
//
// Options:
//   --dry-run    Preview what would be changed without making changes (default)
//   --apply      Actually apply changes (explicit flag required for safety)
//   --report     Generate detailed report file for audit

import { db } from "@/lib/db"
import { runConsolidation, findDuplicateRuleGroups } from "../utils/consolidator"
import * as fs from "fs"
import * as path from "path"

interface Stats {
  rulesByStatus: Record<string, number>
  totalRules: number
  totalPointers: number
  totalConcepts: number
  duplicateGroups: number
  duplicateRulesCount: number
  testDataPointers: number
  testDataRules: number
}

async function gatherStats(): Promise<Stats> {
  const rulesByStatus = await db.regulatoryRule.groupBy({
    by: ["status"],
    _count: { status: true },
  })

  const totalRules = await db.regulatoryRule.count()
  const totalPointers = await db.sourcePointer.count({ where: { deletedAt: null } })
  const totalConcepts = await db.concept.count()

  const duplicateGroups = await findDuplicateRuleGroups()
  const duplicateRulesCount = duplicateGroups.reduce((sum, g) => sum + g.rules.length - 1, 0)

  // Count test data
  const testDataPointers = await db.sourcePointer.count({
    where: {
      OR: [
        { domain: { contains: "heartbeat" } },
        { domain: { contains: "test" } },
        { domain: { contains: "synthetic" } },
        { domain: { contains: "debug" } },
      ],
      deletedAt: null,
    },
  })

  const testDataRules = await db.regulatoryRule.count({
    where: {
      sourcePointers: {
        some: {
          OR: [
            { domain: { contains: "heartbeat" } },
            { domain: { contains: "test" } },
            { domain: { contains: "synthetic" } },
            { domain: { contains: "debug" } },
          ],
        },
      },
      status: { notIn: ["REJECTED", "DEPRECATED"] },
    },
  })

  return {
    rulesByStatus: Object.fromEntries(rulesByStatus.map((r) => [r.status, r._count.status])),
    totalRules,
    totalPointers,
    totalConcepts,
    duplicateGroups: duplicateGroups.length,
    duplicateRulesCount,
    testDataPointers,
    testDataRules,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes("--apply")
  const generateReport = args.includes("--report")

  console.log("=".repeat(70))
  console.log(`CONSOLIDATOR - ${dryRun ? "DRY RUN (use --apply to write)" : "APPLYING CHANGES"}`)
  console.log("=".repeat(70))
  console.log()

  // Gather BEFORE stats
  console.log("Gathering BEFORE statistics...")
  const beforeStats = await gatherStats()

  console.log("\n--- BEFORE STATE ---")
  console.log(`Total Rules: ${beforeStats.totalRules}`)
  console.log(`Rules by Status:`)
  for (const [status, count] of Object.entries(beforeStats.rulesByStatus)) {
    console.log(`  ${status}: ${count}`)
  }
  console.log(`Total Source Pointers: ${beforeStats.totalPointers}`)
  console.log(`Total Concepts: ${beforeStats.totalConcepts}`)
  console.log(`Duplicate Groups: ${beforeStats.duplicateGroups}`)
  console.log(`Rules that are duplicates: ${beforeStats.duplicateRulesCount}`)
  console.log(`Test/Heartbeat Pointers: ${beforeStats.testDataPointers}`)
  console.log(`Test/Heartbeat Rules: ${beforeStats.testDataRules}`)
  console.log()

  // Show duplicate groups in detail
  console.log("-".repeat(70))
  console.log("DUPLICATE GROUPS DETAIL")
  console.log("-".repeat(70))

  const groups = await findDuplicateRuleGroups()

  if (groups.length === 0) {
    console.log("No duplicate rule groups found!")
  } else {
    console.log(`Found ${groups.length} duplicate groups:\n`)

    for (const group of groups) {
      console.log(`  [${group.canonicalSlug}]`)
      console.log(`    Value: "${group.value}" (${group.valueType})`)
      console.log(`    Rules to merge: ${group.rules.length}`)

      // Show which will be kept vs rejected
      const sorted = [...group.rules].sort((a, b) => {
        const statusOrder: Record<string, number> = {
          PUBLISHED: 0,
          APPROVED: 1,
          PENDING_REVIEW: 2,
          DRAFT: 3,
        }
        return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
      })

      const kept = sorted[0]
      const rejected = sorted.slice(1)

      console.log(
        `    KEEP: ${kept.id.slice(0, 12)} (${kept.conceptSlug}, ${kept.status}, ${kept.sourcePointerCount} ptrs)`
      )
      for (const rej of rejected) {
        console.log(
          `    REJECT: ${rej.id.slice(0, 12)} (${rej.conceptSlug}, ${rej.status}, ${rej.sourcePointerCount} ptrs)`
        )
      }
      console.log()
    }
  }

  // Run consolidation
  console.log("-".repeat(70))
  console.log(`RUNNING CONSOLIDATION ${dryRun ? "(DRY RUN)" : "(APPLYING)"}`)
  console.log("-".repeat(70))

  const result = await runConsolidation(dryRun)

  console.log()
  console.log("CONSOLIDATION RESULTS:")
  console.log(`  Success: ${result.success}`)
  console.log(`  Rules merged: ${result.mergedRules}`)
  console.log(`  Rules quarantined (test data): ${result.quarantinedRules}`)
  console.log(`  Concepts merged: ${result.mergedConcepts}`)
  console.log(`  Pointers reassigned: ${result.pointersReassigned}`)

  if (result.errors.length > 0) {
    console.log(`\n  Errors (${result.errors.length}):`)
    for (const error of result.errors) {
      console.log(`    - ${error}`)
    }
  }

  // Gather AFTER stats (only meaningful if not dry run)
  let afterStats: Stats | null = null
  if (!dryRun) {
    console.log("\nGathering AFTER statistics...")
    afterStats = await gatherStats()

    console.log("\n--- AFTER STATE ---")
    console.log(`Total Rules: ${afterStats.totalRules}`)
    console.log(`Rules by Status:`)
    for (const [status, count] of Object.entries(afterStats.rulesByStatus)) {
      console.log(`  ${status}: ${count}`)
    }
    console.log(`Total Source Pointers: ${afterStats.totalPointers}`)
    console.log(`Total Concepts: ${afterStats.totalConcepts}`)
    console.log(`Duplicate Groups: ${afterStats.duplicateGroups}`)
    console.log(`Rules that are duplicates: ${afterStats.duplicateRulesCount}`)
    console.log(`Test/Heartbeat Pointers: ${afterStats.testDataPointers}`)
    console.log(`Test/Heartbeat Rules: ${afterStats.testDataRules}`)

    // Show improvement
    console.log("\n--- IMPROVEMENT ---")
    const dupReduction = beforeStats.duplicateRulesCount - afterStats.duplicateRulesCount
    const dupPercent =
      beforeStats.duplicateRulesCount > 0
        ? ((dupReduction / beforeStats.duplicateRulesCount) * 100).toFixed(1)
        : "N/A"
    console.log(
      `Duplicates reduced: ${beforeStats.duplicateRulesCount} -> ${afterStats.duplicateRulesCount} (${dupPercent}% reduction)`
    )
    console.log(`Test data removed: ${beforeStats.testDataRules} -> ${afterStats.testDataRules}`)
  }

  // Generate report file if requested
  if (generateReport) {
    const reportDir = path.join(
      process.cwd(),
      "docs",
      "regulatory-truth",
      "audit-artifacts",
      new Date().toISOString().slice(0, 10)
    )

    // Ensure directory exists
    fs.mkdirSync(reportDir, { recursive: true })

    const reportPath = path.join(
      reportDir,
      `consolidation-${dryRun ? "dry-run" : "applied"}-${Date.now()}.json`
    )

    const report = {
      timestamp: new Date().toISOString(),
      mode: dryRun ? "DRY_RUN" : "APPLIED",
      before: beforeStats,
      after: afterStats,
      result: {
        success: result.success,
        mergedRules: result.mergedRules,
        quarantinedRules: result.quarantinedRules,
        mergedConcepts: result.mergedConcepts,
        pointersReassigned: result.pointersReassigned,
        errorCount: result.errors.length,
        errors: result.errors,
      },
      duplicateGroups: groups.map((g) => ({
        canonicalSlug: g.canonicalSlug,
        value: g.value,
        valueType: g.valueType,
        ruleCount: g.rules.length,
        ruleSlugs: g.rules.map((r) => r.conceptSlug),
      })),
      auditLog: result.auditLog,
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n[REPORT] Written to: ${reportPath}`)
  }

  if (dryRun) {
    console.log("\n" + "=".repeat(70))
    console.log("[DRY RUN] No changes were made.")
    console.log("Run with --apply to execute consolidation:")
    console.log("  npx tsx src/lib/regulatory-truth/scripts/run-consolidator.ts --apply --report")
    console.log("=".repeat(70))
  }

  process.exit(result.success ? 0 : 1)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
