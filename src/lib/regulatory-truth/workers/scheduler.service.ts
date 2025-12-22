// src/lib/regulatory-truth/workers/scheduler.service.ts
import cron from "node-cron"
import { scheduledQueue } from "./queues"
import { closeRedis } from "./redis"

const TIMEZONE = process.env.WATCHDOG_TIMEZONE || "Europe/Zagreb"

async function startScheduler(): Promise<void> {
  console.log("[scheduler] Starting scheduler service...")
  console.log(`[scheduler] Timezone: ${TIMEZONE}`)

  // Daily pipeline at 06:00
  cron.schedule(
    "0 6 * * *",
    async () => {
      console.log("[scheduler] Triggering daily pipeline run")
      await scheduledQueue.add("scheduled", {
        type: "pipeline-run",
        runId: `scheduled-${Date.now()}`,
        triggeredBy: "cron",
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Daily pipeline at 06:00")

  // Auto-approve check at 07:00
  cron.schedule(
    "0 7 * * *",
    async () => {
      await scheduledQueue.add("scheduled", {
        type: "auto-approve",
        runId: `auto-approve-${Date.now()}`,
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Auto-approve at 07:00")

  // Release batch at 07:30
  cron.schedule(
    "30 7 * * *",
    async () => {
      await scheduledQueue.add("scheduled", {
        type: "release-batch",
        runId: `release-${Date.now()}`,
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Release batch at 07:30")

  // Arbiter sweep at 12:00
  cron.schedule(
    "0 12 * * *",
    async () => {
      await scheduledQueue.add("scheduled", {
        type: "arbiter-sweep",
        runId: `arbiter-sweep-${Date.now()}`,
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Arbiter sweep at 12:00")

  // Random audit between 10:00-14:00
  const auditHour = 10 + Math.floor(Math.random() * 4)
  const auditMinute = Math.floor(Math.random() * 60)
  cron.schedule(
    `${auditMinute} ${auditHour} * * *`,
    async () => {
      await scheduledQueue.add("scheduled", {
        type: "audit",
        runId: `audit-${Date.now()}`,
      })
    },
    { timezone: TIMEZONE }
  )
  console.log(
    `[scheduler] Scheduled: Random audit at ${auditHour}:${auditMinute.toString().padStart(2, "0")}`
  )

  // Weekly confidence decay on Sundays at 03:00
  cron.schedule(
    "0 3 * * 0",
    async () => {
      console.log("[scheduler] Triggering weekly confidence decay")
      await scheduledQueue.add("scheduled", {
        type: "confidence-decay",
        runId: `decay-${Date.now()}`,
        triggeredBy: "cron",
      })
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Confidence decay on Sundays at 03:00")

  console.log("[scheduler] Scheduler service started")
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[scheduler] Shutting down...")
  await closeRedis()
  process.exit(0)
})

process.on("SIGINT", async () => {
  console.log("[scheduler] Shutting down...")
  await closeRedis()
  process.exit(0)
})

// Start
startScheduler().catch((error) => {
  console.error("[scheduler] Failed to start:", error)
  process.exit(1)
})
