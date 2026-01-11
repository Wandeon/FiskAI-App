// src/app/api/admin/regulatory-truth/status/route.ts

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { getRegulatoryPipelineStatus } from "@/lib/admin/regulatory-status"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

/**
 * GET /api/admin/regulatory-truth/status
 *
 * Returns pipeline health status for monitoring dashboard.
 *
 * Authorization: Requires ADMIN system role.
 * Returns 401 for unauthenticated requests.
 * Returns 403 for authenticated non-admin users.
 */
export async function GET(_request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin role
    if (user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch pipeline status using shared function
    const status = await getRegulatoryPipelineStatus()

    return NextResponse.json(status)
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[status] Error fetching pipeline status:", error)
    return NextResponse.json({ error: "Failed to fetch pipeline status" }, { status: 500 })
  }
}
