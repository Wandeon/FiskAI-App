import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { reportPayout } from "@/lib/payroll/payout-service"
import { logServiceBoundarySnapshot } from "@/lib/audit-hooks"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: payoutId } = await params

  try {
    const payout = await db.payout.findUnique({
      where: { id: payoutId },
      select: { id: true, companyId: true, status: true },
    })

    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 })
    }

    if (payout.status !== "LOCKED") {
      return NextResponse.json(
        {
          error: `Cannot report payout: current status is ${payout.status}. Must be LOCKED first.`,
        },
        { status: 400 }
      )
    }

    const updated = await reportPayout(payoutId, session.user.id)

    await logServiceBoundarySnapshot({
      companyId: payout.companyId,
      userId: session.user.id,
      actor: session.user.id,
      reason: "Mark payout as reported to tax authority",
      action: "UPDATE",
      entity: "Payout",
      entityId: payoutId,
      before: { status: "LOCKED" },
      after: { status: "REPORTED", reportedAt: updated.reportedAt },
    })

    return NextResponse.json({ success: true, payout: updated })
  } catch (error) {
    console.error("Failed to report payout:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to report payout" },
      { status: 500 }
    )
  }
}
