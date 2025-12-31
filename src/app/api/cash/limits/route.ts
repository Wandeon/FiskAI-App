import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { getCashLimitSetting, upsertCashLimitSetting } from "@/lib/cash/cash-service"

const updateLimitSchema = z.object({
  limitAmount: z.number().positive(),
  currency: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function GET() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const companyId = company.id

  try {
    const setting = await getCashLimitSetting(companyId)
    return NextResponse.json({
      setting: setting
        ? {
            id: setting.id,
            limitAmount: setting.limitAmount.toString(),
            currency: setting.currency,
            isActive: setting.isActive,
          }
        : null,
    })
  } catch (error) {
    console.error("Failed to get cash limit:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get limit" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const companyId = company.id

  try {
    const body = await request.json()
    const input = updateLimitSchema.parse(body)

    const setting = await upsertCashLimitSetting({
      companyId,
      limitAmount: input.limitAmount,
      currency: input.currency,
      isActive: input.isActive,
    })

    return NextResponse.json({
      success: true,
      setting: {
        id: setting.id,
        limitAmount: setting.limitAmount.toString(),
        currency: setting.currency,
        isActive: setting.isActive,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 })
    }
    console.error("Failed to update cash limit:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update limit" },
      { status: 500 }
    )
  }
}
