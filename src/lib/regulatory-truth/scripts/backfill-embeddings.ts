#!/usr/bin/env tsx
/**
 * Backfill Embeddings Script
 *
 * Generates vector embeddings for existing SourcePointer records.
 * Processes in batches to avoid API rate limits and memory issues.
 *
 * Usage:
 *   npx tsx src/lib/regulatory-truth/scripts/backfill-embeddings.ts [--batch-size 50] [--dry-run]
 */

import {
  getEmbeddingStats,
  findPointersWithoutEmbeddings,
  generatePointerEmbeddingsBatch,
} from "../utils/rtl-embedder"

interface BackfillOptions {
  batchSize: number
  dryRun: boolean
}

async function backfillEmbeddings(options: BackfillOptions) {
  console.log("🚀 RTL Embedding Backfill")
  console.log("=" .repeat(60))

  // Get initial stats
  const initialStats = await getEmbeddingStats()
  console.log("\n📊 Initial Statistics:")
  console.log(`   Total SourcePointers: ${initialStats.total}`)
  console.log(`   With Embeddings: ${initialStats.withEmbedding}`)
  console.log(`   Without Embeddings: ${initialStats.withoutEmbedding}`)
  console.log(`   Coverage: ${initialStats.percentage.toFixed(2)}%`)

  if (initialStats.withoutEmbedding === 0) {
    console.log("\n✅ All SourcePointers already have embeddings!")
    return
  }

  if (options.dryRun) {
    console.log("\n🔍 DRY RUN - No changes will be made")
    const sample = await findPointersWithoutEmbeddings(5)
    console.log(`\nSample of ${sample.length} pointers without embeddings:`)
    for (const pointer of sample) {
      console.log(`   - ${pointer.id}: "${pointer.exactQuote.slice(0, 60)}..."`)
    }
    return
  }

  console.log(`\n🔄 Starting backfill (batch size: ${options.batchSize})...`)

  let processedCount = 0
  let successCount = 0
  let errorCount = 0
  let batchNumber = 0

  while (true) {
    batchNumber++

    // Fetch next batch
    const pointers = await findPointersWithoutEmbeddings(options.batchSize)

    if (pointers.length === 0) {
      console.log("\n✅ No more pointers to process")
      break
    }

    console.log(`\n📦 Batch ${batchNumber}: Processing ${pointers.length} pointers...`)

    try {
      // Generate embeddings in batch
      const results = await generatePointerEmbeddingsBatch(pointers.map((p) => p.id))

      successCount += results.size
      processedCount += pointers.length

      console.log(`   ✓ Generated ${results.size} embeddings`)

      if (results.size < pointers.length) {
        const failedCount = pointers.length - results.size
        errorCount += failedCount
        console.log(`   ⚠ ${failedCount} failed`)
      }
    } catch (error) {
      console.error(`   ✗ Batch failed:`, error)
      errorCount += pointers.length
      processedCount += pointers.length

      // Wait before retrying next batch
      console.log("   ⏸ Waiting 5 seconds before next batch...")
      await new Promise((resolve) => setTimeout(resolve, 5000))
      continue
    }

    // Rate limiting: wait between batches
    if (pointers.length === options.batchSize) {
      console.log("   ⏸ Waiting 2 seconds before next batch...")
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  // Get final stats
  const finalStats = await getEmbeddingStats()

  console.log("\n" + "=".repeat(60))
  console.log("📊 Final Statistics:")
  console.log(`   Total SourcePointers: ${finalStats.total}`)
  console.log(`   With Embeddings: ${finalStats.withEmbedding}`)
  console.log(`   Without Embeddings: ${finalStats.withoutEmbedding}`)
  console.log(`   Coverage: ${finalStats.percentage.toFixed(2)}%`)

  console.log("\n📈 Backfill Summary:")
  console.log(`   Processed: ${processedCount}`)
  console.log(`   Success: ${successCount}`)
  console.log(`   Errors: ${errorCount}`)
  console.log(
    `   Success Rate: ${processedCount > 0 ? ((successCount / processedCount) * 100).toFixed(2) : 0}%`
  )

  if (finalStats.withoutEmbedding === 0) {
    console.log("\n🎉 All SourcePointers now have embeddings!")
  } else {
    console.log(`\n⚠ ${finalStats.withoutEmbedding} pointers still need embeddings`)
  }
}

// Parse CLI arguments
function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2)

  let batchSize = 50
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === "--batch-size" && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10)
      i++
    } else if (arg === "--dry-run") {
      dryRun = true
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npx tsx backfill-embeddings.ts [options]")
      console.log("\nOptions:")
      console.log("  --batch-size N    Process N pointers per batch (default: 50)")
      console.log("  --dry-run         Show what would be done without making changes")
      console.log("  --help, -h        Show this help message")
      process.exit(0)
    }
  }

  return { batchSize, dryRun }
}

// Main execution
if (require.main === module) {
  const options = parseArgs()

  backfillEmbeddings(options)
    .then(() => {
      console.log("\n✅ Backfill complete")
      process.exit(0)
    })
    .catch((error) => {
      console.error("\n❌ Backfill failed:", error)
      process.exit(1)
    })
}

export { backfillEmbeddings }
