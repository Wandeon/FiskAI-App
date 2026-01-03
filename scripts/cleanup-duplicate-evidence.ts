/**
 * Cleanup duplicate Evidence records before adding unique constraint.
 *
 * Strategy:
 * 1. Find duplicates by (url, contentHash)
 * 2. Keep the NEWEST record (latest fetchedAt)
 * 3. Migrate all SourcePointers and AgentRuns to the newest record
 * 4. Soft-delete the older duplicate records (set deletedAt)
 *
 * NOTE: Evidence is in regulatory schema (dbReg), but SourcePointer and AgentRun
 * are in core schema (db) with soft references to evidenceId.
 */

import { db } from "../src/lib/db"
import { dbReg } from "../src/lib/db/regulatory"

interface DuplicateGroup {
  url: string
  contentHash: string
  count: bigint
}

async function cleanupDuplicateEvidence() {
  console.log("Starting Evidence deduplication cleanup...")

  // Find all duplicate groups
  const duplicates = await dbReg.$queryRaw<DuplicateGroup[]>`
    SELECT url, "contentHash", COUNT(*)::bigint as count
    FROM "Evidence"
    WHERE "deletedAt" IS NULL
    GROUP BY url, "contentHash"
    HAVING COUNT(*) > 1
  `

  console.log(`Found ${duplicates.length} duplicate groups`)

  if (duplicates.length === 0) {
    console.log("No duplicates found. Nothing to clean up.")
    return
  }

  for (const dup of duplicates) {
    console.log(`\n--- Processing duplicate: ${dup.url.slice(0, 60)}...`)
    console.log(`    Content hash: ${dup.contentHash}`)
    console.log(`    Duplicate count: ${dup.count}`)

    // Get all Evidence records for this (url, contentHash) combination
    const records = await dbReg.evidence.findMany({
      where: {
        url: dup.url,
        contentHash: dup.contentHash,
        deletedAt: null,
      },
      orderBy: {
        fetchedAt: "desc", // Newest first
      },
    })

    if (records.length < 2) {
      console.log(`    Skipping - only ${records.length} record(s) found`)
      continue
    }

    // Keep the newest record (first in sorted list)
    const keepRecord = records[0]
    const deleteRecords = records.slice(1)

    // Get counts from core db (SourcePointer and AgentRun are in core schema)
    const keepPointerCount = await db.sourcePointer.count({
      where: { evidenceId: keepRecord.id },
    })
    const keepAgentRunCount = await db.agentRun.count({
      where: { evidenceId: keepRecord.id },
    })

    console.log(`    Keeping: ${keepRecord.id} (fetchedAt: ${keepRecord.fetchedAt.toISOString()})`)
    console.log(`             ${keepPointerCount} pointers, ${keepAgentRunCount} runs`)

    // Migrate all relationships from older records to the newest record
    for (const oldRecord of deleteRecords) {
      const oldPointerCount = await db.sourcePointer.count({
        where: { evidenceId: oldRecord.id },
      })
      const oldAgentRunCount = await db.agentRun.count({
        where: { evidenceId: oldRecord.id },
      })

      console.log(
        `    Migrating from: ${oldRecord.id} (fetchedAt: ${oldRecord.fetchedAt.toISOString()})`
      )
      console.log(`                    ${oldPointerCount} pointers, ${oldAgentRunCount} runs`)

      // Migrate SourcePointers (in core db)
      if (oldPointerCount > 0) {
        await db.sourcePointer.updateMany({
          where: { evidenceId: oldRecord.id },
          data: { evidenceId: keepRecord.id },
        })
        console.log(`        ✓ Migrated ${oldPointerCount} SourcePointers`)
      }

      // Migrate AgentRuns (in core db)
      if (oldAgentRunCount > 0) {
        await db.agentRun.updateMany({
          where: { evidenceId: oldRecord.id },
          data: { evidenceId: keepRecord.id },
        })
        console.log(`        ✓ Migrated ${oldAgentRunCount} AgentRuns`)
      }

      // Soft-delete the old record (Evidence hard-delete is prohibited)
      await dbReg.evidence.update({
        where: { id: oldRecord.id },
        data: { deletedAt: new Date() },
      })
      console.log(`        ✓ Soft-deleted old Evidence record ${oldRecord.id}`)
    }

    console.log(`    ✓ Completed merge for this duplicate group`)
  }

  // Verify no duplicates remain
  const remainingDuplicates = await dbReg.$queryRaw<DuplicateGroup[]>`
    SELECT url, "contentHash", COUNT(*)::bigint as count
    FROM "Evidence"
    WHERE "deletedAt" IS NULL
    GROUP BY url, "contentHash"
    HAVING COUNT(*) > 1
  `

  if (remainingDuplicates.length === 0) {
    console.log("\n✓ All duplicates successfully cleaned up!")
  } else {
    console.log(`\n⚠ Warning: ${remainingDuplicates.length} duplicate groups still remain`)
  }
}

// Run the cleanup
cleanupDuplicateEvidence()
  .then(() => {
    console.log("\nCleanup complete.")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Cleanup failed:", error)
    process.exit(1)
  })
