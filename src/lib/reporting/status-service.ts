import type { ReportType, ReportingState, ReportingStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { logServiceBoundarySnapshot } from "@/lib/audit-hooks"
import { runWithAuditContext } from "@/lib/audit-context"
import { completeReviewQueueItem, createReviewQueueItem } from "@/lib/review-queue/service"

export const REPORTING_TYPES: ReportType[] = ["VAT", "PDV", "KPR", "PROFIT_LOSS", "BALANCE_SHEET"]

export async function ensureReportingStatuses(options: {
  companyId: string
  periodId: string
  actorId: string
  reason?: string
}): Promise<ReportingStatus[]> {
  const existing = await db.reportingStatus.findMany({
    where: { companyId: options.companyId, periodId: options.periodId },
  })

  const existingTypes = new Set(existing.map((status) => status.reportType))
  const missingTypes = REPORTING_TYPES.filter((type) => !existingTypes.has(type))

  if (missingTypes.length === 0) {
    return existing
  }

  const created = await runWithAuditContext(
    { actorId: options.actorId, reason: options.reason ?? "reporting_status_bootstrap" },
    async () =>
      db.reportingStatus.createMany({
        data: missingTypes.map((reportType) => ({
          companyId: options.companyId,
          periodId: options.periodId,
          reportType,
        })),
      })
  )

  if (created.count > 0) {
    await logServiceBoundarySnapshot({
      companyId: options.companyId,
      userId: options.actorId,
      actor: options.actorId,
      reason: options.reason ?? "reporting_status_bootstrap",
      action: "CREATE",
      entity: "ReportingStatus",
      entityId: options.periodId,
      after: {
        createdCount: created.count,
        periodId: options.periodId,
      },
    })
  }

  return db.reportingStatus.findMany({
    where: { companyId: options.companyId, periodId: options.periodId },
  })
}

export async function getReportingStatuses(options: {
  companyId: string
  periodId: string
}): Promise<ReportingStatus[]> {
  return db.reportingStatus.findMany({
    where: { companyId: options.companyId, periodId: options.periodId },
    orderBy: { reportType: "asc" },
  })
}

export async function requestReportingReview(options: {
  companyId: string
  statusId: string
  actorId: string
  reason?: string
  notes?: string | null
}): Promise<ReportingStatus> {
  const status = await db.reportingStatus.findUnique({ where: { id: options.statusId } })
  if (!status || status.companyId !== options.companyId) {
    throw new Error("Reporting status not found")
  }

  if (status.status !== "DRAFT" || status.reviewQueueItemId) {
    return status
  }

  const review = await createReviewQueueItem({
    companyId: options.companyId,
    entityType: "REPORTING_STATUS",
    entityId: status.id,
    priority: "NORMAL",
    requestedById: options.actorId,
    notes: options.notes ?? null,
    reason: options.reason ?? "reporting_review_request",
  })

  const updated = await runWithAuditContext(
    { actorId: options.actorId, reason: options.reason ?? "reporting_review_request" },
    async () =>
      db.reportingStatus.update({
        where: { id: status.id },
        data: {
          status: "READY_FOR_REVIEW",
          reviewQueueItemId: review.id,
        },
      })
  )

  await logServiceBoundarySnapshot({
    companyId: options.companyId,
    userId: options.actorId,
    actor: options.actorId,
    reason: options.reason ?? "reporting_review_request",
    action: "UPDATE",
    entity: "ReportingStatus",
    entityId: updated.id,
    before: {
      status: status.status,
      reviewQueueItemId: status.reviewQueueItemId,
    },
    after: {
      status: updated.status,
      reviewQueueItemId: updated.reviewQueueItemId,
    },
  })

  return updated
}

export async function approveReportingStatus(options: {
  companyId: string
  statusId: string
  actorId: string
  reason?: string
  notes?: string | null
}): Promise<ReportingStatus> {
  const status = await db.reportingStatus.findUnique({ where: { id: options.statusId } })
  if (!status || status.companyId !== options.companyId) {
    throw new Error("Reporting status not found")
  }

  const updated = await runWithAuditContext(
    { actorId: options.actorId, reason: options.reason ?? "reporting_review_approve" },
    async () =>
      db.reportingStatus.update({
        where: { id: status.id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedById: options.actorId,
        },
      })
  )

  if (status.reviewQueueItemId) {
    await completeReviewQueueItem({
      reviewId: status.reviewQueueItemId,
      companyId: options.companyId,
      actorId: options.actorId,
      decision: "APPROVED",
      notes: options.notes ?? null,
      reason: options.reason ?? "reporting_review_approve",
    })
  }

  await logServiceBoundarySnapshot({
    companyId: options.companyId,
    userId: options.actorId,
    actor: options.actorId,
    reason: options.reason ?? "reporting_review_approve",
    action: "UPDATE",
    entity: "ReportingStatus",
    entityId: updated.id,
    before: {
      status: status.status,
      approvedAt: status.approvedAt,
      approvedById: status.approvedById,
    },
    after: {
      status: updated.status,
      approvedAt: updated.approvedAt,
      approvedById: updated.approvedById,
    },
  })

  return updated
}

export async function rejectReportingStatus(options: {
  companyId: string
  statusId: string
  actorId: string
  reason?: string
  notes?: string | null
}): Promise<ReportingStatus> {
  const status = await db.reportingStatus.findUnique({ where: { id: options.statusId } })
  if (!status || status.companyId !== options.companyId) {
    throw new Error("Reporting status not found")
  }

  const updated = await runWithAuditContext(
    { actorId: options.actorId, reason: options.reason ?? "reporting_review_reject" },
    async () =>
      db.reportingStatus.update({
        where: { id: status.id },
        data: {
          status: "REJECTED",
        },
      })
  )

  if (status.reviewQueueItemId) {
    await completeReviewQueueItem({
      reviewId: status.reviewQueueItemId,
      companyId: options.companyId,
      actorId: options.actorId,
      decision: "REJECTED",
      notes: options.notes ?? null,
      reason: options.reason ?? "reporting_review_reject",
    })
  }

  await logServiceBoundarySnapshot({
    companyId: options.companyId,
    userId: options.actorId,
    actor: options.actorId,
    reason: options.reason ?? "reporting_review_reject",
    action: "UPDATE",
    entity: "ReportingStatus",
    entityId: updated.id,
    before: {
      status: status.status,
    },
    after: {
      status: updated.status,
    },
  })

  return updated
}

export function isReportReadyForReview(status: ReportingState): boolean {
  return status === "READY_FOR_REVIEW"
}
