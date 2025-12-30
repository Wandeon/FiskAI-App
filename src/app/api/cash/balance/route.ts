import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getCashBalance, getCashLimitSetting } from "@/lib/cash/cash-service"
import { getCompanyId } from "@/lib/auth/company"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const companyId = await getCompanyId()
  if (!companyId) {
    return NextResponse.json({ error: "No company selected" }, { status: 400 })
  }

  try {
    const [balance, limitSetting] = await Promise.all([
      getCashBalance(companyId),
      getCashLimitSetting(companyId),
    ])

    return NextResponse.json({
      balance: balance.toString(),
      currency: "EUR",
      limit: limitSetting
        ? {
            amount: limitSetting.limitAmount.toString(),
            isActive: limitSetting.isActive,
            percentUsed: limitSetting.isActive
              ? balance.dividedBy(limitSetting.limitAmount).times(100).toFixed(1)
              : null,
          }
        : null,
    })
  } catch (error) {
    console.error("Failed to get cash balance:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get balance" },
      { status: 500 }
    )
  }
}
