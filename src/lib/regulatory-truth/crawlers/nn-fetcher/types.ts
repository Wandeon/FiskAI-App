// src/lib/regulatory-truth/crawlers/nn-fetcher/types.ts
/**
 * Type definitions for NN Fetcher
 *
 * Fetcher consumes NNFetchJob from sentinel, fetches item HTML (and optional PDF),
 * stores Evidence snapshots, links to Instrument when possible, and enqueues parse jobs.
 */

import type { NNFetchJob } from "../nn-sentinel/types"

// Re-export NNFetchJob for convenience
export type { NNFetchJob }

// =============================================================================
// Fetcher Configuration
// =============================================================================

export interface NNFetcherPolicy {
  /** Requests per second - lower than sentinel since fetcher is heavier (default: 0.5) */
  rateLimitRps: number
  /** Max concurrent fetches (default: 1) */
  maxConcurrent: number
  /** Max retries for fetch failures (default: 3) */
  maxRetries: number
  /** Initial backoff delay in ms (default: 2000) */
  initialBackoffMs: number
  /** Max backoff delay in ms (default: 60000) */
  maxBackoffMs: number
  /** Request timeout in ms (default: 30000) */
  timeoutMs: number
  /** User agent string */
  userAgent: string
  /** Whether to fetch PDFs linked from item pages (default: true) */
  fetchPdfs: boolean
  /** Parser version to include in parse jobs */
  parserVersion: string
}

export const DEFAULT_FETCHER_POLICY: NNFetcherPolicy = {
  rateLimitRps: 0.5,
  maxConcurrent: 1,
  maxRetries: 3,
  initialBackoffMs: 2000,
  maxBackoffMs: 60000,
  timeoutMs: 30000,
  userAgent: "FiskAI-NNFetcher/1.0 (+https://fiskai.hr)",
  fetchPdfs: true,
  parserVersion: "1.0.0",
}

// =============================================================================
// Fetch Result Types
// =============================================================================

export type FetchDecision =
  | "FETCH_SUCCESS"
  | "FETCH_SKIPPED_UNCHANGED"
  | "FETCH_RETRY"
  | "FETCH_FAILED"
  | "FETCH_PDF_STORED"

export interface FetchAttemptResult {
  decision: FetchDecision
  evidenceId?: string
  contentHash?: string
  statusCode?: number
  error?: string
  retryAfterMs?: number
}

export interface PdfFetchResult {
  decision: "FETCH_PDF_STORED" | "FETCH_FAILED" | "FETCH_SKIPPED_UNCHANGED"
  evidenceId?: string
  contentHash?: string
  pdfUrl?: string
  error?: string
}

export interface NNFetcherResult {
  success: boolean
  jobKey: string
  htmlEvidence?: {
    id: string
    contentHash: string
    wasCreated: boolean
    instrumentId?: string | null
  }
  pdfEvidence?: {
    id: string
    contentHash: string
    wasCreated: boolean
    pdfUrl: string
  }
  parseJobEnqueued: boolean
  error?: string
}

// =============================================================================
// ELI Extraction
// =============================================================================

export interface ExtractedEli {
  eliUri: string
  title?: string
}

// =============================================================================
// Audit Event Types
// =============================================================================

export type NNFetchEventType =
  | "FETCH_STARTED"
  | "FETCH_SUCCESS"
  | "FETCH_RETRY"
  | "FETCH_FAILED"
  | "FETCH_SKIPPED_UNCHANGED"
  | "FETCH_PDF_STORED"
  | "FETCH_PDF_FAILED"
  | "PARSE_ENQUEUED"
  | "INSTRUMENT_LINKED"
  | "INSTRUMENT_CREATED"

export interface NNFetchAuditEventData {
  jobKey: string
  runId: string
  eventType: NNFetchEventType
  url?: string
  contentHash?: string
  statusCode?: number
  evidenceId?: string
  instrumentId?: string
  pdfUrl?: string
  error?: string
  retryCount?: number
  durationMs?: number
}

// =============================================================================
// Dependencies (for injection)
// =============================================================================

export interface NNPageFetcher {
  fetchPage(url: string): Promise<FetchPageResult>
}

export interface FetchPageResult {
  ok: boolean
  statusCode: number
  content?: string
  contentType?: string
  error?: string
  headers?: Record<string, string>
}

export interface NNFetcherDependencies {
  pageFetcher: NNPageFetcher
  enqueueParseJob: (job: ParseJob) => Promise<void>
}

// =============================================================================
// Parse Job (output to nn-parser queue)
// =============================================================================

export interface ParseJob {
  evidenceId: string
  parserVersion: string
  jobKey: string
  source: {
    sourceType: "NN_SLUZBENI"
    url: string
  }
  nn: {
    year: number
    issue: number
    item: number
  }
  hints?: {
    instrumentId?: string
    eliUri?: string
    title?: string
  }
}
