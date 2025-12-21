// src/lib/regulatory-truth/scheduler/cron.ts
import { CronJob } from "cron"
import { Resend } from "resend"

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
    // Send alert email
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "FiskAI <noreply@fiskai.hr>",
        to: process.env.ADMIN_ALERT_EMAIL || "admin@fiskai.hr",
        subject: "🚨 Regulatory Pipeline Failed",
        html: `
          <h2>Overnight Pipeline Failure</h2>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
          <p><a href="https://admin.fiskai.hr/regulatory">View Dashboard</a></p>
        `,
      })
      console.log("[scheduler] Alert email sent")
    } catch (emailError) {
      console.error("[scheduler] Failed to send alert email:", emailError)
    }
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
