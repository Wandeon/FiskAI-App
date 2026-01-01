import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { withApiLogging } from "@/lib/api-logging"
import { logger } from "@/lib/logger"
import { updateContext } from "@/lib/context"
import { db } from "@/lib/db"
import { getUsageLimits } from "@/lib/ai/rate-limiter"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export const GET = withApiLogging(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  updateContext({ userId: session.user.id })

  try {
    // Get company ID
    const companyUser = await db.companyUser.findFirst({
      where: { userId: session.user.id, isDefault: true },
      include: { company: true },
    })

    if (!companyUser?.company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const companyId = companyUser.company.id
    updateContext({ companyId })

    // Get usage and limits
    const usageData = await getUsageLimits(companyId)

    return NextResponse.json(usageData)
  } catch (error) {
    logger.error({ error }, "AI usage fetch error")
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch usage" },
      { status: 500 }
    )
  }
})
