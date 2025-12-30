import type {
  ReviewDecision,
  ReviewDecisionType,
  ReviewQueueItem,
  ReviewQueueEntityType,
  ReviewQueuePriority,
  ReviewQueueStatus,
} from "@prisma/client"
import { db } from "@/lib/db"
import { logServiceBoundarySnapshot } from "@/lib/audit-hooks"
import { runWithAuditContext } from "@/lib/audit-context"

export interface ReviewQueueInput {
  companyId: string
  entityType: ReviewQueueEntityType
  entityId: string
  priority?: ReviewQueuePriority
  requestedById?: string | null
  dueAt?: Date | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
  reason?: string | null
}

export async function createReviewQueueItem(input: ReviewQueueInput): Promise<ReviewQueueItem> {
  const review = await runWithAuditContext(
    { actorId: input.requestedById ?? undefined, reason: input.reason ?? "review_request" },
    async () =>
      db.reviewQueueItem.create({
        data: {
          companyId: input.companyId,
          entityType: input.entityType,
          entityId: input.entityId,
          priority: input.priority ?? "NORMAL",
          requestedById: input.requestedById ?? null,
          dueAt: input.dueAt ?? null,
          notes: input.notes ?? null,
          metadata: input.metadata ?? undefined,
        },
      })
  )

  await logServiceBoundarySnapshot({
    companyId: input.companyId,
    userId: input.requestedById ?? null,
    actor: input.requestedById ?? null,
    reason: input.reason ?? "review_request",
    action: "CREATE",
    entity: "ReviewQueueItem",
    entityId: review.id,
    after: {
      entityType: review.entityType,
      entityId: review.entityId,
      priority: review.priority,
      status: review.status,
      dueAt: review.dueAt,
    },
  })

  return review
}

export async function assignReviewQueueItem(
  reviewId: string,
  actorId: string,
  assignedToId: string,
  reason: string
): Promise<ReviewQueueItem> {
  const before = await db.reviewQueueItem.findUnique({ where: { id: reviewId } })
  if (!before) {
    throw new Error("Review queue item not found")
  }

  const updated = await runWithAuditContext({ actorId, reason }, async () =>
    db.reviewQueueItem.update({
      where: { id: reviewId },
      data: {
        assignedToId,
        assignedAt: new Date(),
        status: "IN_PROGRESS",
      },
    })
  )

  await logServiceBoundarySnapshot({
    companyId: updated.companyId,
    userId: actorId,
    actor: actorId,
    reason,
    action: "UPDATE",
    entity: "ReviewQueueItem",
    entityId: updated.id,
    before: {
      assignedToId: before.assignedToId,
      status: before.status,
    },
    after: {
      assignedToId: updated.assignedToId,
      status: updated.status,
    },
  })

  return updated
}

export async function completeReviewQueueItem(options: {
  reviewId: string
  companyId: string
  actorId: string
  decision: ReviewDecisionType
  notes?: string | null
  reason?: string | null
}): Promise<{ review: ReviewQueueItem; decision: ReviewDecision }> {
  const before = await db.reviewQueueItem.findUnique({ where: { id: options.reviewId } })
  if (!before || before.companyId !== options.companyId) {
    throw new Error("Review queue item not found")
  }

  const [review, decision] = await runWithAuditContext(
    { actorId: options.actorId, reason: options.reason ?? "review_decision" },
    async () =>
      db.$transaction(async (tx) => {
        const updated = await tx.reviewQueueItem.update({
          where: { id: options.reviewId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            completedById: options.actorId,
          },
        })

        const decisionRecord = await tx.reviewDecision.create({
          data: {
            companyId: options.companyId,
            reviewId: options.reviewId,
            decision: options.decision,
            notes: options.notes ?? null,
            decidedById: options.actorId,
          },
        })

        return [updated, decisionRecord] as const
      })
  )

  await logServiceBoundarySnapshot({
    companyId: options.companyId,
    userId: options.actorId,
    actor: options.actorId,
    reason: options.reason ?? "review_decision",
    action: "UPDATE",
    entity: "ReviewQueueItem",
    entityId: review.id,
    before: {
      status: before.status,
      completedAt: before.completedAt,
      completedById: before.completedById,
    },
    after: {
      status: review.status,
      completedAt: review.completedAt,
      completedById: review.completedById,
      decision: options.decision,
    },
  })

  return { review, decision }
}

export async function getPendingReviewQueue(options: {
  companyId: string
  status?: ReviewQueueStatus
  entityType?: ReviewQueueEntityType
}): Promise<ReviewQueueItem[]> {
  return db.reviewQueueItem.findMany({
    where: {
      companyId: options.companyId,
      status: options.status ?? "PENDING",
      entityType: options.entityType,
    },
    orderBy: [{ priority: "desc" }, { requestedAt: "asc" }],
  })
}
