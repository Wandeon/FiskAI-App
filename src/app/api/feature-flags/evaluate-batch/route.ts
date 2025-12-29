import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { evaluateFlags } from "@/lib/feature-flags"

/**
 * GET /api/feature-flags/evaluate-batch?keys=flag1&keys=flag2&keys=flag3
 *
 * Evaluates multiple feature flags at once for the current user/company context.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keys = searchParams.getAll("keys")

  if (keys.length === 0) {
    return NextResponse.json({ error: "Missing 'keys' parameter" }, { status: 400 })
  }

  // Build context from session
  const user = await getCurrentUser()
  const company = user ? await getCurrentCompany(user.id!) : null

  const results = await evaluateFlags(keys, {
    userId: user?.id,
    companyId: company?.id,
  })

  return NextResponse.json(results)
}
