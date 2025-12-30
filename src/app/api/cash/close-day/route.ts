import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { closeCashDay } from "@/lib/cash/cash-service"
import { getCompanyId } from "@/lib/auth/company"
import { logServiceBoundarySnapshot } from "@/lib/audit-hooks"

const closeDaySchema = z.object({
  businessDate: z.string().transform((s) => new Date(s)),
  note: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const companyId = await getCompanyId()
  if (!companyId) {
    return NextResponse.json({ error: "No company selected" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const input = closeDaySchema.parse(body)

    const dayClose = await closeCashDay({
      companyId,
      businessDate: input.businessDate,
      note: input.note,
    })

    await logServiceBoundarySnapshot({
      companyId,
      userId: session.user.id,
      actor: session.user.id,
      reason: `Close cash day for ${input.businessDate.toISOString().slice(0, 10)}`,
      action: "CREATE",
      entity: "CashDayClose",
      entityId: dayClose.id,
      after: {
        businessDate: dayClose.businessDate,
        openingBalance: dayClose.openingBalance.toString(),
        closingBalance: dayClose.closingBalance.toString(),
      },
    })

    return NextResponse.json({
      success: true,
      dayClose: {
        id: dayClose.id,
        businessDate: dayClose.businessDate,
        openingBalance: dayClose.openingBalance.toString(),
        totalIn: dayClose.totalIn.toString(),
        totalOut: dayClose.totalOut.toString(),
        closingBalance: dayClose.closingBalance.toString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    console.error("Failed to close cash day:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to close cash day" },
      { status: 500 }
    )
  }
}
