import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import {
  parseParams,
  parseQuery,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import { tenantParamsSchema, tenantActivityQuerySchema } from "@/app/api/admin/_schemas"

type RouteContext = {
  params: Promise<{ companyId: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await requireAdmin()
    const { companyId } = parseParams(await context.params, tenantParamsSchema)

    const { searchParams } = new URL(req.url)
    const query = parseQuery(searchParams, tenantActivityQuerySchema)
    const limit = query.limit
    const offset = (query.page - 1) * query.limit

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where: { companyId },
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
        include: {
          company: {
            select: {
              name: true,
            },
          },
        },
      }),
      db.auditLog.count({
        where: { companyId },
      }),
    ])

    // Fetch user details for logs with userId
    const userIds = [...new Set(logs.map((log) => log.userId).filter(Boolean) as string[])]
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        changes: log.changes,
        timestamp: log.timestamp,
        user: log.userId
          ? {
              id: log.userId,
              email: userMap.get(log.userId)?.email || "Unknown",
              name: userMap.get(log.userId)?.name || null,
            }
          : null,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
      })),
      total,
      hasMore: offset + logs.length < total,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Failed to fetch activity logs:", error)
    return NextResponse.json({ error: "Failed to fetch activity logs" }, { status: 500 })
  }
}
