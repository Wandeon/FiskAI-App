import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  const { companyId } = await params

  const limitParam = Number(request.nextUrl.searchParams.get("limit") || 200)
  const limit = Math.min(Math.max(limitParam, 10), 1000)

  const logs = await db.auditLog.findMany({
    where: { companyId },
    orderBy: { timestamp: "desc" },
    take: limit,
  })

  const rows = [
    ["timestamp", "action", "entity", "entityId", "userId", "ipAddress", "userAgent"].join(","),
    ...logs.map((log) =>
      [
        log.timestamp.toISOString(),
        log.action,
        log.entity,
        log.entityId,
        log.userId ?? "",
        log.ipAddress ?? "",
        (log.userAgent ?? "").replace(/"/g, "'"),
      ].join(",")
    ),
  ].join("\n")

  return new NextResponse(rows, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${companyId}.csv"`,
    },
  })
}
