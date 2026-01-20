// src/lib/regulatory-truth/crawlers/nn-sentinel/sentinel.ts
/**
 * NN Sentinel Core Logic
 *
 * Deterministically enumerates Narodne Novine URLs and enqueues fetch jobs.
 * Uses NNEnqueuedJob table for race-proof global idempotency.
 */

import { dbReg } from "@/lib/db"
import { parseYearPage, parseIssuePage, type DiscoveredItem } from "./parser"
import type {
  NNSentinelConfig,
  NNSentinelPolicy,
  NNSentinelResult,
  NNSentinelDependencies,
  NNFetchJob,
  NNCheckpointState,
  IssueSummary,
  AnomalyResult,
} from "./types"

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_POLICY: NNSentinelPolicy = {
  rateLimitRps: 1,
  maxConcurrent: 2,
  maxRetries: 3,
  stopOnAnomaly: true,
  userAgent: "FiskAI-NNSentinel/1.0 (fiskai.hr; regulatory compliance)",
  respectRobots: true,
  maxDetailedAuditEvents: 10000,
}

const ENUMERATOR_VERSION = process.env.GIT_SHA || "1.0.0"

// =============================================================================
// Checkpoint Management
// =============================================================================

async function getOrCreateCheckpoint(
  schedulerRunId: string,
  year: number
): Promise<NNCheckpointState> {
  const existing = await dbReg.nNSentinelCheckpoint.findUnique({
    where: { schedulerRunId_year: { schedulerRunId, year } },
  })

  if (existing) {
    return existing as NNCheckpointState
  }

  const created = await dbReg.nNSentinelCheckpoint.create({
    data: {
      schedulerRunId,
      year,
      status: "RUNNING",
    },
  })

  return created as NNCheckpointState
}

async function updateCheckpoint(
  checkpointId: string,
  updates: Partial<NNCheckpointState>
): Promise<void> {
  await dbReg.nNSentinelCheckpoint.update({
    where: { id: checkpointId },
    data: updates,
  })
}

// =============================================================================
// Audit Event Logging
// =============================================================================

type AuditEventType = "DISCOVERY" | "ENQUEUE" | "SKIP" | "ANOMALY" | "ERROR"
type AuditDecision = "INFO" | "ENQUEUED" | "SKIPPED" | "PAUSED" | "FAILED"
type AuditReasonCode =
  | "RUN_STARTED"
  | "RUN_COMPLETED"
  | "DISCOVERED_YEAR_ISSUES"
  | "DISCOVERED_ISSUE_ITEMS"
  | "ISSUE_SUMMARY"
  | "ENQUEUED_ITEM"
  | "SKIPPED_ALREADY_ENQUEUED"
  | "SKIPPED_OUT_OF_RANGE"
  | "PAUSED_ANOMALY_NO_ISSUES"
  | "PAUSED_ANOMALY_NO_ITEMS"
  | "PAUSED_ANOMALY_DUPLICATE_KEYS"
  | "FAILED_FETCH_LISTING"
  | "SWITCHED_TO_SUMMARY_MODE"
  | "CHECKPOINT_UPDATED"

async function logAuditEvent(
  schedulerRunId: string,
  eventType: AuditEventType,
  decision: AuditDecision,
  reasonCode: AuditReasonCode,
  context: {
    year?: number
    issue?: number
    item?: number
    url?: string
    jobKey?: string
    issueCount?: number
    itemCount?: number
    details?: Record<string, unknown>
  }
): Promise<void> {
  await dbReg.nNSentinelAuditEvent.create({
    data: {
      schedulerRunId,
      eventType,
      decision,
      reasonCode,
      year: context.year ?? null,
      issue: context.issue ?? null,
      item: context.item ?? null,
      url: context.url ?? null,
      jobKey: context.jobKey ?? null,
      issueCount: context.issueCount ?? null,
      itemCount: context.itemCount ?? null,
      details: context.details ?? null,
    },
  })
}

// =============================================================================
// Anomaly Detection
// =============================================================================

function checkYearPageAnomalies(issues: { issueNumber: number }[], year: number): AnomalyResult {
  if (issues.length === 0) {
    return {
      isAnomaly: true,
      reasonCode: "PAUSED_ANOMALY_NO_ISSUES",
      message: `Year ${year} has zero issues - likely a scraping error`,
    }
  }
  return { isAnomaly: false }
}

function checkIssuePageAnomalies(
  items: DiscoveredItem[],
  year: number,
  issue: number
): AnomalyResult {
  if (items.length === 0) {
    return {
      isAnomaly: true,
      reasonCode: "PAUSED_ANOMALY_NO_ITEMS",
      message: `Issue ${year}/${issue} has zero items - likely a scraping error`,
    }
  }

  // Check for duplicates (items are already sorted by parseIssuePage)
  const itemNumbers = items.map((i) => i.itemNumber)
  const uniqueNumbers = new Set(itemNumbers)
  if (uniqueNumbers.size !== itemNumbers.length) {
    return {
      isAnomaly: true,
      reasonCode: "PAUSED_ANOMALY_DUPLICATE_KEYS",
      message: `Issue ${year}/${issue} has duplicate item numbers`,
    }
  }

  return { isAnomaly: false }
}

// =============================================================================
// Job Key Generation
// =============================================================================

function generateJobKey(year: number, issue: number, item: number): string {
  return `nn:item:${year}:${issue}:${item}`
}

// =============================================================================
// Retry Helper
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(
  fetchFn: () => Promise<string>,
  maxRetries: number,
  baseDelayMs: number = 1000
): Promise<string> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt === maxRetries) break
      const delay = baseDelayMs * Math.pow(2, attempt)
      await sleep(delay)
    }
  }
  throw lastError
}

// =============================================================================
// NNEnqueuedJob-based Idempotency
// =============================================================================

interface EnqueueAttemptResult {
  enqueued: boolean
  alreadyExists: boolean
}

/**
 * Attempt to register a job in NNEnqueuedJob table.
 * Returns { enqueued: true } if insert succeeded (should enqueue).
 * Returns { enqueued: false, alreadyExists: true } if unique constraint violated.
 */
async function tryRegisterJob(
  jobKey: string,
  schedulerRunId: string,
  year: number,
  issue: number,
  item: number,
  url: string
): Promise<EnqueueAttemptResult> {
  try {
    await dbReg.nNEnqueuedJob.create({
      data: {
        jobKey,
        firstSchedulerRunId: schedulerRunId,
        year,
        issue,
        item,
        url,
      },
    })
    return { enqueued: true, alreadyExists: false }
  } catch (error) {
    // Check for unique constraint violation
    if (
      error instanceof Error &&
      (error.message.includes("Unique constraint") ||
        error.message.includes("unique constraint") ||
        error.message.includes("P2002"))
    ) {
      // Update latestSchedulerRunId to track that we saw this again
      await dbReg.nNEnqueuedJob
        .update({
          where: { jobKey },
          data: { latestSchedulerRunId: schedulerRunId },
        })
        .catch(() => {
          // Ignore update errors - the important thing is we didn't enqueue
        })
      return { enqueued: false, alreadyExists: true }
    }
    throw error
  }
}

// =============================================================================
// Main Enumeration Logic
// =============================================================================

export { NNSentinelConfig, NNSentinelResult }

/**
 * Main enumeration function.
 * Can be called with injected dependencies for testing.
 */
export async function runNNSentinelEnumeration(
  config: NNSentinelConfig,
  schedulerRunId: string,
  runId: string,
  deps: NNSentinelDependencies
): Promise<NNSentinelResult> {
  const { fetcher, enqueueJob } = deps
  const policy = { ...DEFAULT_POLICY, ...config.policy }

  let yearsProcessed = 0
  let issuesProcessed = 0
  let itemsEnqueued = 0
  let itemsSkipped = 0
  let paused = false
  let pauseReason: string | undefined
  let detailedAuditEvents = 0
  const issueSummaries: IssueSummary[] = []

  // Log run start
  await logAuditEvent(schedulerRunId, "DISCOVERY", "INFO", "RUN_STARTED", {
    details: {
      yearStart: config.yearStart,
      yearEnd: config.yearEnd,
      crawlMode: config.crawlMode,
    },
  })

  // Process years in ascending order
  for (let year = config.yearStart; year <= config.yearEnd && !paused; year++) {
    const checkpoint = await getOrCreateCheckpoint(schedulerRunId, year)

    // Skip completed years
    if (checkpoint.status === "COMPLETED") {
      yearsProcessed++
      continue
    }

    // Fetch and parse year page (with retry)
    let yearHtml: string
    try {
      yearHtml = await fetchWithRetry(() => fetcher.fetchYearPage(year), policy.maxRetries, 1000)
    } catch (error) {
      await logAuditEvent(schedulerRunId, "ERROR", "FAILED", "FAILED_FETCH_LISTING", {
        year,
        details: {
          error: error instanceof Error ? error.message : String(error),
          retriesAttempted: policy.maxRetries,
        },
      })

      if (policy.stopOnAnomaly) {
        paused = true
        pauseReason = `Failed to fetch year page ${year} after ${policy.maxRetries} retries`
        await updateCheckpoint(checkpoint.id, { status: "PAUSED", anomalyCount: 1 })
      }
      continue
    }

    const issues = parseYearPage(yearHtml, year)

    // Check for anomalies
    const yearAnomaly = checkYearPageAnomalies(issues, year)
    if (yearAnomaly.isAnomaly && policy.stopOnAnomaly) {
      await logAuditEvent(schedulerRunId, "ANOMALY", "PAUSED", yearAnomaly.reasonCode!, {
        year,
        details: { message: yearAnomaly.message },
      })
      await updateCheckpoint(checkpoint.id, { status: "PAUSED", anomalyCount: 1 })
      paused = true
      pauseReason = yearAnomaly.message
      break
    }

    // Log discovered issues
    await logAuditEvent(schedulerRunId, "DISCOVERY", "INFO", "DISCOVERED_YEAR_ISSUES", {
      year,
      issueCount: issues.length,
    })

    await updateCheckpoint(checkpoint.id, { totalIssuesDiscovered: issues.length })

    // Apply issue range filter if specified
    const issueRange = config.issueRanges?.[year]
    const filteredIssues = issues.filter((issue) => {
      if (issueRange?.start && issue.issueNumber < issueRange.start) return false
      if (issueRange?.end && issue.issueNumber > issueRange.end) return false
      return true
    })

    // Process issues in ascending order
    for (const issue of filteredIssues) {
      // Skip already completed issues
      if (
        checkpoint.lastCompletedIssueNumber !== null &&
        issue.issueNumber <= checkpoint.lastCompletedIssueNumber
      ) {
        continue
      }

      // Rate limiting between issue page fetches
      await sleep(1000 / policy.rateLimitRps)

      // Fetch and parse issue page (with retry)
      let issueHtml: string
      try {
        issueHtml = await fetchWithRetry(
          () => fetcher.fetchIssuePage(year, issue.issueNumber),
          policy.maxRetries,
          1000
        )
      } catch (error) {
        await logAuditEvent(schedulerRunId, "ERROR", "FAILED", "FAILED_FETCH_LISTING", {
          year,
          issue: issue.issueNumber,
          url: issue.issueUrl,
          details: {
            error: error instanceof Error ? error.message : String(error),
            retriesAttempted: policy.maxRetries,
          },
        })

        if (policy.stopOnAnomaly) {
          paused = true
          pauseReason = `Failed to fetch issue page ${year}/${issue.issueNumber} after ${policy.maxRetries} retries`
          await updateCheckpoint(checkpoint.id, { status: "PAUSED", anomalyCount: 1 })
        }
        continue
      }

      const items = parseIssuePage(issueHtml, year, issue.issueNumber)

      // Check for anomalies
      const issueAnomaly = checkIssuePageAnomalies(items, year, issue.issueNumber)
      if (issueAnomaly.isAnomaly && policy.stopOnAnomaly) {
        await logAuditEvent(schedulerRunId, "ANOMALY", "PAUSED", issueAnomaly.reasonCode!, {
          year,
          issue: issue.issueNumber,
          details: { message: issueAnomaly.message },
        })
        await updateCheckpoint(checkpoint.id, { status: "PAUSED", anomalyCount: 1 })
        paused = true
        pauseReason = issueAnomaly.message
        break
      }

      // Log discovered items
      await logAuditEvent(schedulerRunId, "DISCOVERY", "INFO", "DISCOVERED_ISSUE_ITEMS", {
        year,
        issue: issue.issueNumber,
        itemCount: items.length,
      })

      // Per-issue counters for coverage tracking
      let issueItemsEnqueued = 0
      let issueItemsSkippedAlreadyEnqueued = 0
      const issueItemsSkippedOutOfRange = 0

      // Enqueue fetch jobs for each item
      for (const item of items) {
        const jobKey = generateJobKey(year, issue.issueNumber, item.itemNumber)

        // Race-proof idempotency via NNEnqueuedJob table
        const result = await tryRegisterJob(
          jobKey,
          schedulerRunId,
          year,
          issue.issueNumber,
          item.itemNumber,
          item.itemUrl
        )

        if (result.alreadyExists) {
          // Already enqueued in a previous run - skip
          issueItemsSkippedAlreadyEnqueued++
          itemsSkipped++

          // Log skip event (if not in summary mode)
          if (detailedAuditEvents < policy.maxDetailedAuditEvents) {
            await logAuditEvent(schedulerRunId, "SKIP", "SKIPPED", "SKIPPED_ALREADY_ENQUEUED", {
              year,
              issue: issue.issueNumber,
              item: item.itemNumber,
              jobKey,
            })
            detailedAuditEvents++
          }
          continue
        }

        // Create fetch job
        const fetchJob: NNFetchJob = {
          jobKey,
          runId,
          source: {
            sourceType: "NN_SLUZBENI",
            url: item.itemUrl,
            discoveredFromUrl: issue.issueUrl,
          },
          nn: {
            year,
            issue: issue.issueNumber,
            item: item.itemNumber,
            month: issue.month,
          },
          hints: {
            textType: item.textType,
            title: item.title,
          },
          audit: {
            enumeratedAt: new Date().toISOString(),
            enumeratorVersion: ENUMERATOR_VERSION,
          },
        }

        // Enqueue
        await enqueueJob(fetchJob)

        // Log enqueue event (if not in summary mode)
        if (detailedAuditEvents < policy.maxDetailedAuditEvents) {
          await logAuditEvent(schedulerRunId, "ENQUEUE", "ENQUEUED", "ENQUEUED_ITEM", {
            year,
            issue: issue.issueNumber,
            item: item.itemNumber,
            url: item.itemUrl,
            jobKey,
          })
          detailedAuditEvents++

          // Log transition to summary mode
          if (detailedAuditEvents === policy.maxDetailedAuditEvents) {
            await logAuditEvent(schedulerRunId, "DISCOVERY", "INFO", "SWITCHED_TO_SUMMARY_MODE", {
              details: {
                reason: `Reached ${policy.maxDetailedAuditEvents} detailed events`,
                remainingItemsCountedInIssueSummaries: true,
              },
            })
          }
        }

        issueItemsEnqueued++
        itemsEnqueued++
      }

      // Always log per-issue summary (even in summary mode) for coverage tracking
      const issueSummary: IssueSummary = {
        year,
        issue: issue.issueNumber,
        itemsDiscovered: items.length,
        itemsEnqueued: issueItemsEnqueued,
        itemsSkippedAlreadyEnqueued: issueItemsSkippedAlreadyEnqueued,
        itemsSkippedOutOfRange: issueItemsSkippedOutOfRange,
      }
      issueSummaries.push(issueSummary)

      await logAuditEvent(schedulerRunId, "DISCOVERY", "INFO", "ISSUE_SUMMARY", {
        year,
        issue: issue.issueNumber,
        itemCount: items.length,
        details: {
          itemsEnqueued: issueItemsEnqueued,
          itemsSkippedAlreadyEnqueued: issueItemsSkippedAlreadyEnqueued,
          itemsSkippedOutOfRange: issueItemsSkippedOutOfRange,
        },
      })

      // Update checkpoint after completing issue
      await updateCheckpoint(checkpoint.id, {
        lastCompletedIssueNumber: issue.issueNumber,
        totalItemsEnqueued: itemsEnqueued,
        totalItemsSkipped: itemsSkipped,
      })

      issuesProcessed++
    }

    // Mark year as completed if not paused
    if (!paused) {
      await updateCheckpoint(checkpoint.id, { status: "COMPLETED" })
      yearsProcessed++
    }
  }

  // Log run completion
  if (!paused) {
    await logAuditEvent(schedulerRunId, "DISCOVERY", "INFO", "RUN_COMPLETED", {
      details: { yearsProcessed, issuesProcessed, itemsEnqueued, itemsSkipped },
    })
  }

  return {
    success: !paused,
    yearsProcessed,
    issuesProcessed,
    itemsEnqueued,
    itemsSkipped,
    paused,
    pauseReason,
    issueSummaries,
  }
}
