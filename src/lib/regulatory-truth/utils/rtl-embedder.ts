/**
 * RTL Embedding Generation Utility
 *
 * Generates vector embeddings for SourcePointer records to enable semantic search.
 * Uses Ollama Cloud nomic-embed-text (768 dimensions).
 *
 * Design:
 * - Embeddings are generated from exactQuote + contextBefore + contextAfter
 * - Context provides richer semantic understanding
 * - Reuses existing embedder.ts infrastructure from article-agent
 */

import { embedText, embedBatch } from "@/lib/article-agent/verification/embedder"
import { prisma } from "@/lib/prisma"

/**
 * Build embedding text from SourcePointer fields
 * Combines exactQuote with surrounding context for richer semantics
 */
export function buildEmbeddingText(pointer: {
  exactQuote: string
  contextBefore?: string | null
  contextAfter?: string | null
}): string {
  const parts: string[] = []

  // Add context before (if available)
  if (pointer.contextBefore && pointer.contextBefore.trim()) {
    parts.push(pointer.contextBefore.trim())
  }

  // Add exact quote (always present)
  parts.push(pointer.exactQuote.trim())

  // Add context after (if available)
  if (pointer.contextAfter && pointer.contextAfter.trim()) {
    parts.push(pointer.contextAfter.trim())
  }

  // Join with space to create continuous text
  return parts.join(" ")
}

/**
 * Generate embedding for a single SourcePointer
 */
export async function generatePointerEmbedding(pointerId: string): Promise<number[]> {
  // Fetch pointer
  const pointer = await prisma.sourcePointer.findUnique({
    where: { id: pointerId },
    select: {
      id: true,
      exactQuote: true,
      contextBefore: true,
      contextAfter: true,
    },
  })

  if (!pointer) {
    throw new Error(`SourcePointer ${pointerId} not found`)
  }

  // Build embedding text
  const text = buildEmbeddingText(pointer)

  // Generate embedding
  const embedding = await embedText(text)

  // Update database
  await prisma.$executeRaw`
    UPDATE "SourcePointer"
    SET "embedding" = ${JSON.stringify(embedding)}::vector
    WHERE "id" = ${pointerId}
  `

  return embedding
}

/**
 * Generate embeddings for multiple SourcePointers in batch
 * More efficient than individual calls
 */
export async function generatePointerEmbeddingsBatch(
  pointerIds: string[]
): Promise<Map<string, number[]>> {
  if (pointerIds.length === 0) {
    return new Map()
  }

  // Fetch pointers
  const pointers = await prisma.sourcePointer.findMany({
    where: { id: { in: pointerIds } },
    select: {
      id: true,
      exactQuote: true,
      contextBefore: true,
      contextAfter: true,
    },
  })

  if (pointers.length === 0) {
    return new Map()
  }

  // Build embedding texts
  const texts = pointers.map((p) => buildEmbeddingText(p))

  // Generate embeddings in batch
  const embeddings = await embedBatch(texts)

  // Update database
  const results = new Map<string, number[]>()
  for (let i = 0; i < pointers.length; i++) {
    const pointer = pointers[i]
    const embedding = embeddings[i]

    if (!embedding) continue

    // Update database with raw SQL (Prisma doesn't support vector type directly)
    await prisma.$executeRaw`
      UPDATE "SourcePointer"
      SET "embedding" = ${JSON.stringify(embedding)}::vector
      WHERE "id" = ${pointer.id}
    `

    results.set(pointer.id, embedding)
  }

  return results
}

/**
 * Check if a SourcePointer has an embedding
 */
export async function hasEmbedding(pointerId: string): Promise<boolean> {
  const result = await prisma.$queryRaw<[{ has_embedding: boolean }]>`
    SELECT ("embedding" IS NOT NULL) as has_embedding
    FROM "SourcePointer"
    WHERE "id" = ${pointerId}
  `

  return result[0]?.has_embedding ?? false
}

/**
 * Count SourcePointers with/without embeddings
 */
export async function getEmbeddingStats(): Promise<{
  total: number
  withEmbedding: number
  withoutEmbedding: number
  percentage: number
}> {
  const result = await prisma.$queryRaw<
    [{ total: bigint; with_embedding: bigint; without_embedding: bigint }]
  >`
    SELECT
      COUNT(*) as total,
      COUNT("embedding") as with_embedding,
      COUNT(*) - COUNT("embedding") as without_embedding
    FROM "SourcePointer"
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
 * Find SourcePointers without embeddings (for backfill)
 */
export async function findPointersWithoutEmbeddings(
  limit: number = 100
): Promise<Array<{ id: string; exactQuote: string }>> {
  const result = await prisma.$queryRaw<Array<{ id: string; exactQuote: string }>>`
    SELECT "id", "exactQuote"
    FROM "SourcePointer"
    WHERE "embedding" IS NULL
      AND "deletedAt" IS NULL
    ORDER BY "createdAt" ASC
    LIMIT ${limit}
  `

  return result
}
