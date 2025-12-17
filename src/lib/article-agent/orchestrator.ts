// src/lib/article-agent/orchestrator.ts

import { db } from "@/lib/db"
import { synthesizeFactSheet } from "./steps/synthesize"
import { writeDraft } from "./steps/draft"
import { verifyDraft } from "./steps/verify"
import { rewriteFailingParagraphs } from "./steps/rewrite"
import type { ArticleJob, ArticleStatus } from "@prisma/client"
import { THRESHOLDS } from "./types"

async function updateStatus(jobId: string, status: ArticleStatus): Promise<void> {
  await db.articleJob.update({
    where: { id: jobId },
    data: { status, updatedAt: new Date() },
  })
}

export async function runArticleJob(jobId: string): Promise<ArticleJob> {
  let job = await db.articleJob.findUniqueOrThrow({ where: { id: jobId } })

  while (job.currentIteration < job.maxIterations) {
    switch (job.status) {
      case "SYNTHESIZING": {
        console.log(`[Job ${jobId}] Synthesizing fact sheet...`)
        await synthesizeFactSheet(job)
        await updateStatus(jobId, "DRAFTING")
        break
      }

      case "PLANNING": {
        // Planning step is optional - skip to drafting
        await updateStatus(jobId, "DRAFTING")
        break
      }

      case "DRAFTING": {
        console.log(`[Job ${jobId}] Writing draft (iteration ${job.currentIteration})...`)
        await writeDraft(job)
        await updateStatus(jobId, "VERIFYING")
        break
      }

      case "VERIFYING": {
        console.log(`[Job ${jobId}] Verifying draft...`)
        const result = await verifyDraft(job)

        console.log(
          `[Job ${jobId}] Verification: ${result.passCount} passed, ${result.failCount} failed, overall ${(result.overallConfidence * 100).toFixed(1)}%`
        )

        if (result.allParagraphsPass || result.overallConfidence >= THRESHOLDS.JOB_AUTO_APPROVE) {
          // All good - approve
          await updateStatus(jobId, "APPROVED")
          return db.articleJob.findUniqueOrThrow({ where: { id: jobId } })
        }

        if (result.anyCriticalFail) {
          // Critical failure - needs human
          await updateStatus(jobId, "NEEDS_REVIEW")
          return db.articleJob.findUniqueOrThrow({ where: { id: jobId } })
        }

        if (job.currentIteration >= job.maxIterations - 1) {
          // Max iterations - needs human
          await updateStatus(jobId, "NEEDS_REVIEW")
          return db.articleJob.findUniqueOrThrow({ where: { id: jobId } })
        }

        // Can iterate - rewrite failing paragraphs
        console.log(`[Job ${jobId}] Rewriting failing paragraphs...`)
        await rewriteFailingParagraphs(job, result)
        await updateStatus(jobId, "DRAFTING")
        break
      }

      case "APPROVED":
      case "PUBLISHED":
      case "REJECTED":
      case "NEEDS_REVIEW": {
        // Terminal states
        return job
      }
    }

    // Refresh job state
    job = await db.articleJob.findUniqueOrThrow({ where: { id: jobId } })
  }

  // Max iterations reached without resolution
  await updateStatus(jobId, "NEEDS_REVIEW")
  return db.articleJob.findUniqueOrThrow({ where: { id: jobId } })
}

export async function createArticleJob(input: {
  type: ArticleJob["type"]
  sourceUrls: string[]
  topic?: string
  maxIterations?: number
}): Promise<ArticleJob> {
  return db.articleJob.create({
    data: {
      type: input.type,
      sourceUrls: input.sourceUrls,
      topic: input.topic,
      maxIterations: input.maxIterations || THRESHOLDS.MAX_ITERATIONS,
      status: "SYNTHESIZING",
    },
  })
}
