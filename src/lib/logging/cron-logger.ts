// src/lib/logging/cron-logger.ts
/**
 * Structured logging for cron jobs
 *
 * Provides consistent, JSON-formatted logging for all cron jobs to enable:
 * - Log aggregation across services
 * - Alert creation based on log patterns
 * - Debugging across cron runs
 * - Job duration and success rate tracking
 */

import { logger } from "@/lib/logger"

export type CronJobName =
  | "bank-sync"
  | "certificate-check"
  | "checklist-digest"
  | "deadline-reminders"
  | "email-sync"
  | "fiscal-processor"
  | "fiscal-retry"
  | "news/fetch-classify"
  | "news/review"
  | "news/publish"
  | "news/stale-check"
  | "newsletter-send"
  | "system-status-cleanup"
  | "weekly-digest"

interface CronLogContext {
  runId?: string
  [key: string]: unknown
}

/**
 * Create a child logger for a specific cron job
 */
export function createCronLogger(jobName: CronJobName) {
  const runId = jobName + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)
  const cronLogger = logger.child({ context: "cron", job: jobName, runId })

  return {
    runId,

    /**
     * Log job start
     */
    start(data?: CronLogContext) {
      cronLogger.info({ event: "started", ...data }, "Cron job " + jobName + " started")
    },

    /**
     * Log informational event during job execution
     */
    info(event: string, data?: CronLogContext) {
      cronLogger.info({ event, ...data }, "[" + jobName + "] " + event)
    },

    /**
     * Log warning event
     */
    warn(event: string, data?: CronLogContext) {
      cronLogger.warn({ event, ...data }, "[" + jobName + "] " + event)
    },

    /**
     * Log error during job execution
     */
    error(error: Error | string, context?: CronLogContext) {
      const errorObj = error instanceof Error ? error : new Error(error)
      cronLogger.error(
        {
          event: "error",
          error: errorObj.message,
          stack: errorObj.stack,
          ...context,
        },
        "[" + jobName + "] Error: " + errorObj.message
      )
    },

    /**
     * Log job completion with summary
     */
    complete(summary: Record<string, unknown>, durationMs?: number) {
      cronLogger.info(
        {
          event: "completed",
          summary,
          durationMs,
        },
        "Cron job " + jobName + " completed"
      )
    },

    /**
     * Log job failure
     */
    fail(error: Error | string, summary?: Record<string, unknown>, durationMs?: number) {
      const errorObj = error instanceof Error ? error : new Error(error)
      cronLogger.error(
        {
          event: "failed",
          error: errorObj.message,
          stack: errorObj.stack,
          summary,
          durationMs,
        },
        "Cron job " + jobName + " failed: " + errorObj.message
      )
    },
  }
}

/**
 * Wrapper to time cron job execution
 */
export function withCronTiming<T>(
  jobName: CronJobName,
  fn: (log: ReturnType<typeof createCronLogger>) => Promise<T>
): Promise<T> {
  const log = createCronLogger(jobName)
  const startTime = Date.now()

  log.start()

  return fn(log)
    .then((result) => {
      const durationMs = Date.now() - startTime
      log.complete({ success: true }, durationMs)
      return result
    })
    .catch((error) => {
      const durationMs = Date.now() - startTime
      log.fail(error, undefined, durationMs)
      throw error
    })
}
