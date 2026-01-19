// src/lib/regulatory-truth/crawlers/nn-sentinel/types.ts
/**
 * Type definitions for NN Sentinel
 */

// =============================================================================
// Configuration Types
// =============================================================================

export type NNCrawlMode = "BACKFILL" | "INCREMENTAL"

export interface NNSentinelPolicy {
  /** Requests per second (default: 1) */
  rateLimitRps: number
  /** Max concurrent requests (default: 2) */
  maxConcurrent: number
  /** Max retries for listing fetches (default: 3) */
  maxRetries: number
  /** Stop on anomaly detection (default: true) */
  stopOnAnomaly: boolean
  /** User agent string */
  userAgent: string
  /** Respect robots.txt (default: true) */
  respectRobots: boolean
  /**
   * Max detailed audit events before switching to summary mode.
   * After this limit, only per-issue summaries are logged.
   * Default: 10000
   */
  maxDetailedAuditEvents: number
}

export interface NNSentinelConfig {
  /** Start year (inclusive) */
  yearStart: number
  /** End year (inclusive) */
  yearEnd: number
  /** Optional issue range filters per year */
  issueRanges?: Record<number, { start?: number; end?: number }>
  /** Crawl mode */
  crawlMode: NNCrawlMode
  /** Policy overrides */
  policy?: Partial<NNSentinelPolicy>
}

// =============================================================================
// Job Types
// =============================================================================

export interface NNFetchJob {
  /** Unique job key: nn:item:YYYY:ISSUE:ITEM */
  jobKey: string
  /** Run ID for tracking */
  runId: string
  /** Source information */
  source: {
    sourceType: "NN_SLUZBENI"
    url: string
    discoveredFromUrl: string
  }
  /** NN-specific metadata */
  nn: {
    year: number
    issue: number
    item: number
    month?: number
  }
  /** Hints for downstream processing */
  hints?: {
    textType?: "CONSOLIDATED" | "AMENDMENT" | "UNKNOWN"
    title?: string
    eli?: string
  }
  /** Audit trail */
  audit: {
    enumeratedAt: string
    enumeratorVersion: string
  }
}

// =============================================================================
// Checkpoint Types
// =============================================================================

export interface NNCheckpointState {
  id: string
  schedulerRunId: string
  year: number
  lastCompletedIssueNumber: number | null
  status: "RUNNING" | "COMPLETED" | "PAUSED"
  anomalyCount: number
  totalIssuesDiscovered: number
  totalItemsEnqueued: number
  totalItemsSkipped: number
}

// =============================================================================
// Per-Issue Summary (for coverage tracking in summary mode)
// =============================================================================

export interface IssueSummary {
  year: number
  issue: number
  itemsDiscovered: number
  itemsEnqueued: number
  itemsSkippedAlreadyEnqueued: number
  itemsSkippedOutOfRange: number
}

// =============================================================================
// Result Types
// =============================================================================

export interface NNSentinelResult {
  success: boolean
  yearsProcessed: number
  issuesProcessed: number
  itemsEnqueued: number
  itemsSkipped: number
  paused: boolean
  pauseReason?: string
  issueSummaries: IssueSummary[]
}

// =============================================================================
// Anomaly Types
// =============================================================================

export type AnomalyReasonCode =
  | "PAUSED_ANOMALY_NO_ISSUES"
  | "PAUSED_ANOMALY_NO_ITEMS"
  | "PAUSED_ANOMALY_DUPLICATE_KEYS"
  | "FAILED_FETCH_LISTING"

export interface AnomalyResult {
  isAnomaly: boolean
  reasonCode?: AnomalyReasonCode
  message?: string
}

// =============================================================================
// Dependencies (for injection)
// =============================================================================

export interface NNListingFetcher {
  fetchYearPage(year: number): Promise<string>
  fetchIssuePage(year: number, issue: number): Promise<string>
}

export interface NNSentinelDependencies {
  fetcher: NNListingFetcher
  enqueueJob: (job: NNFetchJob) => Promise<void>
}
