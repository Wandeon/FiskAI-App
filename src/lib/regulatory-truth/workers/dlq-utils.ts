// src/lib/regulatory-truth/workers/dlq-utils.ts
// Dead Letter Queue utilities for monitoring, replay, and analysis

import { Job } from "bullmq"
import {
  deadletterQueue,
  allQueues,
  DLQ_THRESHOLD,
  DLQ_RETENTION_DAYS,
  type DeadLetterJobData,
} from "./queues"

/**
 * DLQ statistics for monitoring
 */
export interface DLQStats {
  total: number
  waiting: number
  active: number
  completed: number
  failed: number
  byQueue: Record<string, number>
  oldestJobAge?: number // hours
  thresholdExceeded: boolean
}

/**
 * Get comprehensive DLQ statistics
 */
export async function getDLQStats(): Promise<DLQStats> {
  const counts = await deadletterQueue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed"
  )

  // Get jobs to analyze by original queue
  const waitingJobs = await deadletterQueue.getJobs(["waiting", "active"], 0, 1000)

  const byQueue: Record<string, number> = {}
  let oldestTimestamp: number | undefined

  for (const job of waitingJobs) {
    const data = job.data as DeadLetterJobData
    const queueName = data.originalQueue || "unknown"
    byQueue[queueName] = (byQueue[queueName] || 0) + 1

    // Track oldest job
    const jobTimestamp = job.timestamp
    if (!oldestTimestamp || jobTimestamp < oldestTimestamp) {
      oldestTimestamp = jobTimestamp
    }
  }

  const total = counts.waiting + counts.active
  const oldestJobAge = oldestTimestamp
    ? (Date.now() - oldestTimestamp) / (1000 * 60 * 60) // hours
    : undefined

  return {
    total,
    waiting: counts.waiting,
    active: counts.active,
    completed: counts.completed,
    failed: counts.failed,
    byQueue,
    oldestJobAge,
    thresholdExceeded: total >= DLQ_THRESHOLD,
  }
}

/**
 * Get DLQ jobs with optional filtering
 */
export async function getDLQJobs(options: {
  queue?: string
  limit?: number
  offset?: number
}): Promise<Job<DeadLetterJobData>[]> {
  const { queue, limit = 100, offset = 0 } = options

  const jobs = await deadletterQueue.getJobs(["waiting", "active"], offset, offset + limit)

  if (queue) {
    return jobs.filter((job) => (job.data as DeadLetterJobData).originalQueue === queue)
  }

  return jobs
}

/**
 * Replay a single DLQ job back to its original queue
 */
export async function replayDLQJob(jobId: string): Promise<{
  success: boolean
  newJobId?: string
  error?: string
}> {
  try {
    const job = await deadletterQueue.getJob(jobId)
    if (!job) {
      return { success: false, error: `Job ${jobId} not found in DLQ` }
    }

    const data = job.data as DeadLetterJobData
    const targetQueue = allQueues[data.originalQueue as keyof typeof allQueues]

    if (!targetQueue) {
      return { success: false, error: `Original queue ${data.originalQueue} not found` }
    }

    // Add job back to original queue with fresh attempt counter
    const newJob = await targetQueue.add(data.originalJobName, data.originalJobData, {
      jobId: `replay-${data.originalJobId}-${Date.now()}`,
    })

    // Remove from DLQ
    await job.remove()

    return { success: true, newJobId: newJob.id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Replay all DLQ jobs for a specific queue
 */
export async function replayDLQByQueue(queueName: string): Promise<{
  replayed: number
  failed: number
  errors: string[]
}> {
  const jobs = await getDLQJobs({ queue: queueName, limit: 1000 })
  let replayed = 0
  let failed = 0
  const errors: string[] = []

  for (const job of jobs) {
    const result = await replayDLQJob(job.id!)
    if (result.success) {
      replayed++
    } else {
      failed++
      errors.push(`Job ${job.id}: ${result.error}`)
    }
  }

  return { replayed, failed, errors }
}

/**
 * Purge old DLQ jobs beyond retention period
 */
export async function purgeDLQOldJobs(): Promise<number> {
  const retentionMs = DLQ_RETENTION_DAYS * 24 * 60 * 60 * 1000
  const cutoffTimestamp = Date.now() - retentionMs

  const jobs = await deadletterQueue.getJobs(["waiting", "active", "completed", "failed"], 0, 10000)
  let purged = 0

  for (const job of jobs) {
    if (job.timestamp < cutoffTimestamp) {
      await job.remove()
      purged++
    }
  }

  return purged
}

/**
 * Get error summary from DLQ jobs for analysis
 */
export async function getDLQErrorSummary(): Promise<Record<string, {
  count: number
  queues: string[]
  latestError: string
  latestTimestamp: string
}>> {
  const jobs = await getDLQJobs({ limit: 1000 })
  const summary: Record<string, {
    count: number
    queues: Set<string>
    latestError: string
    latestTimestamp: string
  }> = {}

  for (const job of jobs) {
    const data = job.data as DeadLetterJobData
    // Create a normalized error key (first line of error message)
    const errorKey = data.error.split("\n")[0].substring(0, 100)

    if (!summary[errorKey]) {
      summary[errorKey] = {
        count: 0,
        queues: new Set(),
        latestError: data.error,
        latestTimestamp: data.failedAt,
      }
    }

    summary[errorKey].count++
    summary[errorKey].queues.add(data.originalQueue)

    // Update latest if this job is newer
    if (data.failedAt > summary[errorKey].latestTimestamp) {
      summary[errorKey].latestTimestamp = data.failedAt
      summary[errorKey].latestError = data.error
    }
  }

  // Convert Sets to arrays for JSON serialization
  const result: Record<string, {
    count: number
    queues: string[]
    latestError: string
    latestTimestamp: string
  }> = {}

  for (const [key, value] of Object.entries(summary)) {
    result[key] = {
      ...value,
      queues: Array.from(value.queues),
    }
  }

  return result
}
