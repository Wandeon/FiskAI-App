import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { closeCashDay } from "@/lib/cash/cash-service"
import { logServiceBoundarySnapshot } from "@/lib/audit-hooks"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

const closeDaySchema = z.object({
  businessDate: z.string().transform((s) => new Date(s)),
  note: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const companyId = company.id

  try {
    const input = await parseBody(request, closeDaySchema)

    const dayClose = await closeCashDay({
      companyId,
      businessDate: input.businessDate,
      note: input.note,
    })

    await logServiceBoundarySnapshot({
      companyId,
      userId: user.id!,
      actor: user.id!,
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
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Failed to close cash day:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to close cash day" },
      { status: 500 }
    )
  }
}
