// src/lib/cron-dlq.ts
// Dead Letter Queue (DLQ) handling for cron job failures

import { db } from "@/lib/db"

export interface CronErrorParams {
  jobName: string
  entityId?: string
  entityType?: string
  error: Error | string
  errorCode?: string
  metadata?: Record<string, unknown>
}

export async function recordCronError(params: CronErrorParams): Promise<void> {
  const { jobName, entityId, entityType, error, errorCode, metadata } = params
  const errorMessage = error instanceof Error ? error.message : String(error)
  const uniqueKey = entityId || `global-${Date.now()}`

  try {
    await db.cronJobError.upsert({
      where: { jobName_entityId: { jobName, entityId: uniqueKey } },
      create: {
        jobName,
        entityId: uniqueKey,
        entityType,
        errorMessage,
        errorCode,
        metadata: metadata as object,
        attemptCount: 1,
      },
      update: {
        errorMessage,
        errorCode,
        metadata: metadata as object,
        attemptCount: { increment: 1 },
        resolvedAt: null,
        resolvedBy: null,
      },
    })
    console.error(`[CRON_DLQ] ${jobName}: ${errorMessage}`, entityId ? `(entity: ${entityId})` : "")
  } catch (dbError) {
    console.error(`[CRON_DLQ] Failed to record error for ${jobName}:`, dbError)
  }
}

export async function resolveCronError(
  jobName: string,
  entityId: string,
  resolvedBy?: string
): Promise<void> {
  try {
    await db.cronJobError.update({
      where: { jobName_entityId: { jobName, entityId } },
      data: { resolvedAt: new Date(), resolvedBy },
    })
  } catch {
    // Error might not exist
  }
}

export async function getUnresolvedCronErrors(jobName?: string) {
  return db.cronJobError.findMany({
    where: { resolvedAt: null, ...(jobName && { jobName }) },
    orderBy: [{ attemptCount: "desc" }, { updatedAt: "desc" }],
  })
}

export async function getCronErrorStats() {
  const [total, unresolved, byJob] = await Promise.all([
    db.cronJobError.count(),
    db.cronJobError.count({ where: { resolvedAt: null } }),
    db.cronJobError.groupBy({
      by: ["jobName"],
      where: { resolvedAt: null },
      _count: { id: true },
      _max: { attemptCount: true },
    }),
  ])
  return {
    total,
    unresolved,
    byJob: byJob.map((j) => ({
      jobName: j.jobName,
      count: j._count.id,
      maxAttempts: j._max.attemptCount,
    })),
  }
}
