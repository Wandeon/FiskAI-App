import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import { getRecentAuditLog } from "@/lib/feature-flags"

/**
 * GET /api/admin/feature-flags/audit
 *
 * Get recent audit log for all feature flags
 */
export async function GET(request: NextRequest) {
  await requireAdmin()
  const { searchParams } = new URL(request.url)

  const limit = parseInt(searchParams.get("limit") || "100", 10)
  const auditLog = await getRecentAuditLog(limit)

  return NextResponse.json({ auditLog })
}
