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

    // Chunk 1: Rule title + explanation
    const ruleContent = `${rule.titleHr}\n\n${rule.explanationHr || ""}`
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
          sourceUrl: pointer.lawReference || pointer.evidence.url,
          content: evidenceSnippet,
        })
      }
    }

    // Generate embeddings in batch
    const contents = chunks.map((c) => c.content)
    const embeddings = await embedBatch(contents)

    // Delete existing embeddings for this rule (incremental update)
    await drizzleDb
      .delete(sourceChunkEmbeddings)
      .where(eq(sourceChunkEmbeddings.factSheetId, ruleId))

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
 * Uses database-level aggregation to avoid loading full table into memory.
 */
export async function getEmbeddingStats(): Promise<{
  totalChunks: number
  rulesWithEmbeddings: number
  publishedRulesWithoutEmbeddings: number
}> {
  // Use database aggregation instead of loading all rows
  const [totalChunksResult, rulesWithEmbeddingsResult] = await Promise.all([
    // COUNT(*) for total chunks
    drizzleDb.select({ count: count() }).from(sourceChunkEmbeddings),
    // COUNT(DISTINCT factSheetId) for unique rules with embeddings
    drizzleDb
      .select({ count: countDistinct(sourceChunkEmbeddings.factSheetId) })
      .from(sourceChunkEmbeddings),
  ])

  const totalChunks = Number(totalChunksResult[0]?.count ?? 0)
  const rulesWithEmbeddings = Number(rulesWithEmbeddingsResult[0]?.count ?? 0)

  // Get IDs of rules that have embeddings (only IDs, not full rows)
  const rulesWithEmbeddingsIds = await drizzleDb
    .selectDistinct({ factSheetId: sourceChunkEmbeddings.factSheetId })
    .from(sourceChunkEmbeddings)

  const embeddedRuleIds = rulesWithEmbeddingsIds.map((r) => r.factSheetId)

  // Count published rules that don't have embeddings using Prisma count()
  // Use NOT IN query if there are embedded rules, otherwise count all published
  const publishedRulesWithoutEmbeddings =
    embeddedRuleIds.length > 0
      ? await db.regulatoryRule.count({
          where: {
            status: "PUBLISHED",
            id: { notIn: embeddedRuleIds },
          },
        })
      : await db.regulatoryRule.count({
          where: { status: "PUBLISHED" },
        })

  return {
    totalChunks,
    rulesWithEmbeddings,
    publishedRulesWithoutEmbeddings,
  }
}
