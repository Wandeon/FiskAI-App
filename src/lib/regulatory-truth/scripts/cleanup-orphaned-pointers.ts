#!/usr/bin/env node
// src/lib/regulatory-truth/scripts/cleanup-orphaned-pointers.ts
// Find and retry composition for orphaned SourcePointers

import * as readline from "readline"
import { db } from "@/lib/db"
import {
  runComposer,
  groupSourcePointersByDomain,
  markOrphanedPointersForReview,
} from "../agents/composer"

async function cleanupOrphanedPointers() {
  console.log("=== Orphaned Pointer Cleanup ===\n")

  // Find all orphaned pointers (not linked to any rule)
  const orphanedPointers = await db.sourcePointer.findMany({
    where: {
      deletedAt: null,
      rules: {
        none: {},
      },
    },
    select: {
      id: true,
      domain: true,
      extractedValue: true,
      valueType: true,
      createdAt: true,
      extractionNotes: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  console.log(`Found ${orphanedPointers.length} orphaned SourcePointers\n`)

  if (orphanedPointers.length === 0) {
    console.log("No orphaned pointers to clean up. ✓")
    await db.$disconnect()
    return
  }

  // Show statistics
  const byDomain: Record<string, number> = {}
  const alreadyMarked = orphanedPointers.filter((p) =>
    p.extractionNotes?.includes("COMPOSITION_FAILED")
  )

  for (const pointer of orphanedPointers) {
    byDomain[pointer.domain] = (byDomain[pointer.domain] || 0) + 1
  }

  console.log("Orphaned pointers by domain:")
  for (const [domain, count] of Object.entries(byDomain).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${domain}: ${count}`)
  }

  console.log(`\nAlready marked for review: ${alreadyMarked.length}`)
  console.log(`Need retry: ${orphanedPointers.length - alreadyMarked.length}\n`)

  // Group by domain+value for composition
  const grouped = groupSourcePointersByDomain(orphanedPointers)
  const groups = Object.entries(grouped)

  console.log(`Grouped into ${groups.length} concept groups\n`)

  // Ask for confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const answer = await new Promise<string>((resolve) => {
    rl.question(`Retry composition for ${groups.length} groups? (y/N): `, resolve)
  })
  rl.close()

  if (answer.toLowerCase() !== "y") {
    console.log("Cancelled.")
    await db.$disconnect()
    return
  }

  // Retry composition for each group
  let success = 0
  let failed = 0

  for (const [groupKey, pointerIds] of groups) {
    console.log(`\nProcessing group: ${groupKey} (${pointerIds.length} pointers)`)

    try {
      const result = await runComposer(pointerIds)

      if (result.success) {
        success++
        console.log(`  ✓ Success - Rule: ${result.ruleId}`)
      } else {
        failed++
        console.log(`  ✗ Failed - ${result.error}`)
        // Mark for review
        await markOrphanedPointersForReview(pointerIds, result.error || "Retry failed")
      }
    } catch (error) {
      failed++
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.log(`  ✗ Error - ${errorMsg}`)
      await markOrphanedPointersForReview(pointerIds, errorMsg)
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log(`\n=== Summary ===`)
  console.log(`Success: ${success}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total groups: ${groups.length}`)

  await db.$disconnect()
}

cleanupOrphanedPointers().catch(console.error)
