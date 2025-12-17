// src/lib/article-agent/verification/similarity.ts

import { sql } from "drizzle-orm"
import { drizzleDb } from "@/lib/db/drizzle"

export interface SimilarChunk {
  id: string
  content: string
  sourceUrl: string
  similarity: number
  claimIds: string[]
}

export async function findSimilarChunks(
  paragraphEmbedding: number[],
  factSheetId: string,
  topK: number = 5
): Promise<SimilarChunk[]> {
  const vectorStr = `[${paragraphEmbedding.join(",")}]`

  const results = await drizzleDb.execute(sql`
    SELECT
      sc.id,
      sc.content,
      sc."sourceUrl" as "sourceUrl",
      1 - (sc.embedding <=> ${vectorStr}::vector) as similarity,
      COALESCE(
        array_agg(c.id) FILTER (WHERE c.id IS NOT NULL),
        '{}'
      ) as "claimIds"
    FROM "SourceChunk" sc
    LEFT JOIN "Claim" c ON c."sourceChunkId" = sc.id
    WHERE sc."factSheetId" = ${factSheetId}
      AND sc.embedding IS NOT NULL
    GROUP BY sc.id, sc.content, sc."sourceUrl", sc.embedding
    ORDER BY sc.embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `)

  return results.rows as SimilarChunk[]
}

export async function updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(",")}]`

  await drizzleDb.execute(sql`
    UPDATE "SourceChunk"
    SET embedding = ${vectorStr}::vector
    WHERE id = ${chunkId}
  `)
}
