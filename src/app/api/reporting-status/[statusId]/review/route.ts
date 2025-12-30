import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import {
  approveReportingStatus,
  rejectReportingStatus,
  requestReportingReview,
} from "@/lib/reporting/status-service"
import { db } from "@/lib/db"

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

export async function POST(req: NextRequest, { params }: { params: { statusId: string } }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const body = await req.json()

  const action = body.action as string
  const notes = typeof body.notes === "string" ? body.notes : null
  const reason = typeof body.reason === "string" ? body.reason : undefined

  try {
    if (action === "request") {
      await requestReportingReview({
        companyId: company.id,
        statusId: params.statusId,
        actorId: user.id!,
        reason,
        notes,
      })
      const status = await fetchStatusSummary(params.statusId, company.id)
      return NextResponse.json({ status })
    }

    if (action === "approve") {
      await approveReportingStatus({
        companyId: company.id,
        statusId: params.statusId,
        actorId: user.id!,
        reason,
        notes,
      })
      const status = await fetchStatusSummary(params.statusId, company.id)
      return NextResponse.json({ status })
    }

    if (action === "reject") {
      await rejectReportingStatus({
        companyId: company.id,
        statusId: params.statusId,
        actorId: user.id!,
        reason,
        notes,
      })
      const status = await fetchStatusSummary(params.statusId, company.id)
      return NextResponse.json({ status })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update status"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
