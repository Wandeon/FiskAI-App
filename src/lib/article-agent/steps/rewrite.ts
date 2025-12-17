// src/lib/article-agent/steps/rewrite.ts

import { db } from "@/lib/db"
import { callOllama } from "../llm/ollama-client"
import { REWRITE_SYSTEM, REWRITE_PROMPT } from "../prompts/rewriting"
import { shouldLock } from "../utils/confidence"
import type { ArticleJob } from "@prisma/client"
import type { VerificationResult } from "../types"

export async function rewriteFailingParagraphs(
  job: ArticleJob,
  verification: VerificationResult
): Promise<string> {
  // 1. Get current draft
  const currentDraft = await db.articleDraft.findFirst({
    where: { jobId: job.id, iteration: job.currentIteration },
    include: { paragraphs: { orderBy: { index: "asc" } } },
  })

  if (!currentDraft) {
    throw new Error("No current draft found")
  }

  // 2. Lock passing paragraphs
  for (const para of verification.paragraphs) {
    if (shouldLock(para.confidence) && !para.isLocked) {
      await db.draftParagraph.update({
        where: { draftId_index: { draftId: currentDraft.id, index: para.index } },
        data: { isLocked: true },
      })
    }
  }

  // 3. Get claims for rewriting
  const claims = await db.claim.findMany({
    where: { factSheetId: job.factSheetId! },
  })

  const claimsText = claims.map((c) => `- [${c.category}] ${c.statement}`).join("\n")

  // 4. Rewrite failing paragraphs
  const newParagraphs: string[] = []

  for (const para of currentDraft.paragraphs) {
    const verificationData = verification.paragraphs.find((v) => v.index === para.index)

    if (para.isLocked || (verificationData && shouldLock(verificationData.confidence))) {
      // Keep locked/passing paragraphs as-is
      newParagraphs.push(para.content)
    } else {
      // Rewrite failing paragraph
      const prompt = REWRITE_PROMPT.replace("{paragraph}", para.content).replace(
        "{claims}",
        claimsText
      )

      const rewritten = await callOllama(prompt, {
        systemPrompt: REWRITE_SYSTEM,
        temperature: 0.3,
        maxTokens: 1000,
      })

      newParagraphs.push(rewritten.trim() || para.content)
    }
  }

  // 5. Create new draft with incremented iteration
  const newIteration = job.currentIteration + 1
  const newContentMdx = newParagraphs.join("\n\n")

  const newDraft = await db.articleDraft.create({
    data: {
      jobId: job.id,
      iteration: newIteration,
      contentMdx: newContentMdx,
    },
  })

  // 6. Create paragraph records (carry over lock status)
  for (let i = 0; i < newParagraphs.length; i++) {
    const oldPara = currentDraft.paragraphs[i]
    const wasLocked = oldPara?.isLocked || shouldLock(verification.paragraphs[i]?.confidence || 0)

    await db.draftParagraph.create({
      data: {
        draftId: newDraft.id,
        index: i,
        content: newParagraphs[i],
        isLocked: wasLocked,
        confidence: wasLocked ? oldPara?.confidence || 1.0 : null,
      },
    })
  }

  // 7. Update job iteration
  await db.articleJob.update({
    where: { id: job.id },
    data: { currentIteration: newIteration },
  })

  return newDraft.id
}
