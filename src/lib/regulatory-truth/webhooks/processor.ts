// src/lib/regulatory-truth/webhooks/processor.ts

import { db } from "@/lib/db"
import { hashContent } from "../utils/content-hash"
import { fetchWithRateLimit } from "../utils/rate-limiter"
import { extractQueue, ocrQueue } from "../workers/queues"
import { detectBinaryType, parseBinaryContent } from "../utils/binary-parser"
import { isScannedPdf } from "../utils/ocr-processor"
import { logAuditEvent } from "../utils/audit-log"

/**
 * Process a webhook event and create Evidence records
 *
 * Handles:
 * - RSS feed items
 * - Email notifications
 * - HTTP webhook payloads
 * - API responses
 */
export async function processWebhookEvent(eventId: string): Promise<void> {
  console.log(`[webhook-processor] Processing event: ${eventId}`)

  try {
    // Get webhook event
    const event = await db.webhookEvent.findUnique({
      where: { id: eventId },
      include: {
        subscription: {
          include: {
            source: true,
          },
        },
      },
    })

    if (!event) {
      throw new Error(`Webhook event not found: ${eventId}`)
    }

    if (event.status !== "PENDING") {
      console.log(`[webhook-processor] Event ${eventId} already processed (${event.status})`)
      return
    }

    // Mark as processing
    await db.webhookEvent.update({
      where: { id: eventId },
      data: { status: "PROCESSING" },
    })

    // Parse payload
    const payload = JSON.parse(event.rawPayload)

    // Extract URL to fetch based on event type
    const urlsToFetch = extractUrlsFromPayload(event.eventType, payload)

    if (urlsToFetch.length === 0) {
      console.warn(`[webhook-processor] No URLs found in event ${eventId}`)
      await db.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: "FILTERED",
          processedAt: new Date(),
          errorMessage: "No URLs to fetch",
        },
      })
      return
    }

    // Check filter patterns
    const filteredUrls = filterUrls(urlsToFetch, event.subscription.filterPatterns)

    if (filteredUrls.length === 0) {
      console.log(`[webhook-processor] All URLs filtered for event ${eventId}`)
      await db.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: "FILTERED",
          processedAt: new Date(),
        },
      })
      return
    }

    // Process each URL
    let evidenceCreated = 0
    let evidenceId: string | undefined

    for (const url of filteredUrls) {
      try {
        const evidence = await fetchAndCreateEvidence(
          url,
          event.subscription.source?.id || null,
          event.title || null
        )

        if (evidence) {
          evidenceCreated++
          evidenceId = evidence.id
        }
      } catch (error) {
        console.error(`[webhook-processor] Failed to fetch ${url}:`, error)
      }
    }

    // Update event status
    await db.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: evidenceCreated > 0 ? "COMPLETED" : "FAILED",
        processedAt: new Date(),
        evidenceId,
        errorMessage:
          evidenceCreated === 0 ? "Failed to create evidence from URLs" : undefined,
      },
    })

    // Update subscription stats
    if (evidenceCreated > 0) {
      await db.webhookSubscription.update({
        where: { id: event.subscriptionId },
        data: {
          lastSuccessAt: new Date(),
        },
      })
    }

    console.log(
      `[webhook-processor] Event ${eventId} completed: ${evidenceCreated} evidence created`
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[webhook-processor] Error processing event ${eventId}:`, errorMessage)

    // Update event status
    await db.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: "FAILED",
        processedAt: new Date(),
        errorMessage,
        retryCount: { increment: 1 },
      },
    })

    // Update subscription error count
    const event = await db.webhookEvent.findUnique({
      where: { id: eventId },
    })

    if (event) {
      await db.webhookSubscription.update({
        where: { id: event.subscriptionId },
        data: {
          errorCount: { increment: 1 },
          lastError: errorMessage,
        },
      })
    }

    throw error
  }
}

/**
 * Extract URLs from webhook payload based on event type
 */
function extractUrlsFromPayload(eventType: string, payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) {
    return []
  }

  const obj = payload as Record<string, unknown>
  const urls: string[] = []

  // RSS feed items
  if (eventType === "RSS_ITEM") {
    if (Array.isArray(obj.items)) {
      for (const item of obj.items) {
        if (typeof item === "object" && item !== null) {
          const itemObj = item as Record<string, unknown>
          if (typeof itemObj.link === "string") {
            urls.push(itemObj.link)
          }
        }
      }
    }
    if (typeof obj.link === "string") {
      urls.push(obj.link)
    }
  }

  // Email notification
  if (eventType === "EMAIL_NOTIFICATION") {
    const body = String(obj.body || obj.html || obj.text || "")
    const urlRegex = /(https?:\/\/[^\s<>"]+)/g
    const matches = body.match(urlRegex)
    if (matches) {
      urls.push(...matches)
    }
  }

  // HTTP POST webhook
  if (eventType === "HTTP_POST") {
    if (typeof obj.url === "string") {
      urls.push(obj.url)
    }
    if (Array.isArray(obj.urls)) {
      urls.push(...obj.urls.filter((u): u is string => typeof u === "string"))
    }
  }

  return urls
}

/**
 * Filter URLs based on filter patterns
 */
function filterUrls(urls: string[], patterns: string[]): string[] {
  if (patterns.length === 0) {
    return urls
  }

  return urls.filter((url) => {
    return patterns.some((pattern) => {
      try {
        const regex = new RegExp(pattern)
        return regex.test(url)
      } catch {
        // If pattern is not a valid regex, do exact match
        return url.includes(pattern)
      }
    })
  })
}

/**
 * Fetch content and create Evidence record
 */
async function fetchAndCreateEvidence(
  url: string,
  sourceId: string | null,
  title: string | null
): Promise<{ id: string } | null> {
  console.log(`[webhook-processor] Fetching: ${url}`)

  // Check if we already have this URL
  const existingEvidence = await db.evidence.findFirst({
    where: { url },
    orderBy: { fetchedAt: "desc" },
  })

  try {
    const response = await fetchWithRateLimit(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    // Handle binary files (PDF, DOCX, etc.)
    const contentTypeHeader = response.headers.get("content-type") || ""
    const binaryType = detectBinaryType(url, contentTypeHeader)

    let content: string
    let contentType: string = "html"
    let contentClass: string = "HTML"

    if (binaryType === "pdf") {
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const parsed = await parseBinaryContent(buffer, binaryType)

      const pageCount = (parsed.metadata?.pages as number) || 1
      const isScanned = isScannedPdf(parsed.text, pageCount)

      content = buffer.toString("base64")
      contentType = "pdf"
      contentClass = isScanned ? "PDF_SCANNED" : "PDF_TEXT"

      console.log(
        `[webhook-processor] PDF detected: ${contentClass} (${pageCount} pages, ${parsed.text.length} chars)`
      )
    } else if (binaryType !== "unknown") {
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const parsed = await parseBinaryContent(buffer, binaryType)

      content = parsed.text
      contentType = binaryType
      contentClass = binaryType.toUpperCase()
    } else {
      content = await response.text()
    }

    const contentHash = hashContent(content)

    // Check if content changed
    if (existingEvidence && existingEvidence.contentHash === contentHash) {
      console.log(`[webhook-processor] Content unchanged for ${url}`)
      return existingEvidence
    }

    // Find or create source
    if (!sourceId) {
      const domain = new URL(url).hostname
      const source = await db.regulatorySource.findFirst({
        where: {
          url: { contains: domain },
        },
      })

      if (source) {
        sourceId = source.id
      } else {
        // Auto-create source
        const newSource = await db.regulatorySource.create({
          data: {
            slug: domain.replace(/\./g, "-").toLowerCase(),
            name: `Auto: ${domain}`,
            url: `https://${domain}`,
            hierarchy: 5,
            isActive: true,
          },
        })
        sourceId = newSource.id
      }
    }

    if (!sourceId) {
      throw new Error("Could not determine source for URL")
    }

    // Create evidence
    const evidence = await db.evidence.create({
      data: {
        sourceId,
        url,
        rawContent: content,
        contentHash,
        contentType,
        contentClass,
        hasChanged: !!existingEvidence,
        changeSummary: existingEvidence
          ? `Content updated via webhook (previous hash: ${existingEvidence.contentHash.slice(0, 8)}...)`
          : null,
      },
    })

    // Create artifact for PDF_TEXT
    if (contentClass === "PDF_TEXT" && binaryType === "pdf") {
      const buffer = Buffer.from(content, "base64")
      const parsed = await parseBinaryContent(buffer, binaryType)

      const artifact = await db.evidenceArtifact.create({
        data: {
          evidenceId: evidence.id,
          kind: "PDF_TEXT",
          content: parsed.text,
          contentHash: hashContent(parsed.text),
        },
      })

      await db.evidence.update({
        where: { id: evidence.id },
        data: { primaryTextArtifactId: artifact.id },
      })

      // Queue for extraction
      await extractQueue.add("extract", {
        evidenceId: evidence.id,
        runId: `webhook-${Date.now()}`,
      })
      console.log(`[webhook-processor] Queued ${evidence.id} for extraction`)
    } else if (contentClass === "PDF_SCANNED") {
      // Queue for OCR
      await ocrQueue.add("ocr", {
        evidenceId: evidence.id,
        runId: `webhook-${Date.now()}`,
      })
      console.log(`[webhook-processor] Queued ${evidence.id} for OCR`)
    } else {
      // Queue for extraction (HTML, etc.)
      await extractQueue.add("extract", {
        evidenceId: evidence.id,
        runId: `webhook-${Date.now()}`,
      })
      console.log(`[webhook-processor] Queued ${evidence.id} for extraction`)
    }

    // Log audit event
    await logAuditEvent({
      action: "EVIDENCE_CREATED_VIA_WEBHOOK",
      entityType: "EVIDENCE",
      entityId: evidence.id,
      metadata: {
        sourceId,
        url,
        contentHash,
        contentClass,
        triggeredBy: "webhook",
      },
    })

    return evidence
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[webhook-processor] Error fetching ${url}:`, errorMessage)
    throw error
  }
}
