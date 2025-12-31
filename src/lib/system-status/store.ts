import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import type { SystemStatusEventInput } from "./diff"
import type { SystemStatusEventType, HeadlineStatus, RefreshStatus, RefreshQuality } from "./types"

// ============================================================================
// Snapshot Operations
// ============================================================================

export async function getCurrentSnapshot() {
  const pointer = await db.systemRegistryStatusPointer.findFirst()
  if (!pointer) return null
  return db.systemRegistryStatusSnapshot.findUnique({ where: { id: pointer.currentId } })
}

export async function getSnapshotById(id: string) {
  return db.systemRegistryStatusSnapshot.findUnique({ where: { id } })
}

interface SnapshotInput {
  headlineStatus: HeadlineStatus
  refreshQuality: RefreshQuality | string
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  observedCount: number
  declaredCount: number
  newDriftSinceDays: number
  lastRefreshStartedAt: Date | null
  lastRefreshEndedAt: Date | null
  lastRefreshStatus: RefreshStatus | string | null
  lastRefreshError: string | null
  topItems: unknown[]
}

/**
 * Save a new snapshot and update the pointer to point to it.
 */
export async function saveSnapshot(input: SnapshotInput) {
  // Create the snapshot
  const snapshot = await db.systemRegistryStatusSnapshot.create({
    data: {
      headlineStatus: input.headlineStatus as "OK" | "ATTENTION" | "ACTION_REQUIRED",
      refreshQuality: input.refreshQuality as "FULL" | "DEGRADED",
      criticalCount: input.criticalCount,
      highCount: input.highCount,
      mediumCount: input.mediumCount,
      lowCount: input.lowCount,
      observedCount: input.observedCount,
      declaredCount: input.declaredCount,
      newDriftSinceDays: input.newDriftSinceDays,
      lastRefreshStartedAt: input.lastRefreshStartedAt,
      lastRefreshEndedAt: input.lastRefreshEndedAt,
      lastRefreshStatus: input.lastRefreshStatus as "SUCCESS" | "FAILED" | null,
      lastRefreshError: input.lastRefreshError,
      topItems: input.topItems as object,
    },
  })

  // Update or create pointer
  const existingPointer = await db.systemRegistryStatusPointer.findFirst()
  if (existingPointer) {
    await db.systemRegistryStatusPointer.update({
      where: { id: existingPointer.id },
      data: { currentId: snapshot.id },
    })
  } else {
    await db.systemRegistryStatusPointer.create({
      data: { currentId: snapshot.id },
    })
  }

  return snapshot
}

// ============================================================================
// Event Operations
// ============================================================================

interface EventInput extends SystemStatusEventInput {
  requestedByUserId?: string
}

/**
 * Save multiple events at once.
 */
export async function saveEvents(events: EventInput[]) {
  if (events.length === 0) return []

  return db.systemRegistryStatusEvent.createMany({
    data: events.map((e) => ({
      eventType: e.eventType as SystemStatusEventType,
      severity: e.severity,
      message: e.message,
      nextAction: e.nextAction,
      componentId: e.componentId,
      owner: e.owner,
      link: e.link,
      requestedByUserId: e.requestedByUserId,
    })),
  })
}

// ============================================================================
// Refresh Job Operations
// ============================================================================

interface CreateJobInput {
  mode: "SYNC" | "ASYNC"
  dedupeKey: string
  lockKey: string
  requestedByUserId: string
  timeoutSeconds: number
}

/**
 * Create a new refresh job.
 */
export async function createRefreshJob(input: CreateJobInput) {
  return db.systemRegistryRefreshJob.create({
    data: {
      status: "PENDING",
      mode: input.mode,
      dedupeKey: input.dedupeKey,
      lockKey: input.lockKey,
      requestedByUserId: input.requestedByUserId,
      timeoutSeconds: input.timeoutSeconds,
    },
  })
}

interface UpdateJobInput {
  status?: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED"
  startedAt?: Date
  finishedAt?: Date
  error?: string
  snapshotId?: string
}

/**
 * Update a refresh job.
 */
export async function updateRefreshJob(id: string, input: UpdateJobInput) {
  return db.systemRegistryRefreshJob.update({
    where: { id },
    data: input,
  })
}

/**
 * Get a refresh job by ID.
 */
export async function getRefreshJob(id: string) {
  return db.systemRegistryRefreshJob.findUnique({ where: { id } })
}

/**
 * Get a running job by dedupe key.
 * Used to prevent duplicate jobs.
 */
export async function getRunningJobByDedupeKey(dedupeKey: string) {
  return db.systemRegistryRefreshJob.findFirst({
    where: {
      dedupeKey,
      status: { in: ["PENDING", "RUNNING"] },
    },
  })
}

// ============================================================================
// Lock Operations
// ============================================================================

interface AcquireLockInput {
  lockKey: string
  lockedUntil: Date
  requestedByUserId: string
  jobId: string
}

/**
 * Try to acquire a refresh lock.
 * Returns true if lock was acquired, false if already locked.
 *
 * Uses atomic operations to avoid TOCTOU race conditions:
 * 1. First, delete any expired locks (safe, idempotent)
 * 2. Then attempt to create the new lock
 * 3. If unique constraint violation, another process holds the lock
 */
export async function acquireRefreshLock(input: AcquireLockInput): Promise<boolean> {
  try {
    // First, atomically delete any expired lock for this key
    // This is safe because expired locks are no longer valid
    await db.systemRegistryRefreshLock.deleteMany({
      where: {
        lockKey: input.lockKey,
        lockedUntil: { lt: new Date() },
      },
    })

    // Now try to create the new lock
    // If a valid (non-expired) lock exists, this will fail with unique constraint violation
    await db.systemRegistryRefreshLock.create({
      data: {
        lockKey: input.lockKey,
        lockedUntil: input.lockedUntil,
        startedAt: new Date(),
        requestedByUserId: input.requestedByUserId,
        jobId: input.jobId,
      },
    })

    return true
  } catch (error) {
    // If unique constraint violation (P2002), lock is held by another process
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false
    }
    // For any other error, log and re-throw
    console.error("[acquireRefreshLock] Unexpected error:", error)
    throw error
  }
}

/**
 * Release a refresh lock.
 */
export async function releaseRefreshLock(lockKey: string): Promise<void> {
  try {
    await db.systemRegistryRefreshLock.delete({
      where: { lockKey },
    })
  } catch (error) {
    // Lock may not exist, that's ok
    console.warn("[releaseRefreshLock] Lock not found:", lockKey)
  }
}

// ============================================================================
// Query Operations (for Admin UI)
// ============================================================================

/**
 * Get recent events, ordered by most recent first.
 */
export async function getRecentEvents(limit: number = 20) {
  return db.systemRegistryStatusEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

/**
 * Get the current active lock (if any).
 */
export async function getCurrentLock() {
  return db.systemRegistryRefreshLock.findFirst({
    where: {
      lockedUntil: { gt: new Date() },
    },
  })
}
