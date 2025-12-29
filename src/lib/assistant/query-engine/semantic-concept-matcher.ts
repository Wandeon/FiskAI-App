/**
 * Semantic Concept Matcher
 *
 * Enhanced concept matching using vector embeddings for semantic search.
 * Combines traditional keyword matching with semantic similarity.
 *
 * Strategy:
 * 1. First try keyword-based concept matching (fast, precise)
 * 2. If no good matches, fall back to semantic search (slower, broader)
 * 3. Combine results with confidence scoring
 */

import { matchConcepts, type ConceptMatch } from "./concept-matcher"
import { hybridSearch } from "@/lib/regulatory-truth/retrieval/semantic-search"

export interface EnhancedConceptMatch extends ConceptMatch {
  /** How the match was found */
  matchMethod: "keyword" | "semantic"

  /** Similarity score (for semantic matches) */
  similarity?: number

  /** Sample quote from semantic match */
  sampleQuote?: string
}

/**
 * Match concepts using both keyword and semantic search
 *
 * @param keywords - Keywords extracted from user query
 * @param query - Full user query text (for semantic search)
 * @param options - Search options
 */
export async function matchConceptsWithSemantics(
  keywords: string[],
  query: string,
  options: {
    /** Use semantic search if keyword matching fails */
    enableSemanticFallback?: boolean

    /** Minimum keyword match score to skip semantic search */
    keywordScoreThreshold?: number

    /** Minimum semantic similarity for matches */
    semanticSimilarityThreshold?: number

    /** Maximum results to return */
    maxResults?: number
  } = {}
): Promise<EnhancedConceptMatch[]> {
  const {
    enableSemanticFallback = true,
    keywordScoreThreshold = 0.4,
    semanticSimilarityThreshold = 0.75,
    maxResults = 10,
  } = options

  // Step 1: Try keyword-based concept matching
  const keywordMatches = await matchConcepts(keywords)

  // Convert to enhanced format
  const enhancedKeywordMatches: EnhancedConceptMatch[] = keywordMatches.map((m) => ({
    ...m,
    matchMethod: "keyword" as const,
  }))

  // Check if keyword matching was successful
  const hasGoodKeywordMatch = keywordMatches.some((m) => m.score >= keywordScoreThreshold)

  // If we have good keyword matches, return them
  if (hasGoodKeywordMatch || !enableSemanticFallback) {
    return enhancedKeywordMatches.slice(0, maxResults)
  }

  // Step 2: Fall back to semantic search
  console.log("[semantic-concept-matcher] Keyword matching weak, trying semantic search...")

  try {
    const { semanticResults, suggestedConcepts } = await hybridSearch(query, {
      limit: 20,
      minSimilarity: semanticSimilarityThreshold,
      publishedRulesOnly: true,
    })

    // Build concept matches from semantic results
    const semanticMatches = new Map<string, EnhancedConceptMatch>()

    for (const result of semanticResults) {
      for (const rule of result.rules) {
        const existing = semanticMatches.get(rule.conceptSlug)

        // Keep the highest similarity for each concept
        if (!existing || result.similarity > (existing.similarity ?? 0)) {
          semanticMatches.set(rule.conceptSlug, {
            conceptId: rule.id, // Using rule ID as conceptId (will need adjustment)
            slug: rule.conceptSlug,
            nameHr: rule.titleHr,
            score: result.similarity, // Use similarity as score
            matchedKeywords: [], // No keywords for semantic matches
            matchMethod: "semantic" as const,
            similarity: result.similarity,
            sampleQuote: result.exactQuote.slice(0, 100), // Preview
          })
        }
      }
    }

    // Combine keyword and semantic matches
    const combinedMatches = [...enhancedKeywordMatches, ...Array.from(semanticMatches.values())]

    // Sort by score/similarity descending
    combinedMatches.sort((a, b) => b.score - a.score)

    // Return top N
    return combinedMatches.slice(0, maxResults)
  } catch (error) {
    // If semantic search fails, fall back to keyword matches
    console.warn("[semantic-concept-matcher] Semantic search failed:", error)
    return enhancedKeywordMatches.slice(0, maxResults)
  }
}

/**
 * Get match method statistics for debugging
 */
export function getMatchMethodStats(matches: EnhancedConceptMatch[]): {
  keyword: number
  semantic: number
  total: number
} {
  const keyword = matches.filter((m) => m.matchMethod === "keyword").length
  const semantic = matches.filter((m) => m.matchMethod === "semantic").length

  return { keyword, semantic, total: matches.length }
}

/**
 * Check if semantic search should be enabled based on environment
 */
export function isSemanticSearchAvailable(): boolean {
  // Check if required environment variables are set
  const hasOllamaConfig =
    process.env.OLLAMA_ENDPOINT && process.env.OLLAMA_API_KEY && process.env.OLLAMA_EMBED_MODEL

  return !!hasOllamaConfig
}
