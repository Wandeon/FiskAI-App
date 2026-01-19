// src/lib/regulatory-truth/crawlers/nn-sentinel/index.ts
/**
 * NN Sentinel - Deterministic Narodne Novine Enumeration
 *
 * Enumerates Narodne Novine (Croatian Official Gazette) year/issue/item URLs
 * and enqueues nn.fetch jobs. This module does NOT fetch content or detect changes.
 *
 * Key principles:
 * - Deterministic: same inputs = same outputs in same order
 * - Resumable: checkpoint per year/issue prevents gaps on restart
 * - Race-proof: NNEnqueuedJob table ensures global idempotency
 * - Auditable: per-issue counters preserve coverage visibility
 * - Anomaly-aware: stops on suspicious patterns rather than guessing
 *
 * Separation of concerns:
 * - nn-sentinel: enumerate URLs → emit fetch jobs
 * - nn-fetcher: fetch HTML → store Evidence
 * - nn-diff: compare hashes → decide what changed
 * - nn-parser: parse Evidence → store ParseSnapshot
 */

export { runNNSentinelEnumeration, type NNSentinelConfig, type NNSentinelResult } from "./sentinel"
export { parseYearPage, parseIssuePage, type DiscoveredIssue, type DiscoveredItem } from "./parser"
export { type NNFetchJob } from "./types"
