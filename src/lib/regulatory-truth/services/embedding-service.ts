// src/lib/regulatory-truth/services/embedding-service.ts
// Service to generate and sync embeddings for regulatory rules

import { db } from "@/lib/db"
import { drizzleDb } from "@/lib/db/drizzle"
import { sourceChunkEmbeddings } from "@/lib/db/drizzle/schema/embeddings"
import { embedBatch, embedText } from "@/lib/article-agent/verification/embedder"
import { count, countDistinct, eq } from "drizzle-orm"

export interface EmbeddingResult {
  success: boolean
  chunkCount: number
  error: string | null
}

/**
 * Generate embeddings for a single regulatory rule.
 * Creates chunks from rule content and stores them in SourceChunk table.
 *
 * @param ruleId - The ID of the regulatory rule
 * @returns Result with success status and chunk count
 */
export async function generateEmbeddingsForRule(ruleId: string): Promise<EmbeddingResult> {
  try {
    // Fetch the rule with its evidence
    const rule = await db.regulatoryRule.findUnique({
      where: { id: ruleId },
      include: {
        sourcePointers: {
          include: {
            evidence: true,
          },
        },
      },
    })

    if (!rule) {
      return {
        success: false,
        chunkCount: 0,
        error: `Rule ${ruleId} not found`,
      }
    }

    // Build content chunks from the rule
    const chunks: Array<{
      id: string
      factSheetId: string
      sourceUrl: string
      content: string
    }> = []

    // Chunk 1: Rule title + body
    const ruleContent = `${rule.titleHr}\n\n${rule.bodyHr}`
    chunks.push({
      id: `${ruleId}-rule-content`,
      factSheetId: ruleId,
      sourceUrl: rule.sourcePointers[0]?.lawReference || "N/A",
      content: ruleContent,
    })

    // Chunk 2-N: Evidence snippets (if available)
    for (const pointer of rule.sourcePointers) {
      if (pointer.evidence?.rawContent) {
        // Take first 2000 chars of evidence (embeddings work better with focused content)
        const evidenceSnippet = pointer.evidence.rawContent.slice(0, 2000)
        chunks.push({
          id: `${ruleId}-evidence-${pointer.id}`,
          factSheetId: ruleId,
          sourceUrl: pointer.lawReference || pointer.evidence.sourceUrl,
          content: evidenceSnippet,
        })
      }
    }

    // Generate embeddings in batch
    const contents = chunks.map((c) => c.content)
    const embeddings = await embedBatch(contents)

    // Delete existing embeddings for this rule (incremental update)
    await drizzleDb.delete(sourceChunkEmbeddings).where(eq(sourceChunkEmbeddings.factSheetId, ruleId))

    // Insert new embeddings
    for (let i = 0; i < chunks.length; i++) {
      await drizzleDb.insert(sourceChunkEmbeddings).values({
        id: chunks[i].id,
        factSheetId: chunks[i].factSheetId,
        sourceUrl: chunks[i].sourceUrl,
        content: chunks[i].content,
        embedding: embeddings[i],
        fetchedAt: new Date(),
      })
    }

    console.log(`[embedding-service] Generated ${chunks.length} embeddings for rule ${ruleId}`)

    return {
      success: true,
      chunkCount: chunks.length,
      error: null,
    }
  } catch (error) {
    console.error(`[embedding-service] Failed to generate embeddings for rule ${ruleId}:`, error)
    return {
      success: false,
      chunkCount: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Generate embeddings for a batch of rules.
 *
 * @param ruleIds - Array of rule IDs
 * @returns Results for each rule
 */
export async function generateEmbeddingsForRules(
  ruleIds: string[]
): Promise<Map<string, EmbeddingResult>> {
  const results = new Map<string, EmbeddingResult>()

  for (const ruleId of ruleIds) {
    const result = await generateEmbeddingsForRule(ruleId)
    results.set(ruleId, result)
  }

  return results
}

/**
 * Delete embeddings for a rule (used when a rule is deprecated).
 *
 * @param ruleId - The ID of the regulatory rule
 */
export async function deleteEmbeddingsForRule(ruleId: string): Promise<void> {
  await drizzleDb.delete(sourceChunkEmbeddings).where(eq(sourceChunkEmbeddings.factSheetId, ruleId))
  console.log(`[embedding-service] Deleted embeddings for rule ${ruleId}`)
}

/**
 * Get embedding statistics for monitoring.
 */
export async function getEmbeddingStats(): Promise<{
  totalChunks: number
  rulesWithEmbeddings: number
  publishedRulesWithoutEmbeddings: number
}> {
  // Count total chunks
  const chunks = await drizzleDb.select().from(sourceChunkEmbeddings)
  const totalChunks = chunks.length

  // Count unique rules with embeddings
  const uniqueRules = new Set(chunks.map((c) => c.factSheetId))
  const rulesWithEmbeddings = uniqueRules.size

  // Count published rules without embeddings
  const publishedRules = await db.regulatoryRule.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true },
  })

  const publishedRulesWithoutEmbeddings = publishedRules.filter(
    (r) => !uniqueRules.has(r.id)
  ).length

  return {
    totalChunks,
    rulesWithEmbeddings,
    publishedRulesWithoutEmbeddings,
  }
}
