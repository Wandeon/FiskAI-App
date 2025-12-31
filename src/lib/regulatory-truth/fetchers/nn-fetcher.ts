// src/lib/regulatory-truth/fetchers/nn-fetcher.ts
// Tier 1 Structured Fetcher: Narodne novine (Official Gazette) ELI/JSON-LD
// API: https://narodne-novine.nn.hr/article_metadata.aspx?format=json-ld
// 100% reliable structured metadata - bypasses AI for metadata extraction

import { db } from "@/lib/db"
import { hashContent } from "../utils/content-hash"
import { logAuditEvent } from "../utils/audit-log"
import { fetchWithRateLimit } from "../utils/rate-limiter"
import { parseNNUrl, normalizeNNUrl, getNNMetadataUrl } from "../utils/nn-url-converter"

const NN_METADATA_BASE = "https://narodne-novine.nn.hr/article_metadata.aspx"
const NN_ELI_BASE = "https://narodne-novine.nn.hr/eli"
const NN_SITEMAP_BASE = "https://narodne-novine.nn.hr"

// ELI Ontology predicates
const ELI = {
  TYPE_DOCUMENT: "http://data.europa.eu/eli/ontology#type_document",
  NUMBER: "http://data.europa.eu/eli/ontology#number",
  DATE_DOCUMENT: "http://data.europa.eu/eli/ontology#date_document",
  DATE_PUBLICATION: "http://data.europa.eu/eli/ontology#date_publication",
  PASSED_BY: "http://data.europa.eu/eli/ontology#passed_by",
  TITLE: "http://data.europa.eu/eli/ontology#title",
  IS_ABOUT: "http://data.europa.eu/eli/ontology#is_about",
  BASED_ON: "http://data.europa.eu/eli/ontology#based_on",
  FORMAT: "http://data.europa.eu/eli/ontology#format",
  LEGAL_RESOURCE: "http://data.europa.eu/eli/ontology#LegalResource",
  LEGAL_EXPRESSION: "http://data.europa.eu/eli/ontology#LegalExpression",
}

export interface NNArticleMetadata {
  eli: string
  type: string // ZAKON, UREDBA, PRAVILNIK, etc.
  number: string
  dateDocument: string
  datePublication: string
  title: string
  passedBy: string
  basedOn: string[]
  legalAreas: string[]
  eurovocTerms: string[]
  formats: string[] // html, pdf
}

export interface NNFetchResult {
  success: boolean
  year: number
  issue: number
  articleCount: number
  evidenceCreated: number
  error?: string
}

/**
 * Parse JSON-LD response into structured metadata
 */
function parseJsonLd(jsonLd: Record<string, unknown>[]): NNArticleMetadata | null {
  // Find the LegalResource node (main article data)
  const legalResource = jsonLd.find(
    (node) =>
      Array.isArray(node["@type"]) && (node["@type"] as string[]).includes(ELI.LEGAL_RESOURCE)
  )

  // Find the LegalExpression node (language-specific data like title)
  const legalExpression = jsonLd.find(
    (node) =>
      Array.isArray(node["@type"]) && (node["@type"] as string[]).includes(ELI.LEGAL_EXPRESSION)
  )

  if (!legalResource) return null

  // Extract values from JSON-LD format
  const getValue = (obj: unknown, key: string): string => {
    const val = (obj as Record<string, unknown>)?.[key]
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0] as Record<string, unknown>
      return (first["@value"] as string) || (first["@id"] as string) || ""
    }
    return ""
  }

  const getValues = (obj: unknown, key: string): string[] => {
    const val = (obj as Record<string, unknown>)?.[key]
    if (Array.isArray(val)) {
      return val
        .map((item: Record<string, unknown>) => (item["@id"] as string) || "")
        .filter(Boolean)
    }
    return []
  }

  // Extract type from document-type URL
  const typeUrl = getValue(legalResource, ELI.TYPE_DOCUMENT)
  const type = typeUrl.split("/").pop() || "UNKNOWN"

  // Extract title from LegalExpression
  const title = getValue(legalExpression, ELI.TITLE)

  // Extract legal areas and Eurovoc terms from is_about
  const isAbout = getValues(legalResource, ELI.IS_ABOUT)
  const legalAreas = isAbout.filter((url) => url.includes("nn-legal-area"))
  const eurovocTerms = isAbout.filter((url) => url.includes("eurovoc.europa.eu"))

  return {
    eli: (legalResource["@id"] as string) || "",
    type,
    number: getValue(legalResource, ELI.NUMBER),
    dateDocument: getValue(legalResource, ELI.DATE_DOCUMENT),
    datePublication: getValue(legalResource, ELI.DATE_PUBLICATION),
    title,
    passedBy: getValue(legalResource, ELI.PASSED_BY),
    basedOn: getValues(legalResource, ELI.BASED_ON),
    legalAreas,
    eurovocTerms,
    formats: ["html", "pdf"],
  }
}

/**
 * Fetch JSON-LD metadata for a specific article
 */
export async function fetchNNArticleMetadata(
  year: number,
  issue: number,
  articleNumber: number,
  part: string = "sluzbeni"
): Promise<NNArticleMetadata | null> {
  const url = `${NN_METADATA_BASE}?part=${part}&year=${year}&edition_number=${issue}&article_number=${articleNumber}&format=json-ld`

  console.log(`[nn-fetcher] Fetching metadata: ${year}/${issue}/${articleNumber}`)

  try {
    const response = await fetchWithRateLimit(url)

    if (!response.ok) {
      console.log(`[nn-fetcher] HTTP ${response.status} for ${year}/${issue}/${articleNumber}`)
      return null
    }

    const jsonLd = await response.json()

    if (!Array.isArray(jsonLd) || jsonLd.length === 0) {
      console.log(`[nn-fetcher] Empty JSON-LD for ${year}/${issue}/${articleNumber}`)
      return null
    }

    return parseJsonLd(jsonLd)
  } catch (error) {
    console.error(`[nn-fetcher] Error fetching ${year}/${issue}/${articleNumber}:`, error)
    return null
  }
}

/**
 * Fetch JSON-LD metadata from a NN URL (supports both ELI and legacy formats).
 * This is useful when you have a URL from sources.ts and need to fetch its metadata.
 */
export async function fetchNNArticleMetadataFromUrl(
  url: string
): Promise<NNArticleMetadata | null> {
  const parsed = parseNNUrl(url)
  if (!parsed) {
    console.error(`[nn-fetcher] Could not parse NN URL: ${url}`)
    return null
  }

  return fetchNNArticleMetadata(parsed.year, parsed.issue, parsed.article, parsed.part)
}

/**
 * Get article numbers from a specific issue sitemap
 */
export async function getIssueArticles(year: number, issue: number): Promise<number[]> {
  const sitemapUrl = `${NN_SITEMAP_BASE}/sitemap_1_${year}_${issue}.xml`

  try {
    const response = await fetchWithRateLimit(sitemapUrl)
    if (!response.ok) return []

    const content = await response.text()

    // Extract article numbers from ELI URLs: /eli/sluzbeni/YYYY/ISSUE/ARTICLE
    const regex = new RegExp(`/eli/sluzbeni/${year}/${issue}/(\\d+)`, "g")
    const articles = new Set<number>()

    let match
    while ((match = regex.exec(content)) !== null) {
      articles.add(parseInt(match[1]))
    }

    return Array.from(articles).sort((a, b) => a - b)
  } catch (error) {
    console.error(`[nn-fetcher] Error fetching sitemap for ${year}/${issue}:`, error)
    return []
  }
}

/**
 * Map NN document type to authority level
 */
function mapTypeToAuthority(type: string): "LAW" | "GUIDANCE" | "PROCEDURE" | "PRACTICE" {
  const lawTypes = ["ZAKON", "USTAVNI_ZAKON", "ZAKONSKI_ČLANAK"]
  const guidanceTypes = ["UREDBA", "PRAVILNIK", "ODLUKA", "NAREDBA", "NAPUTAK"]
  const procedureTypes = ["UPUTA", "TUMAČENJE", "MIŠLJENJE"]

  if (lawTypes.includes(type)) return "LAW"
  if (guidanceTypes.includes(type)) return "GUIDANCE"
  if (procedureTypes.includes(type)) return "PROCEDURE"
  return "PRACTICE"
}

/**
 * Create Evidence record from NN metadata
 */
export async function createNNEvidence(metadata: NNArticleMetadata): Promise<string | null> {
  // CRITICAL: Hash and store the SAME bytes (compact JSON)
  // See: docs/07_AUDITS/runs/evidence-immutability-INV-001.md finding F-1
  const rawContent = JSON.stringify(metadata)
  const contentHash = hashContent(rawContent)

  // Normalize URL to ELI format for version-independent identification
  const normalizedUrl = normalizeNNUrl(metadata.eli)

  // Check if we already have this exact data
  const existing = await db.evidence.findFirst({
    where: { contentHash },
  })

  if (existing) {
    console.log(`[nn-fetcher] Skipping ${normalizedUrl} - already exists`)
    return existing.id
  }

  // Find or create NN source
  let source = await db.regulatorySource.findFirst({
    where: { slug: "narodne-novine" },
  })

  if (!source) {
    source = await db.regulatorySource.create({
      data: {
        slug: "narodne-novine",
        name: "Narodne novine",
        url: "https://narodne-novine.nn.hr",
        hierarchy: 2, // Zakon (legislation)
        isActive: true,
      },
    })
  }

  // Create Evidence record with normalized ELI URL
  const evidence = await db.evidence.create({
    data: {
      sourceId: source.id,
      url: normalizedUrl,
      rawContent, // Store exact bytes that were hashed
      contentHash,
      contentType: "json-ld",
      hasChanged: false,
    },
  })

  // SKIP: Legal metadata is not part of the core tax domains (pausalni, pdv, etc.)
  // Metadata should be stored in Evidence fields, not as SourcePointers
  // This prevents domain leakage into the regulatory database
  console.log(
    `[nn-fetcher] Skipping SourcePointer creation for legal-metadata - not in DomainSchema`
  )

  // Log audit event
  await logAuditEvent({
    action: "EVIDENCE_FETCHED",
    entityType: "EVIDENCE",
    entityId: evidence.id,
    metadata: {
      source: "nn-fetcher",
      tier: 1,
      eli: normalizedUrl,
      type: metadata.type,
      automatedCreation: true,
    },
  })

  console.log(`[nn-fetcher] Created evidence for ${normalizedUrl}`)
  return evidence.id
}

/**
 * Fetch all articles from a specific issue
 */
export async function fetchNNIssue(year: number, issue: number): Promise<NNFetchResult> {
  try {
    // Get article numbers from sitemap
    const articleNumbers = await getIssueArticles(year, issue)

    if (articleNumbers.length === 0) {
      return {
        success: true,
        year,
        issue,
        articleCount: 0,
        evidenceCreated: 0,
        error: "No articles found in sitemap",
      }
    }

    console.log(`[nn-fetcher] Found ${articleNumbers.length} articles in NN ${year}/${issue}`)

    let evidenceCreated = 0

    for (const articleNum of articleNumbers) {
      const metadata = await fetchNNArticleMetadata(year, issue, articleNum)

      if (metadata) {
        const evidenceId = await createNNEvidence(metadata)
        if (evidenceId) evidenceCreated++
      }

      // Rate limiting - 500ms between requests
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return {
      success: true,
      year,
      issue,
      articleCount: articleNumbers.length,
      evidenceCreated,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[nn-fetcher] Error: ${errorMsg}`)
    return {
      success: false,
      year,
      issue,
      articleCount: 0,
      evidenceCreated: 0,
      error: errorMsg,
    }
  }
}

/**
 * Fetch recent issues from the current year
 */
export async function fetchRecentNNIssues(
  count: number = 5
): Promise<{ total: number; created: number; errors: string[] }> {
  const results = { total: 0, created: 0, errors: [] as string[] }
  const year = new Date().getFullYear()

  // Start from a high issue number and work backwards
  // NN publishes ~150 issues per year
  let issueNum = 150

  let found = 0
  while (found < count && issueNum > 0) {
    try {
      const result = await fetchNNIssue(year, issueNum)

      if (result.articleCount > 0) {
        results.total += result.articleCount
        results.created += result.evidenceCreated
        found++
        console.log(
          `[nn-fetcher] Issue ${year}/${issueNum}: ${result.evidenceCreated}/${result.articleCount} created`
        )
      }

      if (result.error) {
        results.errors.push(`${year}/${issueNum}: ${result.error}`)
      }
    } catch (error) {
      results.errors.push(`${year}/${issueNum}: ${error}`)
    }

    issueNum--

    // Rate limiting - 2 seconds between issues
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return results
}

/**
 * Get the latest issue number from the sitemap index
 */
export async function getLatestIssueNumber(year: number): Promise<number | null> {
  try {
    const response = await fetchWithRateLimit(`${NN_SITEMAP_BASE}/sitemap.xml`)
    if (!response.ok) return null

    const content = await response.text()

    // Find highest issue number for the given year
    const regex = new RegExp(`sitemap_1_${year}_(\\d+)\\.xml`, "g")
    let maxIssue = 0

    let match
    while ((match = regex.exec(content)) !== null) {
      const issue = parseInt(match[1])
      if (issue > maxIssue) maxIssue = issue
    }

    return maxIssue > 0 ? maxIssue : null
  } catch {
    return null
  }
}
