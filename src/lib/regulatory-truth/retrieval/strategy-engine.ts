// src/lib/regulatory-truth/retrieval/strategy-engine.ts
import { db } from "@/lib/db"
import type { ExtractedEntities } from "../schemas/query-intent"

/**
 * Patterns that indicate strategic/comparison queries
 */
const STRATEGY_PATTERNS = [
  /\bshould\s+i\b/i,
  /\btrebam\s+li\b/i,
  /\bsto\s+je\s+bolje\b/i,
  /\bkoji\s+je\s+bolji\b/i,
  /\bodabrati\b/i,
  /\bpreporucujem\b/i,
  /\busporediti\b/i,
  /\brazlika\s+izmedju\b/i,
  /\bvs\.?\b/i,
  /\bili\b.*\bili\b/i, // "X ili Y"
]

/**
 * Detect if query has strategic intent
 */
export function detectStrategyIntent(query: string): boolean {
  return STRATEGY_PATTERNS.some((pattern) => pattern.test(query))
}

/**
 * Map query terms to domain tags
 */
export function extractDomainTags(query: string, entities: ExtractedEntities): string[] {
  const tags: string[] = []
  const lowerQuery = query.toLowerCase()

  if (/obrt|d\.?o\.?o\.?|j\.?d\.?o\.?o\.?|tvrtka|poduzece/.test(lowerQuery)) {
    tags.push("STARTING_BUSINESS", "LEGAL_FORM")
  }
  if (/pausal|pdv|porez/.test(lowerQuery)) {
    tags.push("TAX_REGIME")
  }
  if (/oss|eu|intrastat/.test(lowerQuery)) {
    tags.push("VAT_SCHEME")
  }
  if (/zaposlenik|ugovor\s+o\s+radu|placa/.test(lowerQuery)) {
    tags.push("EMPLOYMENT")
  }
  if (/mirovina|staz/.test(lowerQuery)) {
    tags.push("RETIREMENT")
  }

  return [...new Set(tags)]
}

export interface StrategyEngineResult {
  success: boolean
  matrices: Array<{
    id: string
    slug: string
    titleHr: string
    titleEn?: string | null
    appliesWhen?: string | null
    domainTags: string[]
    options: unknown
    criteria: unknown
    cells: unknown
    conclusion?: string | null
    relevanceScore: number
  }>
  error?: string
}

/**
 * Run strategy engine to find relevant comparison matrices
 */
export async function runStrategyEngine(
  query: string,
  entities: ExtractedEntities
): Promise<StrategyEngineResult> {
  try {
    const domainTags = extractDomainTags(query, entities)

    // Find matrices matching domain tags or with overlapping content
    const matrices = await db.comparisonMatrix.findMany({
      where: domainTags.length > 0 ? { domainTags: { hasSome: domainTags } } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 5,
    })

    // Score relevance based on domain tag overlap
    const scoredMatrices = matrices.map((matrix) => {
      const matrixTags = matrix.domainTags
      const overlap = matrixTags.filter((tag) => domainTags.includes(tag)).length
      const relevanceScore = domainTags.length > 0 ? overlap / domainTags.length : 0.5

      return {
        ...matrix,
        relevanceScore,
      }
    })

    // Sort by relevance
    scoredMatrices.sort((a, b) => b.relevanceScore - a.relevanceScore)

    return {
      success: true,
      matrices: scoredMatrices,
    }
  } catch (error) {
    return {
      success: false,
      matrices: [],
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
