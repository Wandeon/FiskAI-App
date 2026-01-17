/**
 * Evidence Embedding Generation Utility
 *
 * Generates vector embeddings for Evidence records to enable semantic duplicate detection.
 * Uses Ollama Cloud nomic-embed-text (768 dimensions).
 *
 * Design:
 * - Embeddings are generated from normalized rawContent
 * - For large documents, uses first N characters to keep embedding meaningful
 * - Reuses existing embedder.ts infrastructure from article-agent
 * - Enables semantic similarity detection beyond exact content hash matching
 *
 * Use Case:
 * - Detect duplicate Evidence from different sources (e.g., same law from different URLs)
 * - Identify content variations (HTML vs PDF, consolidated vs original)
 * - Link semantically similar content that hash matching would miss
 */

import { embedText, embedBatch } from "@/lib/article-agent/verification/embedder"
import { dbReg } from "@/lib/db"
import { normalizeHtmlContent } from "./content-hash"

/**
 * Maximum content length for embedding (in characters)
 * Longer content is truncated to keep embeddings focused
 *
 * Rationale:
 * - Embedding models work best with focused text
 * - First 4000 chars capture document essence (title, intro, key sections)
 * - Reduces API costs and processing time
 * - nomic-embed-text has token limits; HTML tags inflate token count significantly
 */
const MAX_EMBEDDING_LENGTH = 4000

/**
 * Strip HTML tags from content for embedding preparation
 * This is essential because HTML tags cause token count explosion:
 * - A 4000 char HTML document can tokenize to 2000+ tokens
 * - nomic-embed-text has limited context window
 * - Stripped text preserves semantic meaning with fewer tokens
 */
function stripHtmlTags(content: string): string {
  return (
    content
      // Remove all HTML tags (but keep content between tags)
      .replace(/<[^>]*>/g, " ")
      // Collapse multiple spaces into one
      .replace(/\s+/g, " ")
      .trim()
  )
}

/**
 * Build embedding text from Evidence rawContent
 * Normalizes, strips HTML tags, and truncates for optimal semantic representation
 */
export function buildEvidenceEmbeddingText(evidence: {
  rawContent: string
  contentType?: string
}): string {
  // First normalize to remove scripts, styles, comments
  let text = normalizeHtmlContent(evidence.rawContent)

  // Then strip remaining HTML tags to reduce token count
  // This is critical: HTML tags cause token overflow in embedding model
  text = stripHtmlTags(text)

  // Truncate to max length if needed
  if (text.length > MAX_EMBEDDING_LENGTH) {
    text = text.substring(0, MAX_EMBEDDING_LENGTH)
  }

  return text.trim()
}

/**
 * Generate embedding for a single Evidence record
 */
export async function generateEvidenceEmbedding(evidenceId: string): Promise<number[]> {
  // Fetch evidence
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true,
      rawContent: true,
      contentType: true,
    },
  })

  if (!evidence) {
    throw new Error(`Evidence ${evidenceId} not found`)
  }

  // Build embedding text
  const text = buildEvidenceEmbeddingText(evidence)

  if (!text || text.trim().length === 0) {
    throw new Error(`Evidence ${evidenceId} has no content for embedding`)
  }

  // Generate embedding
  const embedding = await embedText(text)

  // Update database (Evidence is in regulatory schema)
  await dbReg.$executeRaw`
    UPDATE "regulatory"."Evidence"
    SET "embedding" = ${JSON.stringify(embedding)}::vector
    WHERE "id" = ${evidenceId}
  `

  return embedding
}

/**
 * Generate embeddings for multiple Evidence records in batch
 * More efficient than individual calls
 */
export async function generateEvidenceEmbeddingsBatch(
  evidenceIds: string[]
): Promise<Map<string, number[]>> {
  if (evidenceIds.length === 0) {
    return new Map()
  }

  // Fetch evidence records
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: evidenceIds } },
    select: {
      id: true,
      rawContent: true,
      contentType: true,
    },
  })

  if (evidenceRecords.length === 0) {
    return new Map()
  }

  // Build embedding texts
  const texts = evidenceRecords.map((e) => buildEvidenceEmbeddingText(e))

  // Generate embeddings in batch
  const embeddings = await embedBatch(texts)

  // Update database
  const results = new Map<string, number[]>()
  for (let i = 0; i < evidenceRecords.length; i++) {
    const evidence = evidenceRecords[i]
    const embedding = embeddings[i]

    if (!embedding) continue

    // Update database with raw SQL (Prisma doesn't support vector type directly)
    await dbReg.$executeRaw`
      UPDATE "regulatory"."Evidence"
      SET "embedding" = ${JSON.stringify(embedding)}::vector
      WHERE "id" = ${evidence.id}
    `

    results.set(evidence.id, embedding)
  }

  return results
}

/**
 * Check if an Evidence record has an embedding
 */
export async function hasEmbedding(evidenceId: string): Promise<boolean> {
  const result = await dbReg.$queryRaw<[{ has_embedding: boolean }]>`
    SELECT ("embedding" IS NOT NULL) as has_embedding
    FROM "regulatory"."Evidence"
    WHERE "id" = ${evidenceId}
  `

  return result[0]?.has_embedding ?? false
}

/**
 * Count Evidence records with/without embeddings
 */
export async function getEmbeddingStats(): Promise<{
  total: number
  withEmbedding: number
  withoutEmbedding: number
  percentage: number
}> {
  const result = await dbReg.$queryRaw<
    [{ total: bigint; with_embedding: bigint; without_embedding: bigint }]
  >`
    SELECT
      COUNT(*) as total,
      COUNT("embedding") as with_embedding,
      COUNT(*) - COUNT("embedding") as without_embedding
    FROM "regulatory"."Evidence"
    WHERE "deletedAt" IS NULL
  `

  const stats = result[0]
  const total = Number(stats?.total ?? 0)
  const withEmbedding = Number(stats?.with_embedding ?? 0)
  const withoutEmbedding = Number(stats?.without_embedding ?? 0)

  return {
    total,
    withEmbedding,
    withoutEmbedding,
    percentage: total > 0 ? (withEmbedding / total) * 100 : 0,
  }
}

/**
 * Find Evidence records without embeddings (for backfill)
 */
export async function findEvidenceWithoutEmbeddings(
  limit: number = 100
): Promise<Array<{ id: string; url: string }>> {
  const result = await dbReg.$queryRaw<Array<{ id: string; url: string }>>`
    SELECT "id", "url"
    FROM "regulatory"."Evidence"
    WHERE "embedding" IS NULL
      AND "deletedAt" IS NULL
    ORDER BY "fetchedAt" DESC
    LIMIT ${limit}
  `

  return result
}

/**
 * Find semantically similar Evidence records
 * Uses cosine similarity on embeddings
 *
 * @param evidenceId - The Evidence record to find duplicates of
 * @param minSimilarity - Minimum similarity threshold (0-1, default: 0.85)
 * @param limit - Maximum number of results
 * @returns Array of similar Evidence records with similarity scores
 */
export async function findSimilarEvidence(
  evidenceId: string,
  minSimilarity: number = 0.85,
  limit: number = 10
): Promise<
  Array<{
    id: string
    url: string
    contentHash: string
    similarity: number
    sourceId: string
  }>
> {
  // Get the evidence embedding
  const evidence = await dbReg.$queryRaw<Array<{ embedding: string }>>`
    SELECT "embedding"::text as embedding
    FROM "regulatory"."Evidence"
    WHERE "id" = ${evidenceId}
      AND "embedding" IS NOT NULL
  `

  if (!evidence || evidence.length === 0 || !evidence[0].embedding) {
    return []
  }

  const queryEmbedding = evidence[0].embedding

  // Find similar evidence using cosine similarity
  const results = await dbReg.$queryRaw<
    Array<{
      id: string
      url: string
      contentHash: string
      similarity: number
      sourceId: string
    }>
  >`
    SELECT
      "id",
      "url",
      "contentHash",
      "sourceId",
      1 - ("embedding" <=> ${queryEmbedding}::vector) as similarity
    FROM "regulatory"."Evidence"
    WHERE "id" != ${evidenceId}
      AND "embedding" IS NOT NULL
      AND "deletedAt" IS NULL
      AND 1 - ("embedding" <=> ${queryEmbedding}::vector) >= ${minSimilarity}
    ORDER BY "embedding" <=> ${queryEmbedding}::vector ASC
    LIMIT ${limit}
  `

  return results
}

/**
 * Find semantically similar Evidence by content
 * Useful for checking duplicates before creating new Evidence
 *
 * @param content - Raw content to check for duplicates
 * @param minSimilarity - Minimum similarity threshold (0-1, default: 0.85)
 * @param limit - Maximum number of results
 * @returns Array of similar Evidence records with similarity scores
 */
export async function findSimilarEvidenceByContent(
  content: string,
  contentType?: string,
  minSimilarity: number = 0.85,
  limit: number = 10
): Promise<
  Array<{
    id: string
    url: string
    contentHash: string
    similarity: number
    sourceId: string
  }>
> {
  // Build embedding text
  const text = buildEvidenceEmbeddingText({ rawContent: content, contentType })

  if (!text || text.trim().length === 0) {
    return []
  }

  // Generate embedding
  const embedding = await embedText(text)

  // Find similar evidence using cosine similarity
  const results = await dbReg.$queryRaw<
    Array<{
      id: string
      url: string
      contentHash: string
      similarity: number
      sourceId: string
    }>
  >`
    SELECT
      "id",
      "url",
      "contentHash",
      "sourceId",
      1 - ("embedding" <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM "regulatory"."Evidence"
    WHERE "embedding" IS NOT NULL
      AND "deletedAt" IS NULL
      AND 1 - ("embedding" <=> ${JSON.stringify(embedding)}::vector) >= ${minSimilarity}
    ORDER BY "embedding" <=> ${JSON.stringify(embedding)}::vector ASC
    LIMIT ${limit}
  `

  return results
}
