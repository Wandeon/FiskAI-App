// src/lib/article-agent/steps/synthesize.ts

import { db } from "@/lib/db"
import { fetchUrls } from "../extraction/fetcher"
import { chunkText } from "../extraction/chunker"
import { extractClaimsFromChunk, extractKeyEntities } from "../extraction/claim-extractor"
import { embedText } from "../verification/embedder"
import { updateChunkEmbedding } from "../verification/similarity"
import type { ArticleJob } from "@prisma/client"

export async function synthesizeFactSheet(job: ArticleJob): Promise<string> {
  // 1. Fetch all source URLs
  const fetchedSources = await fetchUrls(job.sourceUrls)
  const successfulSources = fetchedSources.filter((s) => !s.error && s.content)

  if (successfulSources.length === 0) {
    throw new Error("No sources could be fetched successfully")
  }

  // 2. Create FactSheet
  const factSheet = await db.factSheet.create({
    data: {
      jobId: job.id,
      topic: job.topic || successfulSources[0].title || "Untitled",
      keyEntities: { names: [], dates: [], amounts: [], regulations: [] },
    },
  })

  // 3. Chunk each source and create SourceChunks
  const allClaims: Array<{
    statement: string
    quote: string | null
    sourceUrl: string
    category: string
    confidence: number
    sourceChunkId: string
  }> = []

  for (const source of successfulSources) {
    const chunks = chunkText(source.content)

    for (const chunk of chunks) {
      // Create chunk record
      const sourceChunk = await db.sourceChunk.create({
        data: {
          factSheetId: factSheet.id,
          sourceUrl: source.url,
          content: chunk.content,
        },
      })

      // Generate and store embedding
      try {
        const embedding = await embedText(chunk.content)
        await updateChunkEmbedding(sourceChunk.id, embedding)
      } catch (error) {
        console.error("Embedding failed for chunk:", sourceChunk.id, error)
      }

      // Extract claims from chunk
      const claims = await extractClaimsFromChunk(chunk.content, source.url)

      for (const claim of claims) {
        allClaims.push({
          ...claim,
          sourceChunkId: sourceChunk.id,
        })
      }
    }
  }

  // 4. Store all claims
  for (const claim of allClaims) {
    await db.claim.create({
      data: {
        factSheetId: factSheet.id,
        statement: claim.statement,
        quote: claim.quote,
        sourceUrl: claim.sourceUrl,
        sourceChunkId: claim.sourceChunkId,
        category: claim.category,
        confidence: claim.confidence,
      },
    })
  }

  // 5. Extract key entities from all claims
  const keyEntities = await extractKeyEntities(allClaims)

  await db.factSheet.update({
    where: { id: factSheet.id },
    data: { keyEntities },
  })

  // 6. Update job with factSheet reference
  await db.articleJob.update({
    where: { id: job.id },
    data: { factSheetId: factSheet.id },
  })

  return factSheet.id
}
