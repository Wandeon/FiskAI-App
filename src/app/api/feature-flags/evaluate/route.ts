import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { evaluateFlag } from "@/lib/feature-flags"

/**
 * GET /api/feature-flags/evaluate?key=<flag_key>
 *
 * Evaluates a single feature flag for the current user/company context.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")

  if (!key) {
    return NextResponse.json({ error: "Missing 'key' parameter" }, { status: 400 })
  }

  // Build context from session
  const user = await getCurrentUser()
  const company = user ? await getCurrentCompany(user.id!) : null

  const result = await evaluateFlag(key, {
    userId: user?.id,
    companyId: company?.id,
  })

  return NextResponse.json({
    enabled: result.enabled,
    source: result.source,
  })
}
