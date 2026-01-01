import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import {
  approveReportingStatus,
  rejectReportingStatus,
  requestReportingReview,
} from "@/lib/reporting/status-service"
import { db } from "@/lib/db"
import {
  parseBody,
  parseParams,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"

const paramsSchema = z.object({
  statusId: z.string().min(1),
})

const reviewBodySchema = z.object({
  action: z.enum(["request", "approve", "reject"]),
  notes: z.string().nullable().optional(),
  reason: z.string().optional(),
})

async function fetchStatusSummary(statusId: string, companyId: string) {
  const status = await db.reportingStatus.findFirst({
    where: { id: statusId, companyId },
    include: { reviewQueueItem: { select: { status: true } } },
  })

  if (!status) {
    throw new Error("Reporting status not found")
  }

  return {
    id: status.id,
    reportType: status.reportType,
    status: status.status,
    updatedAt: status.updatedAt,
    reviewStatus: status.reviewQueueItem?.status ?? null,
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ statusId: string }> }
) {
  try {
    const resolvedParams = await params
    const { statusId } = parseParams(resolvedParams, paramsSchema)
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    const body = await parseBody(req, reviewBodySchema)

    const { action, notes, reason } = body
    const notesValue = notes ?? null

    if (action === "request") {
      await requestReportingReview({
        companyId: company.id,
        statusId,
        actorId: user.id!,
        reason,
        notes: notesValue,
      })
      const status = await fetchStatusSummary(statusId, company.id)
      return NextResponse.json({ status })
    }

    if (action === "approve") {
      await approveReportingStatus({
        companyId: company.id,
        statusId: statusId,
        actorId: user.id!,
        reason,
        notes: notesValue,
      })
      const status = await fetchStatusSummary(statusId, company.id)
      return NextResponse.json({ status })
    }

    if (action === "reject") {
      await rejectReportingStatus({
        companyId: company.id,
        statusId: statusId,
        actorId: user.id!,
        reason,
        notes: notesValue,
      })
      const status = await fetchStatusSummary(statusId, company.id)
      return NextResponse.json({ status })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Failed to update status"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
