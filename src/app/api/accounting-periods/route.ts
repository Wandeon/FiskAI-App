import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { PeriodType } from "@prisma/client"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { createAccountingPeriod, listAccountingPeriods } from "@/lib/period-locking/service"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

const createPeriodSchema = z.object({
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  periodType: z.nativeEnum(PeriodType),
  fiscalYear: z.number(),
  periodNumber: z.number().optional(),
  reason: z.string().optional(),
})

export async function GET() {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const periods = await listAccountingPeriods(company.id)
    return NextResponse.json({ periods })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const body = await parseBody(req, createPeriodSchema)

    const period = await createAccountingPeriod(
      company.id,
      {
        startDate: body.startDate,
        endDate: body.endDate,
        periodType: body.periodType,
        fiscalYear: body.fiscalYear,
        periodNumber: body.periodNumber,
      },
      user.id!,
      body.reason ?? "create_accounting_period"
    )

    return NextResponse.json({ period })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}
