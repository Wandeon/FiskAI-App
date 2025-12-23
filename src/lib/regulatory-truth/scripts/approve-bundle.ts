#!/usr/bin/env tsx
// src/lib/regulatory-truth/scripts/approve-bundle.ts
// Approve or reject rules from review bundles

import { cliDb as db } from "../cli-db"
import { logAuditEvent } from "../utils/audit-log"
import { closeCliDb } from "../cli-db"

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  const help = args.includes("--help") || args.includes("-h")
  const idsArg = args.find((_, i, a) => a[i - 1] === "--ids")
  const reject = args.includes("--reject")
  const autoRelease = args.includes("--release")
  const reason = args.find((_, i, a) => a[i - 1] === "--reason")

  if (help || !idsArg) {
    console.log(`
Review Bundle Approval Script
==============================

Approve or reject rules from review bundles.

Usage: npx tsx src/lib/regulatory-truth/scripts/approve-bundle.ts --ids "id1,id2,id3" [options]

Options:
  --ids "id1,id2,..."  Comma-separated list of rule IDs to process (required)
  --reject             Reject rules instead of approving them
  --release            Automatically release approved rules (creates new version)
  --reason "text"      Rejection reason (required if --reject is used)
  --help, -h           Show this help

Examples:
  # Approve a single rule
  npx tsx src/lib/regulatory-truth/scripts/approve-bundle.ts --ids "cm5abc123"

  # Approve multiple rules and release them
  npx tsx src/lib/regulatory-truth/scripts/approve-bundle.ts --ids "cm5abc123,cm5def456" --release

  # Reject a rule with reason
  npx tsx src/lib/regulatory-truth/scripts/approve-bundle.ts --ids "cm5abc123" --reject --reason "Insufficient evidence"
`)
    await closeCliDb()
    process.exit(idsArg ? 0 : 1)
  }

  // Validate rejection requires reason
  if (reject && !reason) {
    console.error("Error: --reject requires --reason to be specified")
    await closeCliDb()
    process.exit(1)
  }

  const ids = idsArg.split(",").map((id) => id.trim())
  console.log(`${reject ? "Rejecting" : "Approving"} ${ids.length} rules...`)

  let processed = 0
  const errors: Array<{ id: string; error: string }> = []

  for (const id of ids) {
    try {
      // Verify rule exists and is in PENDING_REVIEW status
      const rule = await db.regulatoryRule.findUnique({
        where: { id },
        select: {
          id: true,
          conceptSlug: true,
          status: true,
          riskTier: true,
        },
      })

      if (!rule) {
        throw new Error(`Rule not found: ${id}`)
      }

      if (rule.status !== "PENDING_REVIEW") {
        throw new Error(`Rule ${id} is not in PENDING_REVIEW status (current: ${rule.status})`)
      }

      if (!["T0", "T1"].includes(rule.riskTier)) {
        throw new Error(
          `Cannot manually approve ${rule.riskTier} rule via review bundle. Use auto-approval.`
        )
      }

      if (reject) {
        // Reject the rule by moving it to REJECTED with reviewer notes
        await db.regulatoryRule.update({
          where: { id },
          data: {
            status: "REJECTED",
            reviewerNotes: reason || "Rejected during review",
          },
        })

        await logAuditEvent({
          action: "RULE_REJECTED",
          entityType: "RULE",
          entityId: id,
          metadata: {
            rejected_via: "review_bundle",
            reason: reason || "No reason provided",
            conceptSlug: rule.conceptSlug,
            riskTier: rule.riskTier,
          },
        })

        console.log(`✗ Rejected: ${rule.conceptSlug} (${id})`)
      } else {
        // Approve the rule
        await db.regulatoryRule.update({
          where: { id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            approvedBy: "HUMAN_REVIEW",
          },
        })

        await logAuditEvent({
          action: "RULE_APPROVED",
          entityType: "RULE",
          entityId: id,
          metadata: {
            approved_via: "review_bundle",
            conceptSlug: rule.conceptSlug,
            riskTier: rule.riskTier,
          },
        })

        console.log(`✓ Approved: ${rule.conceptSlug} (${id})`)
      }

      processed++
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      errors.push({ id, error: errorMsg })
      console.error(`✗ Failed: ${id} - ${errorMsg}`)
    }
  }

  console.log(`\n${reject ? "Rejected" : "Approved"} ${processed}/${ids.length} rules`)

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`)
    for (const { id, error } of errors) {
      console.log(`  - ${id}: ${error}`)
    }
  }

  // Optionally release approved rules
  if (autoRelease && !reject && processed > 0) {
    console.log("\n" + "=".repeat(72))
    console.log("Releasing approved rules...")

    try {
      // Import releaser dynamically to avoid circular dependencies
      const { runReleaser } = await import("../agents/releaser")

      const result = await runReleaser(ids.filter((id) => !errors.find((e) => e.id === id)))

      if (result.success) {
        console.log(
          `✓ Released ${result.publishedRuleIds.length} rules as version ${result.output?.version}`
        )
      } else {
        console.error("✗ Release failed:", result.error)
      }
    } catch (error) {
      console.error("✗ Release failed:", error instanceof Error ? error.message : String(error))
    }
  }

  await closeCliDb()

  // Exit with error code if any operations failed
  if (errors.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Approval failed:", err)
  process.exit(1)
})
