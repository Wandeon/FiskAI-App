// src/lib/regulatory-truth/scheduler/cron.ts

import cron from "node-cron"
import { runWatchdogPipeline, runStandaloneAudit, sendDigest } from "../watchdog/orchestrator"
import { sendRegulatoryTruthDigest } from "../watchdog/resend-email"
import { runTier1Fetchers } from "../fetchers"

const TIMEZONE = process.env.WATCHDOG_TIMEZONE || "Europe/Zagreb"
const WATCHDOG_ENABLED = process.env.WATCHDOG_ENABLED === "true"

let isRunning = false

/**
 * Start the watchdog scheduler
 */
export function startScheduler(): void {
  if (!WATCHDOG_ENABLED) {
    console.log("[scheduler] Watchdog disabled via WATCHDOG_ENABLED env var")
    return
  }

  console.log("[scheduler] Starting watchdog scheduler...")
  console.log(`[scheduler] Timezone: ${TIMEZONE}`)

  // Main pipeline at 06:00 daily
  cron.schedule(
    "0 6 * * *",
    async () => {
      if (isRunning) {
        console.log("[scheduler] Pipeline already running, skipping")
        return
      }

      isRunning = true
      try {
        await runWatchdogPipeline()
      } finally {
        isRunning = false
      }
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Main pipeline at 06:00")

  // Daily digest via Resend at 07:00 (comprehensive truth health digest)
  cron.schedule(
    "0 7 * * *",
    async () => {
      console.log("[scheduler] Sending regulatory truth daily digest via Resend...")
      await sendRegulatoryTruthDigest()
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Regulatory Truth Digest (Resend) at 07:00")

  // Legacy daily digest at 08:00 (SMTP - kept for backwards compatibility)
  cron.schedule(
    "0 8 * * *",
    async () => {
      await sendDigest()
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Legacy digest (SMTP) at 08:00")

  // Tier 1 Fetchers: HNB exchange rates at 08:00, 13:00, 17:00
  cron.schedule(
    "0 8 * * *",
    async () => {
      console.log("[scheduler] Running Tier 1 fetchers (morning)...")
      try {
        const result = await runTier1Fetchers()
        console.log(
          `[scheduler] Tier 1 complete: HNB=${result.hnb.ratesCreated}, NN=${result.nn.evidenceCreated}, EUR-Lex=${result.eurlex.evidenceCreated}, MRMS=${result.mrms.evidenceCreated}, HOK=${result.hok.evidenceCreated}`
        )
      } catch (error) {
        console.error("[scheduler] Tier 1 fetchers error:", error)
      }
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Tier 1 fetchers (morning) at 08:00")

  cron.schedule(
    "0 13 * * *",
    async () => {
      console.log("[scheduler] Running Tier 1 fetchers (midday)...")
      try {
        const result = await runTier1Fetchers()
        console.log(
          `[scheduler] Tier 1 complete: HNB=${result.hnb.ratesCreated}, NN=${result.nn.evidenceCreated}, EUR-Lex=${result.eurlex.evidenceCreated}, MRMS=${result.mrms.evidenceCreated}, HOK=${result.hok.evidenceCreated}`
        )
      } catch (error) {
        console.error("[scheduler] Tier 1 fetchers error:", error)
      }
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Tier 1 fetchers (midday) at 13:00")

  cron.schedule(
    "0 17 * * *",
    async () => {
      console.log("[scheduler] Running Tier 1 fetchers (evening)...")
      try {
        const result = await runTier1Fetchers()
        console.log(
          `[scheduler] Tier 1 complete: HNB=${result.hnb.ratesCreated}, NN=${result.nn.evidenceCreated}, EUR-Lex=${result.eurlex.evidenceCreated}, MRMS=${result.mrms.evidenceCreated}, HOK=${result.hok.evidenceCreated}`
        )
      } catch (error) {
        console.error("[scheduler] Tier 1 fetchers error:", error)
      }
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Tier 1 fetchers (evening) at 17:00")

  // Tier 1 Fetchers: NN latest issue check at 18:00
  cron.schedule(
    "0 18 * * *",
    async () => {
      console.log("[scheduler] Running Tier 1 fetchers (NN evening check)...")
      try {
        const result = await runTier1Fetchers()
        console.log(
          `[scheduler] Tier 1 complete: HNB=${result.hnb.ratesCreated}, NN=${result.nn.evidenceCreated}, EUR-Lex=${result.eurlex.evidenceCreated}, MRMS=${result.mrms.evidenceCreated}, HOK=${result.hok.evidenceCreated}`
        )
      } catch (error) {
        console.error("[scheduler] Tier 1 fetchers error:", error)
      }
    },
    { timezone: TIMEZONE }
  )
  console.log("[scheduler] Scheduled: Tier 1 fetchers (NN evening check) at 18:00")

  // Random audit 1: between 10:00-14:00
  const audit1Hour = 10 + Math.floor(Math.random() * 4)
  const audit1Minute = Math.floor(Math.random() * 60)
  cron.schedule(
    `${audit1Minute} ${audit1Hour} * * *`,
    async () => {
      await runStandaloneAudit()
    },
    { timezone: TIMEZONE }
  )
  console.log(
    `[scheduler] Scheduled: Audit 1 at ${audit1Hour}:${audit1Minute.toString().padStart(2, "0")}`
  )

  // Random audit 2: between 16:00-20:00 (50% chance)
  if (Math.random() < 0.5) {
    const audit2Hour = 16 + Math.floor(Math.random() * 4)
    const audit2Minute = Math.floor(Math.random() * 60)
    cron.schedule(
      `${audit2Minute} ${audit2Hour} * * *`,
      async () => {
        await runStandaloneAudit()
      },
      { timezone: TIMEZONE }
    )
    console.log(
      `[scheduler] Scheduled: Audit 2 at ${audit2Hour}:${audit2Minute.toString().padStart(2, "0")}`
    )
  }

  console.log("[scheduler] Watchdog scheduler started")
}

/**
 * Stop the scheduler (graceful shutdown)
 */
export function stopScheduler(): void {
  console.log("[scheduler] Stopping scheduler...")
  // node-cron doesn't provide a direct stop method for all jobs
  // The scheduler will stop when the process ends
  console.log("[scheduler] Scheduler stopped")
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  enabled: boolean
  running: boolean
  timezone: string
} {
  return {
    enabled: WATCHDOG_ENABLED,
    running: isRunning,
    timezone: TIMEZONE,
  }
}

/**
 * Run pipeline manually (for testing)
 */
export async function runManually(): Promise<void> {
  if (isRunning) {
    throw new Error("Pipeline already running")
  }

  isRunning = true
  try {
    await runWatchdogPipeline()
  } finally {
    isRunning = false
  }
}

/**
 * Trigger manual run (alias for runManually)
 */
export async function triggerManualRun(): Promise<void> {
  return runManually()
}
