// src/lib/regulatory-truth/fetchers/hok-fetcher.ts
// Tier 1 Structured Fetcher: HOK (Hrvatska obrtnička komora - Croatian Chamber of Trades)
// Monitors regulations, membership fees, and guidance for paušalni obrt (flat-rate taxation)
// Critical for compliance calculations and trade regulations

import { db, dbReg } from "@/lib/db"
import { hashContent } from "../utils/content-hash"
import { logAuditEvent } from "../utils/audit-log"
import { fetchWithRateLimit } from "../utils/rate-limiter"

const HOK_BASE = "https://www.hok.hr"
const HOK_NEWS_ENDPOINT = `${HOK_BASE}/novosti`
const HOK_MEMBERSHIP_PAGE = `${HOK_BASE}/clanarina`
const HOK_REGULATIONS_PAGE = `${HOK_BASE}/gospodarstvo-i-savjetovanje/poslovne-knjige-i-obveze-obrtnika`

export interface HOKNewsItem {
  title: string
  url: string
  publishedDate: string
  excerpt?: string
}

export interface HOKFetchResult {
  success: boolean
  newsCount: number
  evidenceCreated: number
  error?: string
}

/**
 * Fetch latest news from HOK
 * This monitors for membership fee changes, trade regulations, and compliance guidance
 */
export async function fetchHOKNews(limit: number = 10): Promise<HOKNewsItem[]> {
  console.log(`[hok-fetcher] Fetching latest ${limit} news items`)

  try {
    const response = await fetchWithRateLimit(HOK_NEWS_ENDPOINT)

    if (!response.ok) {
      throw new Error(`HOK API error: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()

    // Parse HTML to extract news items
    // Pattern: Look for news article links
    const newsItems: HOKNewsItem[] = []

    // HOK uses a common pattern for news links
    const articleRegex = /<a[^>]+href="([^"]*novosti[^"]*)"[^>]*>([^<]+)<\/a>/gi
    const dateRegex = /(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})/

    let match
    let count = 0
    const seenUrls = new Set<string>()

    while ((match = articleRegex.exec(html)) !== null && count < limit) {
      let url = match[1]
      const title = match[2].trim()

      // Skip if we've already seen this URL
      if (seenUrls.has(url)) continue
      seenUrls.add(url)

      // Make URL absolute if it's relative
      if (url.startsWith("/")) {
        url = `${HOK_BASE}${url}`
      } else if (!url.startsWith("http")) {
        url = `${HOK_BASE}/${url}`
      }

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

    console.log(`[hok-fetcher] Retrieved ${newsItems.length} news items`)
    return newsItems
  } catch (error) {
    console.error(`[hok-fetcher] Error fetching news:`, error)
    return []
  }
}

/**
 * Fetch membership fee page content
 * This is the critical page for calculating HOK membership obligations
 */
export async function fetchMembershipPage(): Promise<string | null> {
  console.log(`[hok-fetcher] Fetching membership page`)

  try {
    const response = await fetchWithRateLimit(HOK_MEMBERSHIP_PAGE)

    if (!response.ok) {
      console.log(`[hok-fetcher] HTTP ${response.status} for membership page`)
      return null
    }

    const content = await response.text()
    console.log(`[hok-fetcher] Retrieved membership page (${content.length} bytes)`)
    return content
  } catch (error) {
    console.error(`[hok-fetcher] Error fetching membership page:`, error)
    return null
  }
}

/**
 * Fetch regulations page content
 * This page contains guidance for trade obligations and business record keeping
 */
export async function fetchRegulationsPage(): Promise<string | null> {
  console.log(`[hok-fetcher] Fetching regulations page`)

  try {
    const response = await fetchWithRateLimit(HOK_REGULATIONS_PAGE)

    if (!response.ok) {
      console.log(`[hok-fetcher] HTTP ${response.status} for regulations page`)
      return null
    }

    const content = await response.text()
    console.log(`[hok-fetcher] Retrieved regulations page (${content.length} bytes)`)
    return content
  } catch (error) {
    console.error(`[hok-fetcher] Error fetching regulations page:`, error)
    return null
  }
}

/**
 * Create Evidence record from HOK news item
 */
export async function createHOKEvidence(newsItem: HOKNewsItem): Promise<string | null> {
  // CRITICAL: Hash and store the SAME bytes (compact JSON)
  // See: docs/07_AUDITS/runs/evidence-immutability-INV-001.md finding F-1
  const rawContent = JSON.stringify(newsItem)
  const contentHash = hashContent(rawContent)

  // Check if we already have this exact data
  const existing = await dbReg.evidence.findFirst({
    where: { contentHash },
  })

  if (existing) {
    console.log(`[hok-fetcher] Skipping ${newsItem.url} - already exists`)
    return existing.id
  }

  // Find or create HOK source
  let source = await dbReg.regulatorySource.findFirst({
    where: { slug: "hok" },
  })

  if (!source) {
    source = await dbReg.regulatorySource.create({
      data: {
        slug: "hok",
        name: "Hrvatska obrtnička komora (HOK)",
        url: HOK_BASE,
        hierarchy: 7, // Chamber practice (lowest authority but important for compliance)
        isActive: true,
      },
    })
  }

  // Create Evidence record
  const evidence = await dbReg.evidence.create({
    data: {
      sourceId: source.id,
      url: newsItem.url,
      rawContent, // Store exact bytes that were hashed
      contentHash,
      contentType: "json",
      hasChanged: false,
    },
  })

  // SKIP: Trade regulations are not part of the core tax domains (pausalni, pdv, etc.)
  // This prevents domain leakage into the regulatory database
  // Trade regulation content should be handled separately if needed
  console.log(
    `[hok-fetcher] Skipping SourcePointer creation for trade-regulations - not in DomainSchema`
  )

  // Log audit event
  await logAuditEvent({
    action: "EVIDENCE_FETCHED",
    entityType: "EVIDENCE",
    entityId: evidence.id,
    metadata: {
      source: "hok-fetcher",
      tier: 1,
      url: newsItem.url,
      publishedDate: newsItem.publishedDate,
      automatedCreation: true,
    },
  })

  console.log(`[hok-fetcher] Created evidence for ${newsItem.title}`)
  return evidence.id
}

/**
 * Create Evidence record from membership page content
 */
export async function createMembershipEvidence(content: string): Promise<string | null> {
  // Hash the page content
  const contentHash = hashContent(content, "text/html")

  // Check if we already have this exact content
  const existing = await dbReg.evidence.findFirst({
    where: { contentHash },
  })

  if (existing) {
    console.log(`[hok-fetcher] Membership page unchanged`)
    return existing.id
  }

  // Find or create HOK membership source
  let source = await dbReg.regulatorySource.findFirst({
    where: { slug: "hok-clanarina" },
  })

  if (!source) {
    source = await dbReg.regulatorySource.create({
      data: {
        slug: "hok-clanarina",
        name: "HOK - Članarina obrtnika",
        url: HOK_MEMBERSHIP_PAGE,
        hierarchy: 7, // Chamber practice
        isActive: true,
      },
    })
  }

  // Create Evidence record
  const evidence = await dbReg.evidence.create({
    data: {
      sourceId: source.id,
      url: HOK_MEMBERSHIP_PAGE,
      rawContent: content,
      contentHash,
      contentType: "html",
      hasChanged: false,
    },
  })

  // SKIP: Membership fees are not part of the core tax domains (pausalni, pdv, etc.)
  // This prevents domain leakage into the regulatory database
  // Membership fee content should be handled separately if needed
  console.log(
    `[hok-fetcher] Skipping SourcePointer creation for membership-fees - not in DomainSchema`
  )

  // Log audit event
  await logAuditEvent({
    action: "EVIDENCE_FETCHED",
    entityType: "EVIDENCE",
    entityId: evidence.id,
    metadata: {
      source: "hok-fetcher",
      tier: 1,
      type: "membership-page",
      automatedCreation: true,
    },
  })

  console.log(`[hok-fetcher] Created evidence for membership page`)
  return evidence.id
}

/**
 * Create Evidence record from regulations page content
 */
export async function createRegulationsEvidence(content: string): Promise<string | null> {
  // Hash the page content
  const contentHash = hashContent(content, "text/html")

  // Check if we already have this exact content
  const existing = await dbReg.evidence.findFirst({
    where: { contentHash },
  })

  if (existing) {
    console.log(`[hok-fetcher] Regulations page unchanged`)
    return existing.id
  }

  // Find or create HOK regulations source
  let source = await dbReg.regulatorySource.findFirst({
    where: { slug: "hok-obveze" },
  })

  if (!source) {
    source = await dbReg.regulatorySource.create({
      data: {
        slug: "hok-obveze",
        name: "HOK - Poslovne knjige i obveze obrtnika",
        url: HOK_REGULATIONS_PAGE,
        hierarchy: 7, // Chamber practice
        isActive: true,
      },
    })
  }

  // Create Evidence record
  const evidence = await dbReg.evidence.create({
    data: {
      sourceId: source.id,
      url: HOK_REGULATIONS_PAGE,
      rawContent: content,
      contentHash,
      contentType: "html",
      hasChanged: false,
    },
  })

  // SKIP: Trade regulations are not part of the core tax domains (pausalni, pdv, etc.)
  // This prevents domain leakage into the regulatory database
  // Trade regulation content should be handled separately if needed
  console.log(
    `[hok-fetcher] Skipping SourcePointer creation for trade-regulations (page) - not in DomainSchema`
  )

  // Log audit event
  await logAuditEvent({
    action: "EVIDENCE_FETCHED",
    entityType: "EVIDENCE",
    entityId: evidence.id,
    metadata: {
      source: "hok-fetcher",
      tier: 1,
      type: "regulations-page",
      automatedCreation: true,
    },
  })

  console.log(`[hok-fetcher] Created evidence for regulations page`)
  return evidence.id
}

/**
 * Fetch and store HOK content
 * This is the main entry point for the HOK fetcher
 */
export async function fetchHOKContent(): Promise<HOKFetchResult> {
  try {
    let evidenceCreated = 0
    let newsCount = 0

    // 1. Fetch membership page (critical for fee calculations)
    const membershipPage = await fetchMembershipPage()
    if (membershipPage) {
      const evidenceId = await createMembershipEvidence(membershipPage)
      if (evidenceId) evidenceCreated++
    }

    // 2. Fetch regulations page (important for compliance guidance)
    const regulationsPage = await fetchRegulationsPage()
    if (regulationsPage) {
      const evidenceId = await createRegulationsEvidence(regulationsPage)
      if (evidenceId) evidenceCreated++
    }

    // 3. Fetch latest news items
    const newsItems = await fetchHOKNews(10)
    newsCount = newsItems.length

    for (const item of newsItems) {
      const evidenceId = await createHOKEvidence(item)
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
    console.error(`[hok-fetcher] Error: ${errorMsg}`)
    return {
      success: false,
      newsCount: 0,
      evidenceCreated: 0,
      error: errorMsg,
    }
  }
}

/**
 * Get HOK status
 */
export async function getHOKStatus(): Promise<{
  available: boolean
  lastNewsDate?: string
}> {
  try {
    const response = await fetch(HOK_NEWS_ENDPOINT, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return { available: false }
    }

    const newsItems = await fetchHOKNews(1)
    return {
      available: true,
      lastNewsDate: newsItems.length > 0 ? newsItems[0].publishedDate : undefined,
    }
  } catch {
    return { available: false }
  }
}
