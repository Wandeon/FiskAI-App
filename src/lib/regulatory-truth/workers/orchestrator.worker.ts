// src/lib/regulatory-truth/workers/orchestrator.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { sentinelQueue, releaseQueue, arbiterQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { db } from "@/lib/db"
import { autoApproveEligibleRules } from "../agents/reviewer"

interface ScheduledJobData {
  type: "pipeline-run" | "audit" | "digest" | "auto-approve" | "arbiter-sweep" | "release-batch"
  runId: string
  triggeredBy?: string
}

async function processScheduledJob(job: Job<ScheduledJobData>): Promise<JobResult> {
  const start = Date.now()
  const { type, runId } = job.data

  try {
    switch (type) {
      case "pipeline-run": {
        // Kick off sentinel for all active sources
        const sources = await db.regulatorySource.findMany({
          where: { isActive: true },
          select: { id: true, hierarchy: true },
        })

        // Group by hierarchy and queue sentinels
        await sentinelQueue.add("sentinel-critical", {
          runId,
          priority: "CRITICAL",
        })

        await sentinelQueue.add(
          "sentinel-high",
          { runId, priority: "HIGH" },
          { delay: 60000 } // 1 min after critical
        )

        return { success: true, duration: Date.now() - start, data: { sources: sources.length } }
      }

      case "auto-approve": {
        const result = await autoApproveEligibleRules()
        return { success: true, duration: Date.now() - start, data: result }
      }

      case "arbiter-sweep": {
        const conflicts = await db.regulatoryConflict.findMany({
          where: { status: "OPEN" },
          select: { id: true },
          take: 10,
        })

        for (const c of conflicts) {
          await arbiterQueue.add("arbiter", { conflictId: c.id, runId })
        }

        return {
          success: true,
          duration: Date.now() - start,
          data: { conflicts: conflicts.length },
        }
      }

      case "release-batch": {
        const approved = await db.regulatoryRule.findMany({
          where: { status: "APPROVED", releases: { none: {} } },
          select: { id: true },
          take: 20,
        })

        if (approved.length > 0) {
          await releaseQueue.add("release", {
            ruleIds: approved.map((r) => r.id),
            runId,
          })
        }

        return { success: true, duration: Date.now() - start, data: { approved: approved.length } }
      }

      default:
        return { success: true, duration: Date.now() - start }
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "orchestrator", status: "failed", queue: "scheduled" })
    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    // Always track metrics
    const duration = Date.now() - start
    if (duration > 0) {
      jobsProcessed.inc({ worker: "orchestrator", status: "success", queue: "scheduled" })
      jobDuration.observe({ worker: "orchestrator", queue: "scheduled" }, duration / 1000)
    }
  }
}

// Create and start worker
const worker = createWorker<ScheduledJobData>("scheduled", processScheduledJob, {
  name: "orchestrator",
  concurrency: 1,
})

setupGracefulShutdown([worker])

console.log("[orchestrator] Worker started")
