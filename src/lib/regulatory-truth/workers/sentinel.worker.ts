// src/lib/regulatory-truth/workers/sentinel.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { extractQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { runSentinel, fetchDiscoveredItems } from "../agents/sentinel"
import { db } from "@/lib/db"

interface SentinelJobData {
  runId: string
  sourceId?: string
  priority?: "CRITICAL" | "HIGH" | "NORMAL"
}

async function processSentinelJob(job: Job<SentinelJobData>): Promise<JobResult> {
  const start = Date.now()
  const { runId, priority = "CRITICAL" } = job.data

  try {
    // Run sentinel discovery
    const result = await runSentinel(priority)

    // Fetch discovered items
    const fetchResult = await fetchDiscoveredItems(50)

    // Queue extract jobs for new evidence
    if (fetchResult.fetched > 0) {
      const newEvidence = await db.evidence.findMany({
        where: {
          sourcePointers: { none: {} },
          fetchedAt: { gte: new Date(Date.now() - 3600000) }, // Last hour
        },
        select: { id: true },
        take: 50,
      })

      if (newEvidence.length > 0) {
        await extractQueue.addBulk(
          newEvidence.map((e) => ({
            name: "extract",
            data: { evidenceId: e.id, runId, parentJobId: job.id },
          }))
        )
        console.log(`[sentinel] Queued ${newEvidence.length} extract jobs`)
      }
    }

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "sentinel", status: "success", queue: "sentinel" })
    jobDuration.observe({ worker: "sentinel", queue: "sentinel" }, duration / 1000)

    return {
      success: true,
      duration,
      data: {
        endpointsChecked: result.endpointsChecked,
        newItemsDiscovered: result.newItemsDiscovered,
        fetched: fetchResult.fetched,
      },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "sentinel", status: "failed", queue: "sentinel" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
const worker = createWorker<SentinelJobData>("sentinel", processSentinelJob, {
  name: "sentinel",
  concurrency: 1, // Only one sentinel at a time
})

setupGracefulShutdown([worker])

console.log("[sentinel] Worker started")
