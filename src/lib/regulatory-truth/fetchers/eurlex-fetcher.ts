// src/lib/regulatory-truth/fetchers/eurlex-fetcher.ts
// Tier 1.5 Structured Fetcher: EUR-Lex EU Legislation
//
// ⚠️ DEPRECATION NOTICE (2025-12-29):
// This static CELEX list approach is being replaced with dynamic discovery
// via EUR-Lex RSS feeds. See:
// - src/lib/regulatory-truth/parsers/rss-parser.ts
// - EUR-Lex endpoints in seed-endpoints.ts
//
// The RSS approach provides:
// - Automatic discovery of new/updated regulations
// - Croatian language filtering (lang=HR)
// - Topic-based filtering (eurovoc codes)
// - No manual CELEX list maintenance
//
// This file remains for backward compatibility and one-off CELEX lookups.

import { db } from "@/lib/db"
import { hashContent } from "../utils/content-hash"
import { logAuditEvent } from "../utils/audit-log"
import { fetchWithRateLimit } from "../utils/rate-limiter"

const EURLEX_BASE = "https://eur-lex.europa.eu"

// Key EU legislation affecting Croatian fiscal rules
// CELEX format: 3YYYYLTTTNN where L=legislative type, T=type, N=number
export const KEY_EU_LEGISLATION = [
  {
    celex: "32006L0112",
    title: "VAT Directive (Council Directive 2006/112/EC)",
    domain: "vat",
    effectiveFrom: "2007-01-01",
  },
  {
    celex: "32010L0045",
    title: "VAT Invoicing Directive (Council Directive 2010/45/EU)",
    domain: "invoicing",
    effectiveFrom: "2013-01-01",
  },
  {
    celex: "32014R0910",
    title: "eIDAS Regulation",
    domain: "e-invoicing",
    effectiveFrom: "2016-07-01",
  },
  {
    celex: "32019L1023",
    title: "Restructuring and Insolvency Directive",
    domain: "insolvency",
    effectiveFrom: "2022-07-17",
  },
  {
    celex: "32014L0055",
    title: "Electronic Invoicing in Public Procurement Directive",
    domain: "e-invoicing",
    effectiveFrom: "2018-04-18",
  },
] as const

export interface EURLexMetadata {
  celex: string
  title: string
  domain: string
  effectiveFrom: string
  url: string
  pdfUrl: string
  htmlUrl: string
}

/**
 * Get EUR-Lex URLs for a CELEX identifier
 */
function getEURLexUrls(celex: string): { html: string; pdf: string; eli: string } {
  return {
    html: `${EURLEX_BASE}/legal-content/EN/TXT/HTML/?uri=CELEX:${celex}`,
    pdf: `${EURLEX_BASE}/legal-content/EN/TXT/PDF/?uri=CELEX:${celex}`,
    eli: `${EURLEX_BASE}/eli/celex/${celex}/oj`,
  }
}

/**
 * Fetch metadata for a known EU regulation
 */
export async function fetchEURLexMetadata(celex: string): Promise<EURLexMetadata | null> {
  const legislation = KEY_EU_LEGISLATION.find((l) => l.celex === celex)

  if (!legislation) {
    console.log(`[eurlex-fetcher] Unknown CELEX: ${celex}`)
    return null
  }

  const urls = getEURLexUrls(celex)

  // Verify the URL exists by checking response
  try {
    const response = await fetchWithRateLimit(urls.html)

    if (!response.ok) {
      console.log(`[eurlex-fetcher] HTTP ${response.status} for ${celex}`)
      return null
    }

    return {
      celex: legislation.celex,
      title: legislation.title,
      domain: legislation.domain,
      effectiveFrom: legislation.effectiveFrom,
      url: urls.eli,
      pdfUrl: urls.pdf,
      htmlUrl: urls.html,
    }
  } catch (error) {
    console.error(`[eurlex-fetcher] Error fetching ${celex}:`, error)
    return null
  }
}

/**
 * Create Evidence record from EUR-Lex metadata
 */
export async function createEURLexEvidence(metadata: EURLexMetadata): Promise<string | null> {
  // CRITICAL: Hash and store the SAME bytes (compact JSON)
  // See: docs/07_AUDITS/runs/evidence-immutability-INV-001.md finding F-1
  const rawContent = JSON.stringify(metadata)
  const contentHash = hashContent(rawContent)

  // Check if we already have this
  const existing = await db.evidence.findFirst({
    where: { contentHash },
  })

  if (existing) {
    console.log(`[eurlex-fetcher] Skipping ${metadata.celex} - already exists`)
    return existing.id
  }

  // Find or create EUR-Lex source
  let source = await db.regulatorySource.findFirst({
    where: { slug: "eur-lex" },
  })

  if (!source) {
    source = await db.regulatorySource.create({
      data: {
        slug: "eur-lex",
        name: "EUR-Lex (Official EU Law)",
        url: "https://eur-lex.europa.eu",
        hierarchy: 1, // EU law (highest hierarchy)
        isActive: true,
      },
    })
  }

  // Create Evidence record
  const evidence = await db.evidence.create({
    data: {
      sourceId: source.id,
      url: metadata.url,
      rawContent, // Store exact bytes that were hashed
      contentHash,
      contentType: "json",
      hasChanged: false,
    },
  })

  // Create SourcePointer
  await db.sourcePointer.create({
    data: {
      evidenceId: evidence.id,
      domain: metadata.domain,
      valueType: "text",
      extractedValue: metadata.celex,
      displayValue: `CELEX ${metadata.celex}: ${metadata.title.substring(0, 40)}...`,
      exactQuote: metadata.title,
      confidence: 1.0,
    },
  })

  // Log audit event
  await logAuditEvent({
    action: "EVIDENCE_FETCHED",
    entityType: "EVIDENCE",
    entityId: evidence.id,
    metadata: {
      source: "eurlex-fetcher",
      tier: 1.5,
      celex: metadata.celex,
      domain: metadata.domain,
      automatedCreation: true,
    },
  })

  console.log(`[eurlex-fetcher] Created evidence for ${metadata.celex}`)
  return evidence.id
}

/**
 * Fetch all known key EU legislation
 */
export async function fetchKeyEULegislation(): Promise<{
  total: number
  created: number
  errors: string[]
}> {
  const results = { total: KEY_EU_LEGISLATION.length, created: 0, errors: [] as string[] }

  for (const legislation of KEY_EU_LEGISLATION) {
    try {
      const metadata = await fetchEURLexMetadata(legislation.celex)

      if (metadata) {
        const evidenceId = await createEURLexEvidence(metadata)
        if (evidenceId) results.created++
      }

      // Rate limiting - 2 seconds between requests
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error) {
      results.errors.push(`${legislation.celex}: ${error}`)
    }
  }

  return results
}
