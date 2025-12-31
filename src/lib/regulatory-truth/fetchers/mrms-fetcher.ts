// src/lib/regulatory-truth/fetchers/mrms-fetcher.ts
// Tier 1 Structured Fetcher: MRMS (Ministry of Labor and Pension System)
// Monitors minimum wage announcements and labor law changes
// Critical for contribution calculations and compliance

import { db } from "@/lib/db"
import { hashContent } from "../utils/content-hash"
import { logAuditEvent } from "../utils/audit-log"
import { fetchWithRateLimit } from "../utils/rate-limiter"

const MRMS_BASE = "https://mrosp.gov.hr"
const MRMS_NEWS_ENDPOINT = `${MRMS_BASE}/vijesti/8`
const MRMS_MINIMUM_WAGE_PAGE = "https://www.mrms.hr/minimalna-placa/"

export interface MRMSNewsItem {
  title: string
  url: string
  publishedDate: string
  excerpt?: string
}

export interface MRMSFetchResult {
  success: boolean
  newsCount: number
  evidenceCreated: number
  error?: string
}

/**
 * Fetch latest news from MRMS
 * This monitors for minimum wage announcements and labor law changes
 */
export async function fetchMRMSNews(limit: number = 10): Promise<MRMSNewsItem[]> {
  console.log(`[mrms-fetcher] Fetching latest ${limit} news items`)

  try {
    const response = await fetchWithRateLimit(MRMS_NEWS_ENDPOINT)

    if (!response.ok) {
      throw new Error(`MRMS API error: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()

    // Parse HTML to extract news items
    // Pattern: Look for news article links
    const newsItems: MRMSNewsItem[] = []
    const articleRegex = /<a[^>]+href="\/vijesti\/([^"]+)\/(\d+)"[^>]*>([^<]+)<\/a>/g
    const dateRegex = /(\d{1,2}\.\s*\w+\s*\d{4})/

    let match
    let count = 0
    while ((match = articleRegex.exec(html)) !== null && count < limit) {
      const slug = match[1]
      const id = match[2]
      const title = match[3].trim()
      const url = `${MRMS_BASE}/vijesti/${slug}/${id}`

      // Try to extract date from surrounding context
      const contextStart = Math.max(0, match.index - 200)
      const contextEnd = Math.min(html.length, match.index + 200)
      const context = html.substring(contextStart, contextEnd)
      const dateMatch = context.match(dateRegex)
      const publishedDate = dateMatch ? dateMatch[1] : new Date().toISOString().split("T")[0]

      newsItems.push({
        title,
        url,
        publishedDate,
      })

      count++
    }

    console.log(`[mrms-fetcher] Retrieved ${newsItems.length} news items`)
    return newsItems
  } catch (error) {
    console.error(`[mrms-fetcher] Error fetching news:`, error)
    return []
  }
}

/**
 * Fetch minimum wage page content
 * This is the critical page for contribution calculations
 */
export async function fetchMinimumWagePage(): Promise<string | null> {
  console.log(`[mrms-fetcher] Fetching minimum wage page`)

  try {
    const response = await fetchWithRateLimit(MRMS_MINIMUM_WAGE_PAGE)

    if (!response.ok) {
      console.log(`[mrms-fetcher] HTTP ${response.status} for minimum wage page`)
      return null
    }

    const content = await response.text()
    console.log(`[mrms-fetcher] Retrieved minimum wage page (${content.length} bytes)`)
    return content
  } catch (error) {
    console.error(`[mrms-fetcher] Error fetching minimum wage page:`, error)
    return null
  }
}

/**
 * Create Evidence record from MRMS news item
 */
export async function createMRMSEvidence(newsItem: MRMSNewsItem): Promise<string | null> {
  // CRITICAL: Hash and store the SAME bytes (compact JSON)
  // See: docs/07_AUDITS/runs/evidence-immutability-INV-001.md finding F-1
  const rawContent = JSON.stringify(newsItem)
  const contentHash = hashContent(rawContent)

  // Check if we already have this exact data
  const existing = await db.evidence.findFirst({
    where: { contentHash },
  })

  if (existing) {
    console.log(`[mrms-fetcher] Skipping ${newsItem.url} - already exists`)
    return existing.id
  }

  // Find or create MRMS source
  let source = await db.regulatorySource.findFirst({
    where: { slug: "mrms" },
  })

  if (!source) {
    source = await db.regulatorySource.create({
      data: {
        slug: "mrms",
        name: "Ministarstvo rada, mirovinskog sustava, obitelji i socijalne politike",
        url: MRMS_BASE,
        hierarchy: 4, // Pravilnik (ministerial regulations)
        isActive: true,
      },
    })
  }

  // Create Evidence record
  const evidence = await db.evidence.create({
    data: {
      sourceId: source.id,
      url: newsItem.url,
      rawContent, // Store exact bytes that were hashed
      contentHash,
      contentType: "json",
      hasChanged: false,
    },
  })

  // SKIP: Labor law is not part of the core tax domains (pausalni, pdv, etc.)
  // This prevents domain leakage into the regulatory database
  // Labor law content should be handled separately if needed
  console.log(`[mrms-fetcher] Skipping SourcePointer creation for labor-law - not in DomainSchema`)

  // Log audit event
  await logAuditEvent({
    action: "EVIDENCE_FETCHED",
    entityType: "EVIDENCE",
    entityId: evidence.id,
    metadata: {
      source: "mrms-fetcher",
      tier: 1,
      url: newsItem.url,
      publishedDate: newsItem.publishedDate,
      automatedCreation: true,
    },
  })

  console.log(`[mrms-fetcher] Created evidence for ${newsItem.title}`)
  return evidence.id
}

/**
 * Create Evidence record from minimum wage page content
 */
export async function createMinimumWageEvidence(content: string): Promise<string | null> {
  // Hash the page content
  const contentHash = hashContent(content, "text/html")

  // Check if we already have this exact content
  const existing = await db.evidence.findFirst({
    where: { contentHash },
  })

  if (existing) {
    console.log(`[mrms-fetcher] Minimum wage page unchanged`)
    return existing.id
  }

  // Find or create MRMS source
  let source = await db.regulatorySource.findFirst({
    where: { slug: "mrms-minimalna-placa" },
  })

  if (!source) {
    source = await db.regulatorySource.create({
      data: {
        slug: "mrms-minimalna-placa",
        name: "MRMS - Minimalna plaća",
        url: MRMS_MINIMUM_WAGE_PAGE,
        hierarchy: 4, // Pravilnik
        isActive: true,
      },
    })
  }

  // Create Evidence record
  const evidence = await db.evidence.create({
    data: {
      sourceId: source.id,
      url: MRMS_MINIMUM_WAGE_PAGE,
      rawContent: content,
      contentHash,
      contentType: "html",
      hasChanged: false,
    },
  })

  // SKIP: Minimum wage is not part of the core tax domains (pausalni, pdv, etc.)
  // This prevents domain leakage into the regulatory database
  // Minimum wage content should be handled separately if needed
  console.log(
    `[mrms-fetcher] Skipping SourcePointer creation for minimum-wage - not in DomainSchema`
  )

  // Log audit event
  await logAuditEvent({
    action: "EVIDENCE_FETCHED",
    entityType: "EVIDENCE",
    entityId: evidence.id,
    metadata: {
      source: "mrms-fetcher",
      tier: 1,
      type: "minimum-wage-page",
      automatedCreation: true,
    },
  })

  console.log(`[mrms-fetcher] Created evidence for minimum wage page`)
  return evidence.id
}

/**
 * Fetch and store MRMS content
 * This is the main entry point for the MRMS fetcher
 */
export async function fetchMRMSContent(): Promise<MRMSFetchResult> {
  try {
    let evidenceCreated = 0
    let newsCount = 0

    // 1. Fetch minimum wage page (critical for contribution calculations)
    const minimumWagePage = await fetchMinimumWagePage()
    if (minimumWagePage) {
      const evidenceId = await createMinimumWageEvidence(minimumWagePage)
      if (evidenceId) evidenceCreated++
    }

    // 2. Fetch latest news items
    const newsItems = await fetchMRMSNews(10)
    newsCount = newsItems.length

    for (const item of newsItems) {
      const evidenceId = await createMRMSEvidence(item)
      if (evidenceId) evidenceCreated++

      // Rate limiting - 500ms between requests
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return {
      success: true,
      newsCount,
      evidenceCreated,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[mrms-fetcher] Error: ${errorMsg}`)
    return {
      success: false,
      newsCount: 0,
      evidenceCreated: 0,
      error: errorMsg,
    }
  }
}

/**
 * Get MRMS status
 */
export async function getMRMSStatus(): Promise<{
  available: boolean
  lastNewsDate?: string
}> {
  try {
    const response = await fetch(MRMS_NEWS_ENDPOINT, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return { available: false }
    }

    const newsItems = await fetchMRMSNews(1)
    return {
      available: true,
      lastNewsDate: newsItems.length > 0 ? newsItems[0].publishedDate : undefined,
    }
  } catch {
    return { available: false }
  }
}
