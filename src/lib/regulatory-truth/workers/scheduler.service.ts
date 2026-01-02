// src/lib/regulatory-truth/workers/scheduler.service.ts
// Layer A: Morning discovery refresh - runs once daily to discover new content
// Processing is handled by the continuous-drainer (Layer B)

import cron from "node-cron"
import { sentinelQueue, scheduledQueue } from "./queues"
import { closeRedis } from "./redis"
import { logWorkerStartup } from "./startup-log"

logWorkerStartup("scheduler")

const TIMEZONE = process.env.WATCHDOG_TIMEZONE || "Europe/Zagreb"

async function startScheduler(): Promise<void> {
  console.log("[scheduler] Starting scheduler service (Layer A: Discovery only)")
  console.log(`[scheduler] Timezone: ${TIMEZONE}`)
  console.log("[scheduler] NOTE: Processing is handled by continuous-drainer (Layer B)")

  // =========================================
  // Layer A: Morning Discovery Refresh
  // =========================================

  // 06:00 - Discovery refresh (sitemaps, endpoint scans)
  // This only creates DiscoveredItem rows, no heavy processing
  cron.schedule(
    "0 6 * * *",
    async () => {
      console.log("[scheduler] Running morning discovery refresh...")
      const runId = `discovery-${Date.now()}`

      // Queue sentinel jobs for all priorities
      await sentinelQueue.add("sentinel-critical", { runId, priority: "CRITICAL" })
      await sentinelQueue.add("sentinel-high", { runId, priority: "HIGH" }, { delay: 60000 })
      await sentinelQueue.add("sentinel-normal", { runId, priority: "NORMAL" }, { delay: 120000 })
      await sentinelQueue.add("sentinel-low", { runId, priority: "LOW" }, { delay: 180000 })

      console.log("[scheduler] Discovery jobs queued for all priorities")
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Morning discovery at 06:00")

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
