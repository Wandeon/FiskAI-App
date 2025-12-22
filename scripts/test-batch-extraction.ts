#!/usr/bin/env npx tsx
// scripts/test-batch-extraction.ts
// Test batch extraction with rate limiting

import { config } from "dotenv"
config() // Load .env file

import { db } from "../src/lib/db"
import { runExtractorBatch } from "../src/lib/regulatory-truth/agents"

async function test() {
  console.log("╔════════════════════════════════════════════════════════════════╗")
  console.log("║   BATCH EXTRACTION TEST                                        ║")
  console.log("╚════════════════════════════════════════════════════════════════╝")
  console.log(`\nStarted at: ${new Date().toISOString()}`)
  console.log(`API Key: ${process.env.OLLAMA_API_KEY?.slice(0, 20)}...`)
  console.log(`Model: ${process.env.OLLAMA_MODEL}`)

  // Check how many evidence records need processing
  const unprocessedCount = await db.evidence.count({
    where: { sourcePointers: { none: {} } },
  })
  const totalEvidence = await db.evidence.count()

  console.log(`\nEvidence records: ${totalEvidence} total, ${unprocessedCount} unprocessed`)

  if (unprocessedCount === 0) {
    console.log("\nNo unprocessed evidence. Checking existing pointers...")
    const pointerCount = await db.sourcePointer.count()
    console.log(`Source pointers in database: ${pointerCount}`)
    return
  }

  // Run batch extraction with limit of 5 for testing
  const batchSize = Math.min(5, unprocessedCount)
  console.log(`\nRunning batch extraction (${batchSize} items)...`)
  console.log("Note: 5 second delay between each extraction to avoid rate limiting\n")

  const startTime = Date.now()
  const result = await runExtractorBatch(batchSize)
  const duration = Date.now() - startTime

  console.log("\n" + "═".repeat(60))
  console.log("BATCH EXTRACTION RESULTS")
  console.log("═".repeat(60))
  console.log(`Duration: ${(duration / 1000).toFixed(1)} seconds`)
  console.log(`Processed: ${result.processed}`)
  console.log(`Failed: ${result.failed}`)
  console.log(
    `Success Rate: ${((result.processed / (result.processed + result.failed)) * 100).toFixed(1)}%`
  )
  console.log(`Source Pointers Created: ${result.sourcePointerIds.length}`)

  if (result.errors.length > 0) {
    console.log("\nErrors:")
    for (const error of result.errors) {
      console.log(`  - ${error.slice(0, 100)}...`)
    }
  }

  // Show new pointers
  if (result.sourcePointerIds.length > 0) {
    console.log("\nNew Source Pointers:")
    const pointers = await db.sourcePointer.findMany({
      where: { id: { in: result.sourcePointerIds } },
      include: { evidence: { include: { source: true } } },
    })

    for (const p of pointers) {
      console.log(`  - [${p.domain}] ${p.extractedValue}`)
      console.log(`    Source: ${p.evidence?.source?.name}`)
      console.log(`    Quote: "${p.exactQuote?.slice(0, 60)}..."`)
    }
  }

  // Final stats
  const finalPointerCount = await db.sourcePointer.count()
  const finalUnprocessed = await db.evidence.count({
    where: { sourcePointers: { none: {} } },
  })

  console.log("\n" + "═".repeat(60))
  console.log("FINAL DATABASE STATE")
  console.log("═".repeat(60))
  console.log(`Total Source Pointers: ${finalPointerCount}`)
  console.log(`Remaining Unprocessed Evidence: ${finalUnprocessed}`)
  console.log(`\nCompleted at: ${new Date().toISOString()}`)
}

test()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Test failed:", e)
    process.exit(1)
  })
