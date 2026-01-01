import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { lockAccountingPeriod, unlockAccountingPeriod } from "@/lib/period-locking/service"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

const lockPeriodSchema = z.object({
  periodId: z.string().min(1, "Period ID is required"),
  action: z.enum(["lock", "unlock"]).optional(),
  reason: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const body = await parseBody(req, lockPeriodSchema)
    const reason = body.reason ?? "period_lock_change"

    if (body.action === "unlock") {
      const period = await unlockAccountingPeriod(company.id, body.periodId, user.id!, reason)
      return NextResponse.json({ period })
    }

    const period = await lockAccountingPeriod(company.id, body.periodId, user.id!, reason)
    return NextResponse.json({ period })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}
