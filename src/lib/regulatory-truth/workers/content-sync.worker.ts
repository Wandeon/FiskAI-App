// src/lib/regulatory-truth/workers/content-sync.worker.ts
/**
 * Content Sync Worker for processing RTL -> Content sync events.
 *
 * This worker:
 * 1. Claims pending events from the database (atomic UPDATE)
 * 2. Looks up concept mapping to find target MDX files
 * 3. Patches frontmatter with changelog entries
 * 4. Creates a branch, commits, pushes, and creates a PR
 * 5. Marks event as DONE on success
 *
 * Error handling:
 * - PERMANENT errors -> dead-letter immediately
 * - TRANSIENT errors -> mark failed and re-throw for BullMQ retry
 */

import * as path from "path"

import { Job } from "bullmq"
import { eq, sql } from "drizzle-orm"

import { drizzleDb } from "@/lib/db/drizzle"
import {
  contentSyncEvents,
  type ContentSyncEvent,
  type ContentSyncStatus,
  type DeadLetterReason,
} from "@/lib/db/schema/content-sync"

import { createWorker, type JobResult } from "./base"
import { contentSyncQueue } from "./queues"
import {
  getConceptMapping,
  resolveContentPaths,
  patchFrontmatter,
  writeMdxFile,
  GitContentRepoAdapter,
  generateBranchName,
  generatePRTitle,
  generatePRBody,
  classifyError,
  UnmappedConceptError,
  PatchConflictError,
  isContentSyncEventV1,
  type ContentSyncEventV1,
} from "../content-sync"

// =============================================================================
// Types
// =============================================================================

/**
 * Job data for content sync queue.
 */
export interface ContentSyncJobData {
  eventId: string
}

// =============================================================================
// Constants
// =============================================================================

/**
 * BullMQ job options for content sync jobs.
 * 8 attempts with exponential backoff starting at 30s.
 * Max delay is approximately 30 minutes.
 */
const JOB_OPTIONS = {
  attempts: 8,
  backoff: {
    type: "exponential" as const,
    delay: 30000, // 30s initial
  },
}

/**
 * Repository root directory.
 * Set via REPO_ROOT env var or defaults to current working directory.
 */
const REPO_ROOT = process.env.REPO_ROOT ?? process.cwd()

/**
 * Content directory (relative to REPO_ROOT, not cwd).
 * Set via CONTENT_DIR env var or defaults to "content".
 *
 * If CONTENT_DIR is absolute, uses it directly.
 * If relative, resolves against REPO_ROOT.
 */
const CONTENT_DIR = path.isAbsolute(process.env.CONTENT_DIR ?? "")
  ? process.env.CONTENT_DIR!
  : path.join(REPO_ROOT, process.env.CONTENT_DIR ?? "content")

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Claim an event for processing using atomic UPDATE.
 *
 * This ensures only one worker can claim an event at a time.
 * The WHERE clause filters to only claimable statuses.
 *
 * @param eventId - The event ID to claim
 * @returns The claimed event, or null if already claimed/processed
 */
async function claimEvent(eventId: string): Promise<ContentSyncEvent | null> {
  const claimableStatuses: ContentSyncStatus[] = ["PENDING", "ENQUEUED", "FAILED"]

  const result = await drizzleDb
    .update(contentSyncEvents)
    .set({
      status: "PROCESSING",
      attempts: sql`${contentSyncEvents.attempts} + 1`,
      lastAttemptAt: new Date(),
    })
    .where(
      sql`${contentSyncEvents.eventId} = ${eventId}
          AND ${contentSyncEvents.status} IN (${sql.join(
            claimableStatuses.map((s) => sql`${s}`),
            sql`, `
          )})`
    )
    .returning()

  return result[0] ?? null
}

/**
 * Mark an event as successfully processed.
 *
 * @param eventId - The event ID to mark as done
 * @param prUrl - The GitHub PR URL created for this event
 */
async function markDone(eventId: string, prUrl?: string): Promise<void> {
  await drizzleDb
    .update(contentSyncEvents)
    .set({
      status: "DONE",
      processedAt: new Date(),
      prUrl: prUrl ?? null,
      prCreatedAt: prUrl ? new Date() : null,
    })
    .where(eq(contentSyncEvents.eventId, eventId))
}

/**
 * Mark an event as failed for retry.
 *
 * @param eventId - The event ID to mark as failed
 * @param error - The error message
 */
async function markFailed(eventId: string, error: string): Promise<void> {
  await drizzleDb
    .update(contentSyncEvents)
    .set({
      status: "FAILED",
      lastError: error,
      lastErrorAt: new Date(),
    })
    .where(eq(contentSyncEvents.eventId, eventId))
}

/**
 * Mark an event as dead-lettered (permanent failure).
 *
 * @param eventId - The event ID to dead-letter
 * @param reason - The dead letter reason enum value
 * @param note - Human-readable note about the failure
 */
async function markDeadLettered(
  eventId: string,
  reason: DeadLetterReason,
  note: string
): Promise<void> {
  await drizzleDb
    .update(contentSyncEvents)
    .set({
      status: "DEAD_LETTERED",
      deadLetterReason: reason,
      deadLetterNote: note,
      lastError: note,
      lastErrorAt: new Date(),
    })
    .where(eq(contentSyncEvents.eventId, eventId))
}

/**
 * Mark an event as skipped (e.g., all files already had this eventId).
 *
 * @param eventId - The event ID to skip
 * @param note - Human-readable note about why it was skipped
 */
async function markSkipped(eventId: string, note: string): Promise<void> {
  await drizzleDb
    .update(contentSyncEvents)
    .set({
      status: "SKIPPED",
      deadLetterNote: note,
      processedAt: new Date(),
    })
    .where(eq(contentSyncEvents.eventId, eventId))
}

// =============================================================================
// Job Processor
// =============================================================================

/**
 * Process a content sync job.
 *
 * Flow:
 * 1. Transaction A: Claim event (atomic UPDATE)
 * 2. Look up concept mapping
 * 3. Transaction B: File operations (patch MDX files)
 * 4. Git operations (branch, commit, push, PR)
 * 5. Transaction C: Mark done
 *
 * @param job - The BullMQ job containing the event ID
 * @returns Job result with success status and metadata
 */
async function processContentSyncJob(
  job: Job<ContentSyncJobData>
): Promise<JobResult> {
  const start = Date.now()
  const { eventId } = job.data

  // Transaction A: Claim event
  const event = await claimEvent(eventId)
  if (!event) {
    // Already processed or claimed by another worker
    console.log(`[content-sync] Event ${eventId} already claimed or processed`)
    return { success: true, data: { skipped: true }, duration: Date.now() - start }
  }

  // Validate payload
  if (!isContentSyncEventV1(event.payload)) {
    await markDeadLettered(
      eventId,
      "INVALID_PAYLOAD",
      "Payload does not match ContentSyncEventV1 schema"
    )
    return {
      success: false,
      error: "Invalid payload",
      duration: Date.now() - start,
    }
  }

  const payload = event.payload as ContentSyncEventV1

  // Create repo adapter early for cleanup on failure
  const repoAdapter = new GitContentRepoAdapter(REPO_ROOT)
  let branchName: string | undefined

  try {
    // Look up concept mapping
    const mapping = getConceptMapping(event.conceptId)
    if (!mapping) {
      throw new UnmappedConceptError(event.conceptId)
    }

    // Resolve content paths
    const contentPaths = resolveContentPaths(mapping, CONTENT_DIR)
    const patchedFiles: string[] = []
    const skippedFiles: string[] = []

    // Transaction B: File operations
    branchName = generateBranchName(eventId, event.conceptId)

    // Create branch for changes
    repoAdapter.createBranch(branchName)

    // Patch each target file
    for (const filePath of contentPaths) {
      try {
        const patchedContent = await patchFrontmatter(filePath, payload)
        await writeMdxFile(filePath, patchedContent)
        patchedFiles.push(filePath)
      } catch (err) {
        if (err instanceof PatchConflictError) {
          // Already has this eventId - skip but continue with other files
          console.log(`[content-sync] Skipping ${filePath}: ${err.message}`)
          skippedFiles.push(filePath)
        } else {
          throw err
        }
      }
    }

    // If no files were patched, skip (all files already had this eventId)
    if (patchedFiles.length === 0) {
      await markSkipped(
        eventId,
        `All ${contentPaths.length} files already had eventId`
      )
      return {
        success: true,
        data: { skipped: true, reason: "all_files_had_eventId" },
        duration: Date.now() - start,
      }
    }

    // Stage and commit changes
    repoAdapter.stageFiles(patchedFiles)
    repoAdapter.commit(
      `docs: sync ${event.conceptId} from RTL event ${eventId.slice(0, 8)}`
    )

    // Push branch to remote
    repoAdapter.pushBranch(branchName)

    // Create PR for human review
    const prUrl = repoAdapter.createPR({
      title: generatePRTitle(event.conceptId, payload.changeType),
      body: generatePRBody({
        eventId,
        conceptId: event.conceptId,
        ruleId: event.ruleId,
        changeType: payload.changeType,
        effectiveFrom: payload.effectiveFrom,
        sourcePointerIds: payload.sourcePointerIds,
        primarySourceUrl: payload.primarySourceUrl,
        patchedFiles: patchedFiles.map((p) => path.relative(REPO_ROOT, p)),
      }),
    })

    console.log(`[content-sync] Created PR: ${prUrl}`)

    // Transaction C: Mark done and store PR URL
    await markDone(eventId, prUrl)

    return {
      success: true,
      data: {
        prUrl,
        patchedFiles: patchedFiles.length,
        skippedFiles: skippedFiles.length,
      },
      duration: Date.now() - start,
    }
  } catch (err) {
    const classification = classifyError(err)

    if (classification.kind === "PERMANENT") {
      // Dead-letter immediately - no point retrying
      await markDeadLettered(
        eventId,
        classification.deadLetterReason ?? "UNKNOWN",
        classification.message
      )
      console.error(
        `[content-sync] Dead-lettered ${eventId}: ${classification.message}`
      )
      return {
        success: false,
        data: { deadLettered: true },
        error: classification.message,
        duration: Date.now() - start,
      }
    } else {
      // Clean up git state before retry (reset working tree, return to main)
      try {
        repoAdapter.cleanup(branchName)
        console.log(`[content-sync] Cleaned up git state for retry`)
      } catch (cleanupErr) {
        console.error(`[content-sync] Cleanup failed:`, cleanupErr)
        // Continue with retry anyway
      }

      // Mark failed for retry
      await markFailed(eventId, classification.message)
      console.error(
        `[content-sync] Failed ${eventId} (will retry): ${classification.message}`
      )
      // Re-throw for BullMQ retry
      throw err
    }
  }
}

// =============================================================================
// Worker Instance
// =============================================================================

/**
 * Content sync BullMQ worker.
 *
 * Configuration:
 * - concurrency: 1 (one job at a time to avoid git conflicts)
 * - lockDuration: 5 minutes (for long-running git operations)
 * - stalledInterval: 60s
 */
export const contentSyncWorker = createWorker<ContentSyncJobData>(
  "content-sync",
  processContentSyncJob,
  {
    name: "content-sync",
    concurrency: 1, // One at a time to avoid git conflicts
    lockDuration: 300000, // 5 minutes
    stalledInterval: 60000, // 1 minute
  }
)

// =============================================================================
// Job Enqueuer
// =============================================================================

/**
 * Enqueue a content sync job.
 *
 * Uses the eventId as the BullMQ jobId for deduplication.
 * Also updates the event status to ENQUEUED in the database.
 *
 * @param eventId - The event ID to enqueue
 */
export async function enqueueContentSyncJob(eventId: string): Promise<void> {
  await contentSyncQueue.add(
    "sync",
    { eventId },
    {
      ...JOB_OPTIONS,
      jobId: eventId, // Dedup by eventId
    }
  )

  // Update status to ENQUEUED
  await drizzleDb
    .update(contentSyncEvents)
    .set({ status: "ENQUEUED" })
    .where(eq(contentSyncEvents.eventId, eventId))
}
