// src/lib/article-agent/steps/verify.ts

import { db } from "@/lib/db"
import { embedText } from "../verification/embedder"
import { findSimilarChunks } from "../verification/similarity"
import { classifyParagraphAgainstChunks } from "../verification/classifier"
import { aggregateConfidence, needsHumanReview } from "../utils/confidence"
import type { ArticleJob } from "@prisma/client"
import type { VerificationResult, ParagraphVerification } from "../types"

export async function verifyDraft(job: ArticleJob): Promise<VerificationResult> {
  const draft = await db.articleDraft.findFirst({
    where: { jobId: job.id, iteration: job.currentIteration },
    include: { paragraphs: { orderBy: { index: "asc" } } },
  })

  if (!draft) {
    throw new Error("No draft found for current iteration")
  }

  const paragraphVerifications: ParagraphVerification[] = []

  for (const para of draft.paragraphs) {
    // Skip already locked paragraphs
    if (para.isLocked) {
      paragraphVerifications.push({
        index: para.index,
        content: para.content,
        isLocked: true,
        confidence: para.confidence || 1.0,
        status: "SUPPORTED",
        supportingClaims: [],
      })
      continue
    }

    // 1. Embed paragraph
    const embedding = await embedText(para.content)

    // 2. Find similar source chunks
    const similarChunks = await findSimilarChunks(embedding, job.factSheetId!, 5)

    // 3. Classify each chunk's support
    const classifications = await classifyParagraphAgainstChunks(para.content, similarChunks)

    // 4. Aggregate confidence
    const { confidence, status, hasCriticalIssue } = aggregateConfidence(
      classifications.map((c) => ({
        similarity: c.similarity,
        relationship: c.classification.relationship,
        confidence: c.classification.confidence,
      }))
    )

    // 5. Update paragraph in DB
    const supportingClaimIds = classifications
      .filter((c) => c.classification.relationship === "SUPPORTED")
      .flatMap((c) => c.claimIds)

    await db.draftParagraph.update({
      where: { id: para.id },
      data: {
        confidence,
        supportingClaimIds,
      },
    })

    // 6. Store verification records
    for (const c of classifications) {
      for (const claimId of c.claimIds) {
        await db.claimVerification.upsert({
          where: { paragraphId_claimId: { paragraphId: para.id, claimId } },
          create: {
            paragraphId: para.id,
            claimId,
            similarityScore: c.similarity,
            isSupporting: c.classification.relationship === "SUPPORTED",
          },
          update: {
            similarityScore: c.similarity,
            isSupporting: c.classification.relationship === "SUPPORTED",
          },
        })
      }
    }

    paragraphVerifications.push({
      index: para.index,
      content: para.content,
      isLocked: false,
      confidence,
      status,
      supportingClaims: classifications.map((c) => ({
        claimId: c.claimIds[0] || "",
        statement: similarChunks.find((s) => s.id === c.chunkId)?.content.slice(0, 100) || "",
        similarity: c.similarity,
        relationship: c.classification.relationship,
      })),
    })
  }

  // Calculate overall stats
  const passCount = paragraphVerifications.filter((p) => p.confidence >= 0.8).length
  const failCount = paragraphVerifications.filter((p) => p.confidence < 0.8).length
  const overallConfidence =
    paragraphVerifications.reduce((sum, p) => sum + p.confidence, 0) / paragraphVerifications.length

  return {
    draftId: draft.id,
    iteration: draft.iteration,
    paragraphs: paragraphVerifications,
    overallConfidence,
    passCount,
    failCount,
    allParagraphsPass: failCount === 0,
    anyBelowThreshold: failCount > 0,
    anyCriticalFail: paragraphVerifications.some((p) => needsHumanReview(p.confidence)),
  }
}
