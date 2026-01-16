// scripts/cleanup-orphan-pointers.ts
// Phase 2: Clean up source pointers that reference non-existent evidence
//
// Usage:
//   npx tsx scripts/cleanup-orphan-pointers.ts --dry-run   # Preview changes
//   npx tsx scripts/cleanup-orphan-pointers.ts             # Execute cleanup

import "dotenv/config"
import { db, dbReg } from "../src/lib/db"

const DRY_RUN = process.argv.includes("--dry-run")

async function cleanupOrphanPointers() {
  console.log(`\n=== Orphan Pointer Cleanup (${DRY_RUN ? "DRY RUN" : "EXECUTING"}) ===\n`)

  // Step 1: Get all evidence IDs that exist in regulatory DB
  console.log("Step 1: Loading valid evidence IDs...")
  const existingEvidence = await dbReg.evidence.findMany({
    select: { id: true },
  })
  const validEvidenceIds = new Set(existingEvidence.map((e) => e.id))
  console.log(`  Valid evidence IDs: ${validEvidenceIds.size}`)

  // Step 2: Get all source pointers with their evidence IDs
  console.log("\nStep 2: Finding source pointers...")
  const allPointers = await db.sourcePointer.findMany({
    select: {
      id: true,
      evidenceId: true,
      matchType: true,
      rules: { select: { id: true, conceptSlug: true, status: true } },
    },
  })
  console.log(`  Total source pointers: ${allPointers.length}`)

  // Step 3: Identify orphaned pointers
  console.log("\nStep 3: Identifying orphaned pointers...")
  const orphanedPointers = allPointers.filter((p) => !validEvidenceIds.has(p.evidenceId))
  console.log(`  Orphaned pointers: ${orphanedPointers.length}`)

  if (orphanedPointers.length === 0) {
    console.log("\nNo orphaned pointers found. Nothing to clean up.")
    await db.$disconnect()
    return
  }

  // Step 4: Identify affected rules
  console.log("\nStep 4: Identifying affected rules...")
  const affectedRuleIds = new Set<string>()
  const affectedRuleSlugs: string[] = []

  for (const pointer of orphanedPointers) {
    for (const rule of pointer.rules) {
      if (!affectedRuleIds.has(rule.id)) {
        affectedRuleIds.add(rule.id)
        affectedRuleSlugs.push(`${rule.conceptSlug} (${rule.status})`)
      }
    }
  }

  console.log(`  Affected rules: ${affectedRuleIds.size}`)
  if (affectedRuleSlugs.length <= 10) {
    for (const slug of affectedRuleSlugs) {
      console.log(`    - ${slug}`)
    }
  } else {
    for (const slug of affectedRuleSlugs.slice(0, 10)) {
      console.log(`    - ${slug}`)
    }
    console.log(`    ... and ${affectedRuleSlugs.length - 10} more`)
  }

  // Step 5: Show orphaned evidence IDs (for debugging)
  const orphanedEvidenceIds = new Set(orphanedPointers.map((p) => p.evidenceId))
  console.log(`\nStep 5: Orphaned evidence IDs (${orphanedEvidenceIds.size} unique):`)
  const sampleIds = [...orphanedEvidenceIds].slice(0, 5)
  for (const id of sampleIds) {
    console.log(`    ${id}`)
  }
  if (orphanedEvidenceIds.size > 5) {
    console.log(`    ... and ${orphanedEvidenceIds.size - 5} more`)
  }

  if (DRY_RUN) {
    console.log("\n=== DRY RUN COMPLETE ===")
    console.log("\nTo execute cleanup, run without --dry-run flag:")
    console.log("  npx tsx scripts/cleanup-orphan-pointers.ts")
    await db.$disconnect()
    return
  }

  // Step 6: Delete orphaned pointers
  console.log("\nStep 6: Deleting orphaned pointers...")
  const orphanedIds = orphanedPointers.map((p) => p.id)

  // First, disconnect pointers from rules (many-to-many)
  await db.$executeRaw`
    DELETE FROM "_RegulatoryRuleToSourcePointer"
    WHERE "B" IN (${orphanedIds.join(",")})
  `.catch(() => {
    // If raw SQL fails, do it through Prisma
    console.log("  Using Prisma to disconnect pointers from rules...")
  })

  // Delete the pointers
  const deleteResult = await db.sourcePointer.deleteMany({
    where: { id: { in: orphanedIds } },
  })
  console.log(`  Deleted ${deleteResult.count} orphaned pointers`)

  // Step 7: Reset affected rules to DRAFT for re-extraction
  console.log("\nStep 7: Resetting affected rules to DRAFT...")

  // Only reset rules that are in PENDING_REVIEW (not already DRAFT or PUBLISHED)
  const rulesToReset = await db.regulatoryRule.findMany({
    where: {
      id: { in: [...affectedRuleIds] },
      status: "PENDING_REVIEW",
    },
    select: { id: true, conceptSlug: true },
  })

  if (rulesToReset.length > 0) {
    const updateResult = await db.regulatoryRule.updateMany({
      where: { id: { in: rulesToReset.map((r) => r.id) } },
      data: { status: "DRAFT" },
    })
    console.log(`  Reset ${updateResult.count} rules to DRAFT`)
  } else {
    console.log("  No rules needed status reset")
  }

  // Step 8: Final verification
  console.log("\nStep 8: Final verification...")

  const remainingOrphans = await db.sourcePointer.count({
    where: { evidenceId: { notIn: [...validEvidenceIds] } },
  })
  console.log(`  Remaining orphaned pointers: ${remainingOrphans}`)

  const statusCounts = await db.regulatoryRule.groupBy({
    by: ["status"],
    _count: { id: true },
  })
  console.log("\n  Rule status distribution:")
  for (const { status, _count } of statusCounts) {
    console.log(`    ${status}: ${_count.id}`)
  }

  console.log("\n=== CLEANUP COMPLETE ===")
  console.log("\nNext steps:")
  console.log("  1. Trigger re-extraction for DRAFT rules")
  console.log("  2. Run: npx tsx scripts/run-rule-approval.ts --publish")

  await db.$disconnect()
}

cleanupOrphanPointers().catch(console.error)
