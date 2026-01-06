#!/usr/bin/env npx tsx
/**
 * Backfill Evidence Embeddings
 *
 * Queues embedding generation jobs for all Evidence records with embeddingStatus=PENDING.
 * Run this after deploying the evidence-embedding worker.
 *
 * Usage: npx tsx scripts/backfill-evidence-embeddings.ts [--dry-run]
 */

import { dbReg } from "@/lib/db"
import { evidenceEmbeddingQueue } from "@/lib/regulatory-truth/workers/queues"

async function main() {
  const isDryRun = process.argv.includes("--dry-run")
  const runId = `backfill-${Date.now()}`

  console.log(`[backfill] Starting Evidence embedding backfill (runId: ${runId})`)
  if (isDryRun) {
    console.log("[backfill] DRY RUN MODE - no jobs will be queued")
  }

  // Find all Evidence with PENDING embedding status
  const pendingEvidence = await dbReg.evidence.findMany({
    where: {
      embeddingStatus: "PENDING",
      deletedAt: null,
    },
    select: {
      id: true,
      url: true,
    },
    orderBy: {
      fetchedAt: "desc",
    },
  })

  console.log(`[backfill] Found ${pendingEvidence.length} Evidence records with PENDING embeddings`)

  if (pendingEvidence.length === 0) {
    console.log("[backfill] No pending Evidence found. Done.")
    process.exit(0)
  }

  if (isDryRun) {
    console.log("[backfill] Would queue jobs for:")
    pendingEvidence.slice(0, 10).forEach((e) => {
      console.log(`  - ${e.id}: ${e.url}`)
    })
    if (pendingEvidence.length > 10) {
      console.log(`  ... and ${pendingEvidence.length - 10} more`)
    }
    process.exit(0)
  }

  // Queue jobs
  let queued = 0
  let skipped = 0

  for (const evidence of pendingEvidence) {
    try {
      await evidenceEmbeddingQueue.add(
        "generate-embedding",
        { evidenceId: evidence.id, runId },
        { jobId: `embed-${evidence.id}` }
      )
      queued++
      if (queued % 50 === 0) {
        console.log(`[backfill] Queued ${queued}/${pendingEvidence.length}...`)
      }
    } catch (error) {
      // Job with same ID may already exist
      if ((error as Error).message?.includes("Job")) {
        skipped++
      } else {
        console.error(`[backfill] Failed to queue ${evidence.id}:`, error)
      }
    }
  }

  console.log(`[backfill] Complete: queued=${queued}, skipped=${skipped}`)

  // Show queue status
  const counts = await evidenceEmbeddingQueue.getJobCounts()
  console.log(`[backfill] Queue status:`, counts)

  process.exit(0)
}

main().catch((error) => {
  console.error("[backfill] Fatal error:", error)
  process.exit(1)
})
