// src/lib/regulatory-truth/workers/orchestrator.worker.ts
import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { sentinelQueue, releaseQueue, arbiterQueue, regressionDetectorQueue } from "./queues"
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
    | "dlq-healing"
    | "regression-detection"
    | "feedback-retention-cleanup"
    | "feedback-review-flagging"
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
          await arbiterQueue.add(
            "arbiter",
            { conflictId: c.id, runId },
            { jobId: `arbiter-${c.id}` }
          )
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
          // Use sorted rule IDs for stable jobId (order-independent)
          const sortedIds = approved
            .map((r) => r.id)
            .sort()
            .join(",")
          await releaseQueue.add(
            "release",
            {
              ruleIds: approved.map((r) => r.id),
              runId,
            },
            { jobId: `release-${sortedIds}` }
          )
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

      case "dlq-healing": {
        // Run DLQ healing cycle to auto-replay transient failures
        const { runHealingCycle } = await import("./dlq-healer")
        const result = await runHealingCycle()

        // Log summary
        console.log(
          `[orchestrator] DLQ healing complete: replayed=${result.replayed} ` +
            `skipped=${result.skipped} escalated=${result.escalated}`
        )

        return {
          success: result.errors.length === 0,
          duration: Date.now() - start,
          data: {
            scanned: result.scanned,
            replayed: result.replayed,
            skipped: result.skipped,
            escalated: result.escalated,
            byCategory: result.byCategory,
            errors: result.errors,
          },
        }
      }

      case "regression-detection": {
        // Task 2.2: RTL Autonomy - Automated Regression Testing
        // Queue the regression detector worker to create daily snapshots
        // and detect silent value changes in PUBLISHED rules
        await regressionDetectorQueue.add(
          "regression-detection",
          { runId },
          { jobId: `regression-${runId}` }
        )

        console.log(`[orchestrator] Queued regression detection job: ${runId}`)

        return {
          success: true,
          duration: Date.now() - start,
          data: { queued: true, runId },
        }
      }

      case "feedback-retention-cleanup": {
        // Task 4.1: RTL Autonomy - User Feedback Loop
        // Monthly cleanup of feedback records older than 12 months
        // Critical Safeguard (Appendix A.4): Enforces data retention policy
        const { cleanupOldFeedback, getFeedbackStats } = await import("../utils/user-feedback.db")

        // Get stats before cleanup
        const beforeStats = await getFeedbackStats()

        // Run cleanup with default retention (12 months)
        const deletedCount = await cleanupOldFeedback()

        // Get stats after cleanup
        const afterStats = await getFeedbackStats()

        console.log(
          `[orchestrator] Feedback retention cleanup: deleted=${deletedCount} ` +
            `before=${beforeStats.total} after=${afterStats.total}`
        )

        return {
          success: true,
          duration: Date.now() - start,
          data: {
            deleted: deletedCount,
            beforeTotal: beforeStats.total,
            afterTotal: afterStats.total,
            oldestRemaining: afterStats.oldestRecord?.toISOString() || null,
          },
        }
      }

      case "feedback-review-flagging": {
        // Task 4.1: RTL Autonomy - User Feedback Loop
        // Weekly check for rules with >30% negative feedback
        // Creates monitoring alerts for flagged rules requiring human review
        const { getRulesWithNegativeFeedback } = await import("../utils/user-feedback.db")
        const { filterRulesWithHighNegativeFeedback } = await import("../utils/user-feedback")

        // Get all rules with feedback statistics
        const allStats = await getRulesWithNegativeFeedback()

        // Filter to only rules exceeding the 30% negative feedback threshold
        const flagged = filterRulesWithHighNegativeFeedback(allStats)

        // Create monitoring alerts for flagged rules
        for (const rule of flagged) {
          await dbReg.monitoringAlert.create({
            data: {
              type: "NEGATIVE_USER_FEEDBACK",
              severity: "HIGH",
              description: `Rule ${rule.ruleId} has ${(rule.negativePercent * 100).toFixed(1)}% negative feedback (${rule.totalFeedback} total)`,
              affectedRuleIds: [rule.ruleId],
              autoAction: {
                action: "FLAG_FOR_REVIEW",
                executed: false,
                result: null,
                context: {
                  negativePercent: rule.negativePercent,
                  totalFeedback: rule.totalFeedback,
                },
              },
              humanActionRequired: true,
              resolvedAt: null,
            },
          })
        }

        console.log(
          `[orchestrator] Feedback review flagging: checked=${allStats.length} ` +
            `flagged=${flagged.length}`
        )

        return {
          success: true,
          duration: Date.now() - start,
          data: {
            checked: allStats.length,
            flagged: flagged.length,
            flaggedRules: flagged.map((r) => ({
              ruleId: r.ruleId,
              negativePercent: r.negativePercent,
              totalFeedback: r.totalFeedback,
            })),
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
