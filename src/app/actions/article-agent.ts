"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { createArticleJob, runArticleJob } from "@/lib/article-agent/orchestrator"
import { publishArticle } from "@/lib/article-agent/steps/publish"
import { requireAuth } from "@/lib/auth-utils"
import type { ArticleType } from "@prisma/client"

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Create a new article generation job
 */
export async function createJob(input: {
  type: ArticleType
  sourceUrls: string[]
  topic?: string
  maxIterations?: number
}): Promise<ActionResult<{ jobId: string }>> {
  try {
    await requireAuth()

    if (!input.sourceUrls || input.sourceUrls.length === 0) {
      return { success: false, error: "At least one source URL is required" }
    }

    const job = await createArticleJob({
      type: input.type,
      sourceUrls: input.sourceUrls,
      topic: input.topic,
      maxIterations: input.maxIterations,
    })

    revalidatePath("/article-agent")

    return { success: true, data: { jobId: job.id } }
  } catch (error) {
    console.error("Failed to create article job:", error)
    return { success: false, error: "Failed to create article job" }
  }
}

/**
 * Start processing an article job
 */
export async function startJob(jobId: string): Promise<ActionResult> {
  try {
    await requireAuth()

    const job = await db.articleJob.findUnique({ where: { id: jobId } })

    if (!job) {
      return { success: false, error: "Job not found" }
    }

    // Run in background (don't await)
    runArticleJob(jobId).catch((error) => {
      console.error(`Job ${jobId} failed:`, error)
      db.articleJob
        .update({
          where: { id: jobId },
          data: { status: "REJECTED" },
        })
        .catch(console.error)
    })

    revalidatePath("/article-agent")
    revalidatePath(`/article-agent/${jobId}`)

    return { success: true }
  } catch (error) {
    console.error("Failed to start job:", error)
    return { success: false, error: "Failed to start job" }
  }
}

/**
 * Get job status and basic info
 */
export async function getJobStatus(jobId: string): Promise<ActionResult> {
  try {
    await requireAuth()

    const job = await db.articleJob.findUnique({
      where: { id: jobId },
      include: {
        drafts: {
          orderBy: { iteration: "desc" },
          take: 1,
          include: { paragraphs: true },
        },
      },
    })

    if (!job) {
      return { success: false, error: "Job not found" }
    }

    return { success: true, data: job }
  } catch (error) {
    console.error("Failed to get job status:", error)
    return { success: false, error: "Failed to get job status" }
  }
}

/**
 * Get job with full verification data
 */
export async function getJobWithVerification(jobId: string) {
  await requireAuth()

  const job = await db.articleJob.findUnique({
    where: { id: jobId },
    include: {
      factSheet: {
        include: { claims: true },
      },
      drafts: {
        orderBy: { iteration: "desc" },
        take: 1,
        include: {
          paragraphs: {
            orderBy: { index: "asc" },
            include: {
              verifications: {
                include: {
                  claim: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!job) {
    throw new Error("Job not found")
  }

  return { job, draft: job.drafts[0], factSheet: job.factSheet }
}

/**
 * Get list of all article jobs
 */
export async function getJobs(options?: {
  status?: string
  type?: ArticleType
  cursor?: string
  limit?: number
}): Promise<ActionResult> {
  try {
    await requireAuth()

    const limit = Math.min(options?.limit ?? 20, 100)

    const jobs = await db.articleJob.findMany({
      where: {
        ...(options?.status && { status: options.status as any }),
        ...(options?.type && { type: options.type }),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(options?.cursor && { cursor: { id: options.cursor }, skip: 1 }),
    })

    const hasMore = jobs.length > limit
    const items = hasMore ? jobs.slice(0, -1) : jobs
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    return { success: true, data: { items, nextCursor, hasMore } }
  } catch (error) {
    console.error("Failed to get jobs:", error)
    return { success: false, error: "Failed to get jobs" }
  }
}

/**
 * Approve a job and mark it ready for publishing
 */
export async function approveJob(jobId: string): Promise<ActionResult> {
  try {
    await requireAuth()

    const job = await db.articleJob.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return { success: false, error: "Job not found" }
    }

    if (job.status !== "NEEDS_REVIEW" && job.status !== "APPROVED") {
      return { success: false, error: "Job must be in review state to approve" }
    }

    await db.articleJob.update({
      where: { id: jobId },
      data: { status: "APPROVED" },
    })

    revalidatePath("/article-agent")
    revalidatePath(`/article-agent/${jobId}`)

    return { success: true }
  } catch (error) {
    console.error("Failed to approve job:", error)
    return { success: false, error: "Failed to approve job" }
  }
}

/**
 * Publish an approved job
 *
 * For NEWS type: Creates entry in news_posts table
 * For other types: Creates MDX file in appropriate content directory
 */
export async function publishJob(jobId: string): Promise<
  ActionResult<{
    slug: string
    publishedAt: string
    destination: string
  }>
> {
  try {
    await requireAuth()

    const job = await db.articleJob.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return { success: false, error: "Job not found" }
    }

    if (job.status !== "APPROVED") {
      return { success: false, error: "Job must be approved before publishing" }
    }

    const result = await publishArticle(job)

    revalidatePath("/article-agent")
    revalidatePath(`/article-agent/${jobId}`)
    revalidatePath("/vijesti")

    return {
      success: true,
      data: {
        slug: result.slug,
        publishedAt: result.publishedAt.toISOString(),
        destination: result.destination,
      },
    }
  } catch (error) {
    console.error("Failed to publish job:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to publish job",
    }
  }
}

/**
 * Reject a job
 */
export async function rejectJob(jobId: string, reason?: string): Promise<ActionResult> {
  try {
    await requireAuth()

    const job = await db.articleJob.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return { success: false, error: "Job not found" }
    }

    await db.articleJob.update({
      where: { id: jobId },
      data: { status: "REJECTED" },
    })

    revalidatePath("/article-agent")
    revalidatePath(`/article-agent/${jobId}`)

    return { success: true }
  } catch (error) {
    console.error("Failed to reject job:", error)
    return { success: false, error: "Failed to reject job" }
  }
}

/**
 * Lock a specific paragraph to prevent rewriting
 */
export async function lockParagraph(jobId: string, paragraphIndex: number): Promise<ActionResult> {
  try {
    await requireAuth()

    const job = await db.articleJob.findUnique({
      where: { id: jobId },
      include: {
        drafts: {
          orderBy: { iteration: "desc" },
          take: 1,
        },
      },
    })

    if (!job?.drafts[0]) {
      return { success: false, error: "No draft found" }
    }

    await db.draftParagraph.update({
      where: {
        draftId_index: {
          draftId: job.drafts[0].id,
          index: paragraphIndex,
        },
      },
      data: { isLocked: true },
    })

    revalidatePath(`/article-agent/${jobId}`)

    return { success: true }
  } catch (error) {
    console.error("Failed to lock paragraph:", error)
    return { success: false, error: "Failed to lock paragraph" }
  }
}

/**
 * Unlock a specific paragraph to allow rewriting
 */
export async function unlockParagraph(
  jobId: string,
  paragraphIndex: number
): Promise<ActionResult> {
  try {
    await requireAuth()

    const job = await db.articleJob.findUnique({
      where: { id: jobId },
      include: {
        drafts: {
          orderBy: { iteration: "desc" },
          take: 1,
        },
      },
    })

    if (!job?.drafts[0]) {
      return { success: false, error: "No draft found" }
    }

    await db.draftParagraph.update({
      where: {
        draftId_index: {
          draftId: job.drafts[0].id,
          index: paragraphIndex,
        },
      },
      data: { isLocked: false },
    })

    revalidatePath(`/article-agent/${jobId}`)

    return { success: true }
  } catch (error) {
    console.error("Failed to unlock paragraph:", error)
    return { success: false, error: "Failed to unlock paragraph" }
  }
}

/**
 * Trigger a rewrite iteration for a job
 */
export async function triggerRewrite(jobId: string): Promise<ActionResult> {
  try {
    await requireAuth()

    const job = await db.articleJob.findUnique({ where: { id: jobId } })

    if (!job) {
      return { success: false, error: "Job not found" }
    }

    if (job.currentIteration >= job.maxIterations) {
      return { success: false, error: "Max iterations reached" }
    }

    // Update status to trigger rewrite
    await db.articleJob.update({
      where: { id: jobId },
      data: { status: "DRAFTING" },
    })

    // Run job in background
    runArticleJob(jobId).catch((error) => {
      console.error(`Job ${jobId} rewrite failed:`, error)
      db.articleJob
        .update({
          where: { id: jobId },
          data: { status: "NEEDS_REVIEW" },
        })
        .catch(console.error)
    })

    revalidatePath(`/article-agent/${jobId}`)

    return { success: true }
  } catch (error) {
    console.error("Failed to trigger rewrite:", error)
    return { success: false, error: "Failed to trigger rewrite" }
  }
}

/**
 * Delete a job and all related data
 */
export async function deleteJob(jobId: string): Promise<ActionResult> {
  try {
    await requireAuth()

    const job = await db.articleJob.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return { success: false, error: "Job not found" }
    }

    // Only allow deleting jobs that are not published
    if (job.status === "PUBLISHED") {
      return { success: false, error: "Cannot delete published jobs" }
    }

    await db.articleJob.delete({
      where: { id: jobId },
    })

    revalidatePath("/article-agent")

    return { success: true }
  } catch (error) {
    console.error("Failed to delete job:", error)
    return { success: false, error: "Failed to delete job" }
  }
}
