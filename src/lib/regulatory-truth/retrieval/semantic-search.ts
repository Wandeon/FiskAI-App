/**
 * RTL Semantic Search
 *
 * Vector similarity search for SourcePointers using pgvector.
 * Enables finding relevant regulatory content based on semantic meaning,
 * not just keyword matching.
 *
 * Design:
 * - Uses cosine similarity for vector comparison
 * - Returns SourcePointers with their associated RegulatoryRules
 * - Supports filtering by domain, confidence, and rule status
 * - Can be used standalone or combined with keyword search (hybrid search)
 */

import { prisma } from "@/lib/prisma"
import { embedText } from "@/lib/article-agent/verification/embedder"

export interface SemanticSearchOptions {
  /** Maximum number of results to return */
  limit?: number

  /** Minimum similarity threshold (0-1, default: 0.7) */
  minSimilarity?: number

  /** Filter by domain (e.g., "pdv", "pausalni") */
  domain?: string

  /** Minimum confidence score for pointers (0-1) */
  minConfidence?: number

  /** Only include pointers linked to PUBLISHED rules */
  publishedRulesOnly?: boolean

  /** Date to check rule effective dates against */
  asOfDate?: Date
}

export interface SemanticSearchResult {
  pointerId: string
  similarity: number
  exactQuote: string
  contextBefore: string | null
  contextAfter: string | null
  domain: string
  valueType: string
  extractedValue: string
  confidence: number
  articleNumber: string | null
  lawReference: string | null

  // Evidence info
  evidenceId: string
  evidenceUrl: string
  evidenceSource: {
    name: string
    url: string
  }

  // Associated rules
  rules: Array<{
    id: string
    conceptSlug: string
    titleHr: string
    status: string
    authorityLevel: string
    effectiveFrom: Date
    effectiveUntil: Date | null
  }>
}

/**
 * Perform semantic search across SourcePointers
 *
 * @param query - Natural language query (will be embedded)
 * @param options - Search options
 * @returns Array of matching SourcePointers with similarity scores
 */
export async function semanticSearch(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<SemanticSearchResult[]> {
  const {
    limit = 10,
    minSimilarity = 0.7,
    domain,
    minConfidence = 0.7,
    publishedRulesOnly = false,
    asOfDate = new Date(),
  } = options

  // Generate query embedding
  const queryEmbedding = await embedText(query)

  // Build WHERE clause conditions
  const conditions: string[] = []
  const params: any[] = []

  // Add domain filter
  if (domain) {
    conditions.push(`sp."domain" = $${params.length + 1}`)
    params.push(domain)
  }

  // Add confidence filter
  conditions.push(`sp."confidence" >= $${params.length + 1}`)
  params.push(minConfidence)

  // Add non-deleted filter
  conditions.push(`sp."deletedAt" IS NULL`)

  // Add embedding existence filter
  conditions.push(`sp."embedding" IS NOT NULL`)

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  // Build the SQL query
  // Uses cosine similarity (1 - cosine distance) for ranking
  const sql = `
    SELECT
      sp."id" as "pointerId",
      1 - (sp."embedding" <=> $1::vector) as similarity,
      sp."exactQuote",
      sp."contextBefore",
      sp."contextAfter",
      sp."domain",
      sp."valueType",
      sp."extractedValue",
      sp."confidence",
      sp."articleNumber",
      sp."lawReference",
      sp."evidenceId",
      e."url" as "evidenceUrl",
      s."name" as "sourceName",
      s."url" as "sourceUrl"
    FROM "SourcePointer" sp
    INNER JOIN "Evidence" e ON e."id" = sp."evidenceId"
    INNER JOIN "RegulatorySource" s ON s."id" = e."sourceId"
    ${whereClause}
    ORDER BY sp."embedding" <=> $1::vector ASC
    LIMIT $${params.length + 1}
  `

  // Add query embedding as first param
  const allParams = [JSON.stringify(queryEmbedding), ...params, limit * 2] // Fetch 2x limit to filter later

  // Execute query
  const results = await prisma.$queryRawUnsafe<
    Array<{
      pointerId: string
      similarity: number
      exactQuote: string
      contextBefore: string | null
      contextAfter: string | null
      domain: string
      valueType: string
      extractedValue: string
      confidence: number
      articleNumber: string | null
      lawReference: string | null
      evidenceId: string
      evidenceUrl: string
      sourceName: string
      sourceUrl: string
    }>
  >(sql, ...allParams)

  // Filter by similarity threshold
  const filteredResults = results.filter((r) => r.similarity >= minSimilarity)

  // Fetch associated rules for each pointer
  const pointerIds = filteredResults.map((r) => r.pointerId)

  const rulesData = await prisma.regulatoryRule.findMany({
    where: {
      sourcePointers: {
        some: {
          id: { in: pointerIds },
        },
      },
      ...(publishedRulesOnly ? { status: "PUBLISHED" } : {}),
      // Filter by effective dates
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: asOfDate } }],
    },
    include: {
      sourcePointers: {
        where: {
          id: { in: pointerIds },
        },
        select: { id: true },
      },
    },
  })

  // Build lookup map of rules by pointer ID
  const rulesByPointerId = new Map<string, typeof rulesData>()
  for (const rule of rulesData) {
    for (const pointer of rule.sourcePointers) {
      if (!rulesByPointerId.has(pointer.id)) {
        rulesByPointerId.set(pointer.id, [])
      }
      rulesByPointerId.get(pointer.id)!.push(rule)
    }
  }

  // Combine results
  const finalResults: SemanticSearchResult[] = filteredResults.map((r) => ({
    pointerId: r.pointerId,
    similarity: r.similarity,
    exactQuote: r.exactQuote,
    contextBefore: r.contextBefore,
    contextAfter: r.contextAfter,
    domain: r.domain,
    valueType: r.valueType,
    extractedValue: r.extractedValue,
    confidence: r.confidence,
    articleNumber: r.articleNumber,
    lawReference: r.lawReference,
    evidenceId: r.evidenceId,
    evidenceUrl: r.evidenceUrl,
    evidenceSource: {
      name: r.sourceName,
      url: r.sourceUrl,
    },
    rules:
      rulesByPointerId.get(r.pointerId)?.map((rule) => ({
        id: rule.id,
        conceptSlug: rule.conceptSlug,
        titleHr: rule.titleHr,
        status: rule.status,
        authorityLevel: rule.authorityLevel,
        effectiveFrom: rule.effectiveFrom,
        effectiveUntil: rule.effectiveUntil,
      })) ?? [],
  }))

  // Return top N results
  return finalResults.slice(0, limit)
}

/**
 * Hybrid search: Combines semantic search with concept matching
 *
 * Strategy:
 * 1. Use semantic search to find relevant pointers
 * 2. Extract concept slugs from associated rules
 * 3. Return both semantic results and concept slugs for keyword expansion
 */
export async function hybridSearch(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<{
  semanticResults: SemanticSearchResult[]
  suggestedConcepts: string[]
}> {
  // Perform semantic search
  const semanticResults = await semanticSearch(query, options)

  // Extract unique concept slugs from rules
  const conceptSlugs = new Set<string>()
  for (const result of semanticResults) {
    for (const rule of result.rules) {
      conceptSlugs.add(rule.conceptSlug)
    }
  }

  return {
    semanticResults,
    suggestedConcepts: Array.from(conceptSlugs),
  }
}

/**
 * Find similar regulatory content to a given SourcePointer
 * Useful for discovering related rules
 */
export async function findSimilarPointers(
  pointerId: string,
  options: Omit<SemanticSearchOptions, "limit"> & { limit?: number } = {}
): Promise<SemanticSearchResult[]> {
  // Fetch the source pointer
  const pointer = await prisma.sourcePointer.findUnique({
    where: { id: pointerId },
    select: {
      exactQuote: true,
      contextBefore: true,
      contextAfter: true,
    },
  })

  if (!pointer) {
    throw new Error(`SourcePointer ${pointerId} not found`)
  }

  // Build text from pointer
  const parts = [pointer.exactQuote]
  if (pointer.contextBefore) parts.unshift(pointer.contextBefore)
  if (pointer.contextAfter) parts.push(pointer.contextAfter)
  const text = parts.join(" ")

  // Search using the pointer's text
  return semanticSearch(text, { ...options, limit: options.limit ?? 5 })
}
