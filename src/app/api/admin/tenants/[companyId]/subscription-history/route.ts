import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { parseParams, isValidationError, formatValidationError } from "@/lib/api/validation"
import { tenantParamsSchema } from "@/app/api/admin/_schemas"

type RouteContext = {
  params: Promise<{ companyId: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await requireAdmin()
    const { companyId } = parseParams(await context.params, tenantParamsSchema)

    // Get subscription changes from audit log
    const subscriptionLogs = await db.auditLog.findMany({
      where: {
        companyId,
        entity: "Company",
        entityId: companyId,
        OR: [{ action: "UPDATE" }, { action: "CREATE" }],
      },
      orderBy: { timestamp: "desc" },
      take: 100,
    })

    // Filter logs that have subscription-related changes
    const history = subscriptionLogs
      .filter((log) => {
        if (!log.changes) return false
        const changes = log.changes as any

        return (
          changes.subscriptionStatus ||
          changes.subscriptionPlan ||
          changes.subscriptionCurrentPeriodStart ||
          changes.subscriptionCurrentPeriodEnd ||
          changes.stripeSubscriptionId
        )
      })
      .map((log) => {
        const changes = log.changes as any

        return {
          id: log.id,
          timestamp: log.timestamp,
          action: log.action,
          changes: {
            status: changes.subscriptionStatus,
            plan: changes.subscriptionPlan,
            periodStart: changes.subscriptionCurrentPeriodStart,
            periodEnd: changes.subscriptionCurrentPeriodEnd,
            stripeId: changes.stripeSubscriptionId,
          },
          userId: log.userId,
        }
      })

    // Fetch user details
    const userIds = [...new Set(history.map((h) => h.userId).filter(Boolean) as string[])]
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    // Get current subscription info
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionCurrentPeriodStart: true,
        subscriptionCurrentPeriodEnd: true,
        stripeSubscriptionId: true,
      },
    })

    return NextResponse.json({
      current: company
        ? {
            status: company.subscriptionStatus,
            plan: company.subscriptionPlan,
            periodStart: company.subscriptionCurrentPeriodStart,
            periodEnd: company.subscriptionCurrentPeriodEnd,
            stripeId: company.stripeSubscriptionId,
          }
        : null,
      history: history.map((h) => ({
        ...h,
        user: h.userId
          ? {
              id: h.userId,
              email: userMap.get(h.userId)?.email || "Unknown",
              name: userMap.get(h.userId)?.name || null,
            }
          : null,
      })),
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Failed to fetch subscription history:", error)
    return NextResponse.json({ error: "Failed to fetch subscription history" }, { status: 500 })
  }
}
