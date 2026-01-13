// src/lib/regulatory-truth/workers/sentinel.worker.ts
//
// Sentinel Worker: Discovery and initial routing
// Routes new evidence through scout for pre-LLM quality assessment.
//
import { Job } from "bullmq"
import { DiscoveryPriority } from "@prisma/client"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { scoutQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { runSentinel, fetchDiscoveredItems } from "../agents/sentinel"
import { db, dbReg } from "@/lib/db"

interface SentinelJobData {
  runId: string
  sourceId?: string
  priority?: DiscoveryPriority
}

async function processSentinelJob(job: Job<SentinelJobData>): Promise<JobResult> {
  const start = Date.now()
  const { runId, priority = "CRITICAL" } = job.data

  try {
    // Run sentinel discovery
    const result = await runSentinel(priority)

    // Fetch discovered items
    const fetchResult = await fetchDiscoveredItems(50)

    // Queue extract jobs for unprocessed evidence (no source pointers yet)
    // Use soft reference pattern: query SourcePointer to find processed evidence IDs
    const processedPointers = await db.sourcePointer.findMany({
      select: { evidenceId: true },
      distinct: ["evidenceId"],
    })
    const processedEvidenceIds = processedPointers.map((p) => p.evidenceId)

    const newEvidence = await dbReg.evidence.findMany({
      where: {
        id: { notIn: processedEvidenceIds.length > 0 ? processedEvidenceIds : ["__none__"] },
      },
      select: { id: true },
      orderBy: { fetchedAt: "desc" },
      take: 50,
    })

    // Route new evidence through scout for pre-LLM quality assessment
    // Scout → Router → (OCR|Extract|Skip) based on content quality and budget
    if (newEvidence.length > 0) {
      await scoutQueue.addBulk(
        newEvidence.map((e) => ({
          name: "scout",
          data: { evidenceId: e.id, runId, parentJobId: job.id },
          opts: { jobId: `scout-${e.id}` },
        }))
      )
      console.log(`[sentinel] Queued ${newEvidence.length} scout jobs`)
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
