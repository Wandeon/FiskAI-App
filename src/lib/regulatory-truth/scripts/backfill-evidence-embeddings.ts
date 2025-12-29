/**
 * Backfill Evidence Embeddings
 *
 * Generates vector embeddings for existing Evidence records that don't have embeddings yet.
 * This enables semantic duplicate detection for historical evidence.
 *
 * Usage:
 *   npx tsx src/lib/regulatory-truth/scripts/backfill-evidence-embeddings.ts [--batch-size=10] [--limit=100]
 *
 * Options:
 *   --batch-size  Number of evidence records to process in each batch (default: 10)
 *   --limit       Maximum total records to process (default: unlimited)
 *   --dry-run     Show what would be processed without making changes
 */

import {
  findEvidenceWithoutEmbeddings,
  generateEvidenceEmbeddingsBatch,
  getEmbeddingStats,
} from "../utils/evidence-embedder"

async function main() {
  const args = process.argv.slice(2)
  const batchSize = parseInt(args.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] ?? "10")
  const limit = parseInt(args.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? "0")
  const dryRun = args.includes("--dry-run")

  console.log("Evidence Embedding Backfill")
  console.log("===========================")
  console.log(`Batch size: ${batchSize}`)
  console.log(`Limit: ${limit || "unlimited"}`)
  console.log(`Dry run: ${dryRun}`)
  console.log()

  // Get initial stats
  const initialStats = await getEmbeddingStats()
  console.log("Initial Statistics:")
  console.log(`  Total Evidence: ${initialStats.total}`)
  console.log(`  With embeddings: ${initialStats.withEmbedding} (${initialStats.percentage.toFixed(1)}%)`)
  console.log(`  Without embeddings: ${initialStats.withoutEmbedding}`)
  console.log()

  if (initialStats.withoutEmbedding === 0) {
    console.log("No Evidence records need embeddings. Exiting.")
    return
  }

  if (dryRun) {
    const sample = await findEvidenceWithoutEmbeddings(10)
    console.log("Dry run - would process these Evidence records:")
    for (const evidence of sample) {
      console.log(`  - ${evidence.id}: ${evidence.url}`)
    }
    console.log(`  ... and ${Math.max(0, initialStats.withoutEmbedding - 10)} more`)
    return
  }

  // Process in batches
  let processedCount = 0
  let successCount = 0
  let errorCount = 0

  while (true) {
    // Check if we've hit the limit
    if (limit > 0 && processedCount >= limit) {
      console.log(`\nReached limit of ${limit} records. Stopping.`)
      break
    }

    // Fetch next batch
    const remaining = limit > 0 ? limit - processedCount : batchSize
    const batch = await findEvidenceWithoutEmbeddings(Math.min(batchSize, remaining))

    if (batch.length === 0) {
      console.log("\nNo more Evidence records to process. Done!")
      break
    }

    console.log(`\nProcessing batch of ${batch.length} Evidence records...`)

    try {
      // Generate embeddings in batch
      const evidenceIds = batch.map((e) => e.id)
      const results = await generateEvidenceEmbeddingsBatch(evidenceIds)

      successCount += results.size
      errorCount += batch.length - results.size
      processedCount += batch.length

      // Log progress
      for (const evidence of batch) {
        const success = results.has(evidence.id)
        const status = success ? "✓" : "✗"
        console.log(`  ${status} ${evidence.id}: ${evidence.url.substring(0, 80)}`)
      }

      console.log(
        `  Progress: ${processedCount} processed, ${successCount} success, ${errorCount} errors`
      )
    } catch (error) {
      console.error(`Batch processing failed:`, error)
      errorCount += batch.length
      processedCount += batch.length
    }

    // Small delay between batches to avoid overloading the API
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  // Get final stats
  console.log("\n===========================")
  const finalStats = await getEmbeddingStats()
  console.log("Final Statistics:")
  console.log(`  Total Evidence: ${finalStats.total}`)
  console.log(`  With embeddings: ${finalStats.withEmbedding} (${finalStats.percentage.toFixed(1)}%)`)
  console.log(`  Without embeddings: ${finalStats.withoutEmbedding}`)
  console.log()
  console.log("Summary:")
  console.log(`  Processed: ${processedCount}`)
  console.log(`  Success: ${successCount}`)
  console.log(`  Errors: ${errorCount}`)
  console.log(
    `  Improvement: ${(finalStats.percentage - initialStats.percentage).toFixed(1)}% increase in coverage`
  )
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
