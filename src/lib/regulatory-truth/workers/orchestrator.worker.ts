// src/lib/regulatory-truth/workers/orchestrator.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { sentinelQueue, releaseQueue, arbiterQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { db, dbReg } from "@/lib/db"
import { autoApproveEligibleRules } from "../agents/reviewer"
import { logWorkerStartup } from "./startup-log"

// Log startup info for build drift detection
logWorkerStartup("orchestrator")

interface ScheduledJobData {
  type:
    | "pipeline-run"
    | "audit"
    | "digest"
    | "auto-approve"
    | "arbiter-sweep"
    | "release-batch"
    | "confidence-decay"
    | "e2e-validation"
    | "health-snapshot"
    | "truth-consolidation-audit"
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
        const sources = await dbReg.regulatorySource.findMany({
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

      case "confidence-decay": {
        const { applyConfidenceDecay } = await import("../utils/confidence-decay")
        const result = await applyConfidenceDecay()
        return {
          success: true,
          duration: Date.now() - start,
          data: { checked: result.checked, decayed: result.decayed },
        }
      }

      case "e2e-validation": {
        const { runLiveE2E } = await import("../e2e/live-runner")
        const result = await runLiveE2E({ lightRun: false, skipAssistant: false })
        return {
          success: result.verdict !== "INVALID",
          duration: Date.now() - start,
          data: {
            verdict: result.verdict,
            invariantsPass: result.invariants.summary.pass,
            invariantsFail: result.invariants.summary.fail,
            artifactsPath: result.artifactsPath,
          },
        }
      }

      case "health-snapshot": {
        // Collect system health metrics
        const [discoveredItems, rules, evidence, pointers] = await Promise.all([
          db.discoveredItem.groupBy({
            by: ["status"],
            _count: true,
          }),
          db.regulatoryRule.groupBy({
            by: ["status"],
            _count: true,
          }),
          dbReg.evidence.count(),
          db.sourcePointer.count(),
        ])

        const snapshot = {
          timestamp: new Date().toISOString(),
          discoveredItems: Object.fromEntries(discoveredItems.map((d) => [d.status, d._count])),
          rules: Object.fromEntries(rules.map((r) => [r.status, r._count])),
          evidence,
          pointers,
        }

        console.log("[orchestrator] Health snapshot:", JSON.stringify(snapshot, null, 2))

        return {
          success: true,
          duration: Date.now() - start,
          data: snapshot,
        }
      }

      case "truth-consolidation-audit": {
        // Daily smoke detector: run consolidator in dry-run mode and alert on issues
        const { runConsolidatorHealthCheck, storeTruthHealthSnapshot } =
          await import("../utils/truth-health")

        // Run consolidator health check (dry-run)
        const healthCheck = await runConsolidatorHealthCheck()

        // Store truth health snapshot
        const snapshot = await storeTruthHealthSnapshot()

        // Log alerts for monitoring
        if (!healthCheck.healthy) {
          console.warn("[orchestrator] Truth consolidation audit found issues:")
          for (const alert of healthCheck.alerts) {
            console.warn(`  - ${alert}`)
          }
        } else {
          console.log("[orchestrator] Truth consolidation audit passed - no issues found")
        }

        return {
          success: healthCheck.healthy,
          duration: Date.now() - start,
          data: {
            healthy: healthCheck.healthy,
            duplicateGroups: healthCheck.duplicateGroups,
            testDataLeakage: healthCheck.testDataLeakage,
            snapshotId: snapshot.id,
            alerts: healthCheck.alerts,
          },
        }
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
