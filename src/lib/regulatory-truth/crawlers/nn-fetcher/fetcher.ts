// src/lib/regulatory-truth/crawlers/nn-fetcher/fetcher.ts
/**
 * NN Fetcher - Fetch NN item pages, store Evidence, link to Instrument, enqueue parse
 *
 * Consumes NNFetchJob from sentinel, fetches item HTML (and optional PDF),
 * stores immutable Evidence snapshots, and enqueues parse jobs.
 *
 * Key invariants:
 * - Stateless: no diff, no consolidation
 * - Idempotent via content hash: skip if content unchanged
 * - Links to Instrument when ELI or nnCanonicalKey available
 * - Strict timeouts + retry with exponential backoff + jitter
 */

import crypto from "crypto"
import { dbReg } from "@/lib/db"
import {
  resolveOrCreateInstrument,
  generateNNCanonicalKey,
} from "@/lib/regulatory-truth/utils/instrument-resolver"
import type {
  NNFetchJob,
  NNFetcherPolicy,
  NNFetcherResult,
  NNFetcherDependencies,
  NNFetchEventType,
  ParseJob,
  ExtractedEli,
  FetchPageResult,
  PdfFetchResult,
} from "./types"
import { DEFAULT_FETCHER_POLICY } from "./types"

// =============================================================================
// Constants
// =============================================================================

const NN_SLUZBENI_SOURCE_ID = "nn-sluzbeni" // Well-known source ID for NN

// =============================================================================
// Content Hash
// =============================================================================

function computeContentHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex")
}

// =============================================================================
// ELI Extraction from HTML
// =============================================================================

/**
 * Extract ELI URI from NN HTML page if present.
 * NN pages may include ELI in meta tags or structured data.
 */
export function extractEliFromHtml(html: string): ExtractedEli | null {
  // Look for ELI in meta tags
  // Pattern: <meta name="eli" content="eli/hr/zakon/..." />
  const metaMatch = html.match(/<meta\s+name=["']eli["']\s+content=["']([^"']+)["']/i)
  if (metaMatch) {
    return { eliUri: metaMatch[1] }
  }

  // Look for ELI in link tags
  // Pattern: <link rel="eli" href="eli/hr/zakon/..." />
  const linkMatch = html.match(/<link\s+rel=["']eli["']\s+href=["']([^"']+)["']/i)
  if (linkMatch) {
    return { eliUri: linkMatch[1] }
  }

  // Look for ELI in JSON-LD
  // Pattern: "@id": "eli/hr/zakon/..."
  const jsonLdMatch = html.match(/"@id"\s*:\s*"(eli\/[^"]+)"/i)
  if (jsonLdMatch) {
    return { eliUri: jsonLdMatch[1] }
  }

  return null
}

/**
 * Extract title from NN HTML page.
 */
export function extractTitleFromHtml(html: string): string | null {
  // Look for title in h1 or title tag
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match) {
    return h1Match[1].trim()
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
  if (titleMatch) {
    // Remove "Narodne novine" suffix if present
    return titleMatch[1].replace(/\s*-?\s*Narodne novine.*$/i, "").trim()
  }

  return null
}

/**
 * Extract PDF link from NN HTML page if present.
 */
export function extractPdfLinkFromHtml(html: string, baseUrl: string): string | null {
  // Look for PDF download link
  // Pattern: <a href="/clanci/sluzbeni/2024_12_152_2505.pdf" ...>
  const pdfMatch = html.match(/<a[^>]+href=["']([^"']+\.pdf)["'][^>]*>/i)
  if (pdfMatch) {
    const pdfPath = pdfMatch[1]
    // Resolve relative URLs
    if (pdfPath.startsWith("http")) {
      return pdfPath
    }
    const url = new URL(baseUrl)
    if (pdfPath.startsWith("/")) {
      return `${url.protocol}//${url.host}${pdfPath}`
    }
    return `${url.protocol}//${url.host}${url.pathname.replace(/[^/]+$/, "")}${pdfPath}`
  }
  return null
}

// =============================================================================
// Audit Logging
// =============================================================================

interface AuditLogParams {
  runId: string
  jobKey: string
  eventType: NNFetchEventType
  decision: "STARTED" | "SUCCESS" | "SKIPPED" | "RETRY" | "FAILED"
  url?: string
  statusCode?: number
  contentHash?: string
  durationMs?: number
  retryCount?: number
  evidenceId?: string
  instrumentId?: string
  pdfUrl?: string
  pdfEvidenceId?: string
  error?: string
}

async function logAuditEvent(params: AuditLogParams): Promise<void> {
  await dbReg.nNFetchAuditEvent.create({
    data: {
      runId: params.runId,
      jobKey: params.jobKey,
      eventType: params.eventType,
      decision: params.decision,
      url: params.url,
      statusCode: params.statusCode,
      contentHash: params.contentHash,
      durationMs: params.durationMs,
      retryCount: params.retryCount,
      evidenceId: params.evidenceId,
      instrumentId: params.instrumentId,
      pdfUrl: params.pdfUrl,
      pdfEvidenceId: params.pdfEvidenceId,
      error: params.error,
    },
  })
}

// =============================================================================
// Evidence Storage
// =============================================================================

interface StoreEvidenceParams {
  url: string
  content: string
  contentType: string
  contentClass: string
  instrumentId?: string | null
}

interface StoreEvidenceResult {
  evidenceId: string
  contentHash: string
  wasCreated: boolean
}

/**
 * Store evidence with content hash idempotency.
 * If same URL+hash already exists, returns existing evidence without creating duplicate.
 */
async function storeEvidence(params: StoreEvidenceParams): Promise<StoreEvidenceResult> {
  const { url, content, contentType, contentClass, instrumentId } = params
  const contentHash = computeContentHash(content)

  // Check if evidence with same URL+hash already exists
  const existing = await dbReg.evidence.findFirst({
    where: {
      url,
      contentHash,
    },
    select: { id: true, contentHash: true },
  })

  if (existing) {
    return {
      evidenceId: existing.id,
      contentHash: existing.contentHash,
      wasCreated: false,
    }
  }

  // Create new evidence
  const evidence = await dbReg.evidence.create({
    data: {
      sourceId: NN_SLUZBENI_SOURCE_ID,
      url,
      contentHash,
      rawContent: content,
      contentType,
      contentClass,
      instrumentId,
      stalenessStatus: "FRESH",
    },
  })

  return {
    evidenceId: evidence.id,
    contentHash: evidence.contentHash,
    wasCreated: true,
  }
}

// =============================================================================
// Instrument Linking
// =============================================================================

interface LinkInstrumentParams {
  eliUri?: string | null
  nnCanonicalKey: string
  title?: string | null
  textType?: "CONSOLIDATED" | "AMENDMENT" | "UNKNOWN"
}

interface LinkInstrumentResult {
  instrumentId: string
  wasCreated: boolean
  wasMerged: boolean
}

async function linkOrCreateInstrument(params: LinkInstrumentParams): Promise<LinkInstrumentResult> {
  const { eliUri, nnCanonicalKey, title, textType } = params

  const result = await resolveOrCreateInstrument({
    eliUri: eliUri || null,
    nnCanonicalKey,
    title: title || undefined,
    textType: textType || "UNKNOWN",
  })

  return {
    instrumentId: result.id,
    wasCreated: result.wasCreated,
    wasMerged: result.wasMerged,
  }
}

// =============================================================================
// PDF Fetching
// =============================================================================

async function fetchAndStorePdf(
  pdfUrl: string,
  htmlEvidenceId: string,
  instrumentId: string | null | undefined,
  pageFetcher: NNFetcherDependencies["pageFetcher"],
  runId: string,
  jobKey: string
): Promise<PdfFetchResult> {
  const startTime = Date.now()

  try {
    const result = await pageFetcher.fetchPage(pdfUrl)
    const durationMs = Date.now() - startTime

    if (!result.ok || !result.content) {
      await logAuditEvent({
        runId,
        jobKey,
        eventType: "FETCH_PDF_FAILED",
        decision: "FAILED",
        url: pdfUrl,
        statusCode: result.statusCode,
        durationMs,
        error: result.error || `HTTP ${result.statusCode}`,
      })
      return {
        decision: "FETCH_FAILED",
        pdfUrl,
        error: result.error || `HTTP ${result.statusCode}`,
      }
    }

    // Store PDF evidence
    const stored = await storeEvidence({
      url: pdfUrl,
      content: result.content,
      contentType: "application/pdf",
      contentClass: "PDF_TEXT", // Will be reclassified by OCR worker if needed
      instrumentId,
    })

    await logAuditEvent({
      runId,
      jobKey,
      eventType: "FETCH_PDF_STORED",
      decision: stored.wasCreated ? "SUCCESS" : "SKIPPED",
      url: pdfUrl,
      statusCode: result.statusCode,
      contentHash: stored.contentHash,
      durationMs,
      evidenceId: stored.evidenceId,
      pdfEvidenceId: stored.evidenceId,
    })

    return {
      decision: stored.wasCreated ? "FETCH_PDF_STORED" : "FETCH_SKIPPED_UNCHANGED",
      evidenceId: stored.evidenceId,
      contentHash: stored.contentHash,
      pdfUrl,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    await logAuditEvent({
      runId,
      jobKey,
      eventType: "FETCH_PDF_FAILED",
      decision: "FAILED",
      url: pdfUrl,
      durationMs,
      error: errorMessage,
    })

    return {
      decision: "FETCH_FAILED",
      pdfUrl,
      error: errorMessage,
    }
  }
}

// =============================================================================
// Retry Logic with Exponential Backoff
// =============================================================================

function calculateBackoff(attempt: number, policy: NNFetcherPolicy): number {
  // Exponential backoff with jitter
  const exponentialDelay = policy.initialBackoffMs * Math.pow(2, attempt)
  const cappedDelay = Math.min(exponentialDelay, policy.maxBackoffMs)
  // Add jitter (0-25% of delay)
  const jitter = Math.random() * cappedDelay * 0.25
  return Math.floor(cappedDelay + jitter)
}

function shouldRetry(statusCode: number): boolean {
  // Retry on 429 (rate limit), 503 (service unavailable), 500 (server error)
  return statusCode === 429 || statusCode === 503 || statusCode >= 500
}

// =============================================================================
// Main Fetcher
// =============================================================================

export async function processNNFetchJob(
  job: NNFetchJob,
  deps: NNFetcherDependencies,
  policy: NNFetcherPolicy = DEFAULT_FETCHER_POLICY
): Promise<NNFetcherResult> {
  const { jobKey, runId, source, nn, hints } = job
  const url = source.url

  // Log fetch started
  await logAuditEvent({
    runId,
    jobKey,
    eventType: "FETCH_STARTED",
    decision: "STARTED",
    url,
  })

  let lastError: string | undefined
  let lastStatusCode: number | undefined

  // Retry loop
  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    const startTime = Date.now()

    try {
      const result = await deps.pageFetcher.fetchPage(url)
      const durationMs = Date.now() - startTime
      lastStatusCode = result.statusCode

      // Check if we need to retry
      if (!result.ok) {
        if (shouldRetry(result.statusCode) && attempt < policy.maxRetries) {
          const backoffMs = calculateBackoff(attempt, policy)
          await logAuditEvent({
            runId,
            jobKey,
            eventType: "FETCH_RETRY",
            decision: "RETRY",
            url,
            statusCode: result.statusCode,
            durationMs,
            retryCount: attempt + 1,
            error: result.error || `HTTP ${result.statusCode}`,
          })
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
          continue
        }

        // All retries exhausted or non-retryable error
        await logAuditEvent({
          runId,
          jobKey,
          eventType: "FETCH_FAILED",
          decision: "FAILED",
          url,
          statusCode: result.statusCode,
          durationMs,
          retryCount: attempt,
          error: result.error || `HTTP ${result.statusCode}`,
        })

        return {
          success: false,
          jobKey,
          parseJobEnqueued: false,
          error: result.error || `HTTP ${result.statusCode}`,
        }
      }

      // Success - process the content
      const htmlContent = result.content!
      const contentHash = computeContentHash(htmlContent)

      // Check if this exact content already exists for this URL
      const existingEvidence = await dbReg.evidence.findFirst({
        where: { url, contentHash },
        select: { id: true, contentHash: true, instrumentId: true },
      })

      if (existingEvidence) {
        // Content unchanged - skip
        await logAuditEvent({
          runId,
          jobKey,
          eventType: "FETCH_SKIPPED_UNCHANGED",
          decision: "SKIPPED",
          url,
          statusCode: result.statusCode,
          contentHash,
          durationMs,
          evidenceId: existingEvidence.id,
          instrumentId: existingEvidence.instrumentId || undefined,
        })

        return {
          success: true,
          jobKey,
          htmlEvidence: {
            id: existingEvidence.id,
            contentHash: existingEvidence.contentHash,
            wasCreated: false,
            instrumentId: existingEvidence.instrumentId,
          },
          parseJobEnqueued: false, // Don't re-parse unchanged content
        }
      }

      // Extract ELI and title from HTML
      const extractedEli = extractEliFromHtml(htmlContent)
      const extractedTitle = extractTitleFromHtml(htmlContent) || hints?.title

      // Generate NN canonical key
      const nnCanonicalKey = generateNNCanonicalKey(nn.year, nn.issue, nn.item)

      // Link or create instrument
      const instrumentResult = await linkOrCreateInstrument({
        eliUri: extractedEli?.eliUri || hints?.eli,
        nnCanonicalKey,
        title: extractedTitle,
        textType: hints?.textType,
      })

      // Log instrument linking
      await logAuditEvent({
        runId,
        jobKey,
        eventType: instrumentResult.wasCreated ? "INSTRUMENT_CREATED" : "INSTRUMENT_LINKED",
        decision: "SUCCESS",
        url,
        instrumentId: instrumentResult.instrumentId,
      })

      // Store HTML evidence
      const storedEvidence = await storeEvidence({
        url,
        content: htmlContent,
        contentType: result.contentType || "text/html",
        contentClass: "HTML",
        instrumentId: instrumentResult.instrumentId,
      })

      // Log success
      await logAuditEvent({
        runId,
        jobKey,
        eventType: "FETCH_SUCCESS",
        decision: "SUCCESS",
        url,
        statusCode: result.statusCode,
        contentHash: storedEvidence.contentHash,
        durationMs,
        evidenceId: storedEvidence.evidenceId,
        instrumentId: instrumentResult.instrumentId,
      })

      // Optionally fetch PDF
      let pdfEvidence: NNFetcherResult["pdfEvidence"] | undefined
      if (policy.fetchPdfs) {
        const pdfUrl = extractPdfLinkFromHtml(htmlContent, url)
        if (pdfUrl) {
          const pdfResult = await fetchAndStorePdf(
            pdfUrl,
            storedEvidence.evidenceId,
            instrumentResult.instrumentId,
            deps.pageFetcher,
            runId,
            jobKey
          )
          if (pdfResult.evidenceId) {
            pdfEvidence = {
              id: pdfResult.evidenceId,
              contentHash: pdfResult.contentHash!,
              wasCreated: pdfResult.decision === "FETCH_PDF_STORED",
              pdfUrl: pdfResult.pdfUrl!,
            }
          }
        }
      }

      // Enqueue parse job (only for new evidence)
      if (storedEvidence.wasCreated) {
        const parseJob: ParseJob = {
          evidenceId: storedEvidence.evidenceId,
          parserVersion: policy.parserVersion,
          jobKey,
          source: {
            sourceType: "NN_SLUZBENI",
            url,
          },
          nn: {
            year: nn.year,
            issue: nn.issue,
            item: nn.item,
          },
          hints: {
            instrumentId: instrumentResult.instrumentId,
            eliUri: extractedEli?.eliUri || hints?.eli || undefined,
            title: extractedTitle || undefined,
          },
        }

        await deps.enqueueParseJob(parseJob)

        await logAuditEvent({
          runId,
          jobKey,
          eventType: "PARSE_ENQUEUED",
          decision: "SUCCESS",
          url,
          evidenceId: storedEvidence.evidenceId,
        })
      }

      return {
        success: true,
        jobKey,
        htmlEvidence: {
          id: storedEvidence.evidenceId,
          contentHash: storedEvidence.contentHash,
          wasCreated: storedEvidence.wasCreated,
          instrumentId: instrumentResult.instrumentId,
        },
        pdfEvidence,
        parseJobEnqueued: storedEvidence.wasCreated,
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      lastError = error instanceof Error ? error.message : String(error)

      if (attempt < policy.maxRetries) {
        const backoffMs = calculateBackoff(attempt, policy)
        await logAuditEvent({
          runId,
          jobKey,
          eventType: "FETCH_RETRY",
          decision: "RETRY",
          url,
          durationMs,
          retryCount: attempt + 1,
          error: lastError,
        })
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
        continue
      }
    }
  }

  // All retries exhausted
  await logAuditEvent({
    runId,
    jobKey,
    eventType: "FETCH_FAILED",
    decision: "FAILED",
    url,
    statusCode: lastStatusCode,
    retryCount: policy.maxRetries,
    error: lastError,
  })

  return {
    success: false,
    jobKey,
    parseJobEnqueued: false,
    error: lastError,
  }
}
