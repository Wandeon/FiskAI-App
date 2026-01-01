import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth-utils"
import { getRecentAuditLog } from "@/lib/feature-flags"
import { parseQuery, isValidationError, formatValidationError } from "@/lib/api/validation"

const auditQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(1000).default(100),
})

/**
 * GET /api/admin/feature-flags/audit
 *
 * Get recent audit log for all feature flags
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)

    const { limit } = parseQuery(searchParams, auditQuerySchema)
    const auditLog = await getRecentAuditLog(limit)

    return NextResponse.json({ auditLog })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}
