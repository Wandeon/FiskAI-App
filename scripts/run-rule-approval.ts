// scripts/run-rule-approval.ts
// Run the rule approval process for PENDING_REVIEW rules
// Usage: npx tsx scripts/run-rule-approval.ts [--dry-run] [--publish]

import "dotenv/config"
import { db, runWithRegulatoryContext } from "../src/lib/db"
import { approveRule, publishRules } from "../src/lib/regulatory-truth/services/rule-status-service"

const DRY_RUN = process.argv.includes("--dry-run")
const PUBLISH = process.argv.includes("--publish")

async function runRuleApproval() {
  console.log(`\n=== Rule Approval Process (${DRY_RUN ? "DRY RUN" : "EXECUTING"}) ===\n`)

  // Find all PENDING_REVIEW rules
  const pendingRules = await db.regulatoryRule.findMany({
    where: { status: "PENDING_REVIEW" },
    select: {
      id: true,
      conceptSlug: true,
      titleHr: true,
      riskTier: true,
      confidence: true,
    },
    orderBy: { confidence: "desc" },
  })

  console.log(`Found ${pendingRules.length} rules in PENDING_REVIEW status\n`)

  if (pendingRules.length === 0) {
    console.log("No rules to process.")
    await db.$disconnect()
    return
  }

  const approvedIds: string[] = []
  const failedIds: { id: string; slug: string; error: string }[] = []

  // Process each rule
  for (const rule of pendingRules) {
    console.log(
      `Processing: ${rule.conceptSlug} (${rule.riskTier}, conf: ${rule.confidence?.toFixed(2)})`
    )

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would attempt approval\n`)
      continue
    }

    // Use regulatory context with autoApprove for grace-period approval
    const result = await runWithRegulatoryContext(
      { source: "rule-approval-script", autoApprove: true },
      async () => {
        return approveRule(rule.id, "rule-approval-script", "rule-approval-script")
      }
    )

    if (result.success) {
      console.log(`  ✓ APPROVED (provenance validated)`)
      if (result.provenanceResult) {
        const matchTypes = result.provenanceResult.pointerResults.map(
          (p) => p.matchResult.matchType
        )
        console.log(`    Match types: ${matchTypes.join(", ")}`)
      }
      approvedIds.push(rule.id)
    } else {
      console.log(`  ✗ FAILED: ${result.error}`)
      failedIds.push({ id: rule.id, slug: rule.conceptSlug, error: result.error || "Unknown" })
    }
    console.log("")
  }

  // Summary
  console.log("=== Approval Summary ===")
  console.log(`Approved: ${approvedIds.length}`)
  console.log(`Failed: ${failedIds.length}`)

  if (failedIds.length > 0) {
    console.log("\nFailed rules:")
    for (const f of failedIds.slice(0, 10)) {
      console.log(`  - ${f.slug}: ${f.error.slice(0, 100)}`)
    }
    if (failedIds.length > 10) {
      console.log(`  ... and ${failedIds.length - 10} more`)
    }
  }

  // Optionally publish approved rules
  if (PUBLISH && approvedIds.length > 0 && !DRY_RUN) {
    console.log(`\n=== Publishing ${approvedIds.length} Approved Rules ===\n`)

    const publishResult = await publishRules(approvedIds, "rule-approval-script")

    if (publishResult.success) {
      console.log(`✓ Published ${publishResult.publishedCount} rules`)
    } else {
      console.log(`✗ Publish failed: ${publishResult.errors.join(", ")}`)
    }
  }

  // Final state
  const finalCounts = await db.regulatoryRule.groupBy({
    by: ["status"],
    _count: { id: true },
  })

  console.log("\n=== Final Rule Status ===")
  for (const g of finalCounts) {
    console.log(`  ${g.status}: ${g._count.id}`)
  }

  await db.$disconnect()
}

runRuleApproval().catch(console.error)
