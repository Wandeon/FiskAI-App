// src/lib/regulatory-truth/scheduler/cron.ts
import { CronJob } from "cron"

interface SchedulerConfig {
  timezone: string
  enabled: boolean
}

const DEFAULT_CONFIG: SchedulerConfig = {
  timezone: "Europe/Zagreb",
  enabled: process.env.REGULATORY_CRON_ENABLED === "true",
}

let dailyJob: CronJob | null = null

/**
 * Run the overnight pipeline.
 * This is called by the cron job at 06:00 AM Zagreb time.
 */
async function runOvernightPipeline(): Promise<void> {
  console.log("[scheduler] Starting overnight pipeline at " + new Date().toISOString())

  try {
    // Dynamic import to avoid loading heavy modules at startup
    const { main } = await import("../scripts/overnight-run")
    await main()

    console.log("[scheduler] Overnight pipeline complete")
  } catch (error) {
    console.error("[scheduler] Overnight pipeline failed:", error)
    // TODO: Send alert notification
  }
}

/**
 * Start the cron scheduler.
 * Schedules:
 * - 06:00 AM Zagreb time: Full overnight pipeline
 */
export function startScheduler(config: Partial<SchedulerConfig> = {}): void {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  if (!mergedConfig.enabled) {
    console.log("[scheduler] Cron scheduler disabled")
    return
  }

  // Daily at 06:00 AM Zagreb time
  dailyJob = new CronJob(
    "0 6 * * *", // At 06:00
    runOvernightPipeline,
    null,
    true, // Start immediately
    mergedConfig.timezone
  )

  console.log("[scheduler] Cron scheduler started (timezone: " + mergedConfig.timezone + ")")
  const nextRun = dailyJob.nextDate()
  console.log("[scheduler] Next run:", nextRun ? nextRun.toISO() : "N/A")
}

/**
 * Stop the cron scheduler.
 */
export function stopScheduler(): void {
  if (dailyJob) {
    dailyJob.stop()
    dailyJob = null
    console.log("[scheduler] Cron scheduler stopped")
  }
}

/**
 * Get scheduler status.
 */
export function getSchedulerStatus(): {
  enabled: boolean
  running: boolean
  nextRun: string | null
  lastRun: string | null
} {
  const nextDate = dailyJob?.nextDate()
  const lastDate = dailyJob?.lastDate()

  return {
    enabled: DEFAULT_CONFIG.enabled,
    running: dailyJob !== null,
    nextRun: nextDate ? nextDate.toISO() : null,
    lastRun: lastDate ? lastDate.toISO() : null,
  }
}

/**
 * Manually trigger the overnight pipeline.
 */
export async function triggerManualRun(): Promise<void> {
  console.log("[scheduler] Manual run triggered")
  await runOvernightPipeline()
}
