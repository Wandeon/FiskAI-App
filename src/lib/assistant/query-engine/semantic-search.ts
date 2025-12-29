// src/lib/assistant/query-engine/semantic-search.ts
/**
 * SEMANTIC SEARCH MODULE
 *
 * Provides vector similarity search for concepts and rules using pgvector.
 * Integrates with existing Ollama embedding infrastructure.
 *
 * Key features:
 * 1. Query embedding generation
 * 2. Vector similarity search against concept embeddings
 * 3. Hybrid search (combines keyword + semantic)
 * 4. Re-ranking by relevance
 */

import { sql } from "drizzle-orm"
import { drizzleDb } from "@/lib/db/drizzle"
import { embedText } from "@/lib/article-agent/verification/embedder"

export interface SemanticMatch {
  conceptId: string
  slug: string
  nameHr: string
  similarity: number
  matchType: "semantic" | "hybrid"
}

export interface HybridSearchOptions {
  /**
   * Weight for semantic similarity (0.0-1.0)
   * Higher = more weight to vector similarity
   */
  semanticWeight?: number

  /**
   * Weight for keyword matching (0.0-1.0)
   * Higher = more weight to exact token matches
   */
  keywordWeight?: number

  /**
   * Minimum similarity threshold (0.0-1.0)
   * Matches below this are filtered out
   */
  minSimilarity?: number

  /**
   * Maximum number of results to return
   */
  topK?: number
}

const DEFAULT_OPTIONS: Required<HybridSearchOptions> = {
  semanticWeight: 0.7,
  keywordWeight: 0.3,
  minSimilarity: 0.3,
  topK: 10,
}

/**
 * Perform pure semantic search using vector embeddings
 * Uses cosine similarity via pgvector <=> operator
 */
export async function semanticSearch(
  query: string,
  options: Partial<HybridSearchOptions> = {}
): Promise<SemanticMatch[]> {
  const { minSimilarity, topK } = { ...DEFAULT_OPTIONS, ...options }

  // Generate embedding for query
  let queryEmbedding: number[]
  try {
    queryEmbedding = await embedText(query)
  } catch (error) {
    console.error("Failed to generate query embedding:", error)
    return []
  }

  const vectorStr = `[${queryEmbedding.join(",")}]`

  // Query concept embeddings using pgvector
  // Note: We assume concept embeddings exist in a ConceptEmbedding table
  // If not, we'll need to create embeddings for concepts first
  try {
    const results = await drizzleDb.execute(sql`
      SELECT
        c.id as "conceptId",
        c.slug,
        c."nameHr",
        1 - (ce.embedding <=> ${vectorStr}::vector) as similarity
      FROM "Concept" c
      INNER JOIN "ConceptEmbedding" ce ON ce."conceptId" = c.id
      WHERE ce.embedding IS NOT NULL
      ORDER BY ce.embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `)

    const matches = (results.rows as unknown as Array<{
      conceptId: string
      slug: string
      nameHr: string
      similarity: number
    }>)
      .filter((row) => row.similarity >= minSimilarity)
      .map((row) => ({
        ...row,
        matchType: "semantic" as const,
      }))

    return matches
  } catch (error) {
    // If ConceptEmbedding table doesn't exist yet, log and return empty
    console.warn("ConceptEmbedding table not found or embeddings not populated:", error)
    return []
  }
}

/**
 * Perform hybrid search combining keyword matching and semantic similarity
 *
 * @param query - User query string
 * @param keywordMatches - Results from keyword-based concept matching
 * @param options - Search configuration options
 */
export async function hybridSearch(
  query: string,
  keywordMatches: Array<{ conceptId: string; slug: string; nameHr: string; score: number }>,
  options: Partial<HybridSearchOptions> = {}
): Promise<SemanticMatch[]> {
  const { semanticWeight, keywordWeight, minSimilarity, topK } = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  // Get semantic matches
  const semanticMatches = await semanticSearch(query, { minSimilarity: 0, topK: topK * 2 })

  // Create maps for fast lookup
  const keywordMap = new Map(keywordMatches.map((m) => [m.conceptId, m.score]))
  const semanticMap = new Map(semanticMatches.map((m) => [m.conceptId, m.similarity]))

  // Combine all unique concept IDs
  const allConceptIds = new Set([
    ...keywordMatches.map((m) => m.conceptId),
    ...semanticMatches.map((m) => m.conceptId),
  ])

  // Calculate hybrid scores
  const hybridResults: SemanticMatch[] = []

  for (const conceptId of allConceptIds) {
    const keywordScore = keywordMap.get(conceptId) || 0
    const semanticScore = semanticMap.get(conceptId) || 0

    // Calculate weighted hybrid score
    const hybridScore = keywordScore * keywordWeight + semanticScore * semanticWeight

    // Find the concept details
    const match =
      keywordMatches.find((m) => m.conceptId === conceptId) ||
      semanticMatches.find((m) => m.conceptId === conceptId)

    if (!match || hybridScore < minSimilarity) {
      continue
    }

    hybridResults.push({
      conceptId: match.conceptId,
      slug: match.slug,
      nameHr: match.nameHr,
      similarity: hybridScore,
      matchType: "hybrid",
    })
  }

  // Sort by hybrid score descending and limit to topK
  return hybridResults.sort((a, b) => b.similarity - a.similarity).slice(0, topK)
}

/**
 * Re-rank matches based on additional context
 * Can be extended to include:
 * - User's business context
 * - Query intent
 * - Temporal relevance
 */
export function rerank(
  matches: SemanticMatch[],
  context?: {
    riskTier?: "T0" | "T1" | "T2" | "T3"
    jurisdiction?: string
  }
): SemanticMatch[] {
  // For now, just return matches as-is
  // Future: Add contextual re-ranking logic
  return matches
}
