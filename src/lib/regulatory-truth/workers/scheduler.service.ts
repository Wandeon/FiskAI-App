// src/lib/regulatory-truth/workers/scheduler.service.ts
// Layer A: Morning discovery refresh - runs once daily to discover new content
// Processing is handled by the continuous-drainer (Layer B)
//
// Task 1.2: RTL Autonomy - Added scheduler run persistence + catch-up logic
// - Tracks scheduled vs actual runs in SchedulerRun table
// - Detects missed runs on startup (24-hour lookback)
// - Hourly staleness watchdog (26-hour threshold triggers catch-up)
// - Distributed locking prevents concurrent execution

import cron from "node-cron"
import { randomUUID } from "crypto"
import { sentinelQueue, scheduledQueue } from "./queues"
import { closeRedis } from "./redis"
import { logWorkerStartup } from "./startup-log"
import { runEndpointHealthCheck } from "../watchdog/endpoint-health"
import {
  runStartupCatchUp,
  runStalenessWatchdog,
  createExpectedRun,
  transitionToRunning,
  releaseLock,
  markRunMissed,
  STALENESS_THRESHOLD_HOURS,
} from "./scheduler-catchup"

logWorkerStartup("scheduler")

const TIMEZONE = process.env.WATCHDOG_TIMEZONE || "Europe/Zagreb"

// Unique instance ID for distributed locking
const INSTANCE_ID = `scheduler-${process.env.HOSTNAME || "local"}-${randomUUID().slice(0, 8)}`

/**
 * Execute the discovery job with distributed locking and persistence.
 * Called both by scheduled cron and catch-up logic.
 */
async function executeDiscoveryJob(triggeredBy: "cron" | "catch-up" | "staleness"): Promise<void> {
  const scheduledAt = new Date()
  // Normalize to the hour for consistent scheduling
  scheduledAt.setMinutes(0, 0, 0)

  console.log(`[scheduler] Discovery triggered by: ${triggeredBy}`)

  try {
    // Create expected run record (or get existing)
    const run = await createExpectedRun("discovery", scheduledAt)

    // Try to acquire lock via atomic transition
    const transition = await transitionToRunning(run.id, INSTANCE_ID)

    if (!transition.success) {
      // Lock contention - another instance is processing
      console.log(`[scheduler] Discovery already running (lock held), skipping`)
      await markRunMissed(run.id, `Lock contention - another instance processing (${triggeredBy})`)
      return
    }

    console.log(`[scheduler] Acquired lock for discovery run ${run.id}`)
    const runId = `discovery-${Date.now()}`

    try {
      // Queue sentinel jobs for all priorities
      await sentinelQueue.add("sentinel-critical", { runId, priority: "CRITICAL" })
      await sentinelQueue.add("sentinel-high", { runId, priority: "HIGH" }, { delay: 60000 })
      await sentinelQueue.add("sentinel-normal", { runId, priority: "NORMAL" }, { delay: 120000 })
      await sentinelQueue.add("sentinel-low", { runId, priority: "LOW" }, { delay: 180000 })

      console.log("[scheduler] Discovery jobs queued for all priorities")

      // Release lock with success status
      await releaseLock(run.id, INSTANCE_ID, "COMPLETED")
      console.log(`[scheduler] Released lock for discovery run ${run.id}`)
    } catch (error) {
      // Release lock with failure status
      const errorMessage = error instanceof Error ? error.message : String(error)
      await releaseLock(run.id, INSTANCE_ID, "FAILED", errorMessage)
      console.error(`[scheduler] Discovery job failed:`, error)
      throw error
    }
  } catch (error) {
    console.error(`[scheduler] Failed to execute discovery job:`, error)
    // Don't re-throw - let the scheduler continue
  }
}

async function startScheduler(): Promise<void> {
  console.log("[scheduler] Starting scheduler service (Layer A: Discovery only)")
  console.log(`[scheduler] Timezone: ${TIMEZONE}`)
  console.log(`[scheduler] Instance ID: ${INSTANCE_ID}`)
  console.log("[scheduler] NOTE: Processing is handled by continuous-drainer (Layer B)")

  // =========================================
  // Startup: Catch-up for Missed Runs
  // =========================================

  console.log("[scheduler] Checking for missed runs on startup...")
  try {
    const catchUp = await runStartupCatchUp("discovery", INSTANCE_ID, () =>
      executeDiscoveryJob("catch-up")
    )
    if (catchUp.catchUpTriggered) {
      console.log(`[scheduler] Catch-up triggered for ${catchUp.missedCount} missed discovery runs`)
    } else {
      console.log("[scheduler] No catch-up needed - discovery is current")
    }
  } catch (error) {
    console.error("[scheduler] Startup catch-up check failed:", error)
    // Continue with normal scheduling
  }

  // =========================================
  // Layer A: Morning Discovery Refresh
  // =========================================

  // 06:00 - Discovery refresh (sitemaps, endpoint scans)
  // This only creates DiscoveredItem rows, no heavy processing
  cron.schedule(
    "0 6 * * *",
    async () => {
      console.log("[scheduler] Running morning discovery refresh...")
      await executeDiscoveryJob("cron")
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Morning discovery at 06:00")

  // 06:30 - Endpoint health check (after discovery completes)
  // Raises alerts for SLA breaches, consecutive errors, circuit breakers
  cron.schedule(
    "30 6 * * *",
    async () => {
      console.log("[scheduler] Running endpoint health check...")
      const runId = `health-check-${Date.now()}`
      try {
        const report = await runEndpointHealthCheck(runId)
        console.log(
          `[scheduler] Endpoint health check complete: ` +
            `${report.healthyCritical}/${report.totalCritical} healthy, ` +
            `${report.alertsRaised.length} alerts raised`
        )
      } catch (error) {
        console.error("[scheduler] Endpoint health check failed:", error)
      }
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Endpoint health check at 06:30")

  // =========================================
  // DLQ Auto-Healing (every 5 minutes)
  // =========================================

  // DLQ healing cycle - auto-replays transient failures
  // Runs every 5 minutes to replay NETWORK/TIMEOUT errors after cooldown
  // Replays QUOTA errors after 1-hour cooldown
  // Never replays permanent failures (AUTH, VALIDATION, EMPTY)
  cron.schedule(
    "*/5 * * * *",
    async () => {
      console.log("[scheduler] Running DLQ healing cycle...")
      await scheduledQueue.add(
        "scheduled",
        {
          type: "dlq-healing",
          runId: `dlq-heal-${Date.now()}`,
          triggeredBy: "cron",
        },
        {
          // Prevent duplicate healing jobs (only one should run at a time)
          jobId: "dlq-healing-cycle",
          // If a healing job is already pending, skip this one
          removeOnComplete: true,
        }
      )
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: DLQ healing every 5 minutes")

  // =========================================
  // Staleness Watchdog (hourly)
  // =========================================

  // Hourly staleness check - triggers catch-up if >26 hours since last discovery
  // This is a safety net in case the 6 AM cron fails silently
  cron.schedule(
    "0 * * * *", // Every hour at minute 0
    async () => {
      console.log("[scheduler] Running hourly staleness watchdog...")
      try {
        const result = await runStalenessWatchdog("discovery", INSTANCE_ID, () =>
          executeDiscoveryJob("staleness")
        )
        if (result.triggered) {
          console.log(`[scheduler] Staleness watchdog triggered catch-up: ${result.reason}`)
        } else {
          console.log(`[scheduler] Staleness watchdog: discovery is current`)
        }
      } catch (error) {
        console.error("[scheduler] Staleness watchdog failed:", error)
      }
    },
    { timezone: TIMEZONE }
  )
  console.log(
    `[scheduler] Scheduled: Staleness watchdog every hour (threshold: ${STALENESS_THRESHOLD_HOURS}h)`
  )

  // =========================================
  // Maintenance Jobs (not processing)
  // =========================================

  // Weekly confidence decay on Sundays at 03:00
  cron.schedule(
    "0 3 * * 0",
    async () => {
      console.log("[scheduler] Running weekly confidence decay...")
      await scheduledQueue.add("scheduled", {
        type: "confidence-decay",
        runId: `decay-${Date.now()}`,
        triggeredBy: "cron",
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Confidence decay on Sundays at 03:00")

  // Daily truth consolidation audit at 04:00 (smoke detector mode)
  cron.schedule(
    "0 4 * * *",
    async () => {
      console.log("[scheduler] Running daily truth consolidation audit...")
      await scheduledQueue.add("scheduled", {
        type: "truth-consolidation-audit",
        runId: `audit-${Date.now()}`,
        triggeredBy: "cron",
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Truth consolidation audit at 04:00")

  // Daily E2E validation at 05:00 (before discovery)
  cron.schedule(
    "0 5 * * *",
    async () => {
      console.log("[scheduler] Running daily E2E validation...")
      await scheduledQueue.add("scheduled", {
        type: "e2e-validation",
        runId: `e2e-${Date.now()}`,
        triggeredBy: "cron",
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: E2E validation at 05:00")

  // Daily health check at 00:00 (midnight)
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("[scheduler] Running daily health snapshot...")
      await scheduledQueue.add("scheduled", {
        type: "health-snapshot",
        runId: `health-${Date.now()}`,
        triggeredBy: "cron",
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Health snapshot at 00:00")

  // Daily regression detection at 01:00 (after health check, before confidence decay)
  // Task 2.2: RTL Autonomy - Automated Regression Testing
  // Creates daily snapshots of PUBLISHED rules and detects silent value changes
  cron.schedule(
    "0 1 * * *",
    async () => {
      console.log("[scheduler] Running daily regression detection...")
      await scheduledQueue.add("scheduled", {
        type: "regression-detection",
        runId: `regression-${Date.now()}`,
        triggeredBy: "cron",
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Regression detection at 01:00")

  // Monthly feedback retention cleanup on 1st of each month at 02:00
  // Task 4.1: RTL Autonomy - User Feedback Loop
  // Deletes feedback records older than 12 months (RETENTION_MONTHS)
  // Critical Safeguard (Appendix A.4): Enforces data retention policy
  cron.schedule(
    "0 2 1 * *", // At 02:00 on day-of-month 1
    async () => {
      console.log("[scheduler] Running monthly feedback retention cleanup...")
      await scheduledQueue.add("scheduled", {
        type: "feedback-retention-cleanup",
        runId: `feedback-cleanup-${Date.now()}`,
        triggeredBy: "cron",
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Feedback retention cleanup on 1st of month at 02:00")

  // Weekly feedback review flagging on Mondays at 03:00
  // Task 4.1: RTL Autonomy - User Feedback Loop
  // Identifies rules with >30% negative feedback and creates monitoring alerts
  // These alerts require human review to investigate why users are giving negative feedback
  cron.schedule(
    "0 3 * * 1", // Every Monday at 03:00
    async () => {
      console.log("[scheduler] Running weekly feedback review flagging...")
      await scheduledQueue.add("scheduled", {
        type: "feedback-review-flagging",
        runId: `feedback-review-${Date.now()}`,
        triggeredBy: "cron",
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Feedback review flagging on Mondays at 03:00")

  console.log("[scheduler] Scheduler service started")
  console.log("[scheduler] ==================================")
  console.log("[scheduler] REMOVED: Daily pipeline processing (now continuous)")
  console.log("[scheduler] REMOVED: Auto-approve scheduling (now continuous)")
  console.log("[scheduler] REMOVED: Release batch scheduling (now event-driven)")
  console.log("[scheduler] REMOVED: Arbiter sweep scheduling (now continuous)")
  console.log("[scheduler] REMOVED: Random audit (replaced with deterministic health)")
  console.log("[scheduler] ==================================")
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[scheduler] Shutting down...")
  void closeRedis().then(() => process.exit(0))
})

process.on("SIGINT", () => {
  console.log("[scheduler] Shutting down...")
  void closeRedis().then(() => process.exit(0))
})

// Start
startScheduler().catch((error) => {
  console.error("[scheduler] Failed to start:", error)
  process.exit(1)
})
