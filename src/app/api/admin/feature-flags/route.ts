import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import { listFlags, createFlag, getFlagStats } from "@/lib/feature-flags"
import {
  parseQuery,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import { featureFlagQuerySchema, createFeatureFlagSchema } from "../_schemas"

/**
 * GET /api/admin/feature-flags
 *
 * List all feature flags with optional filters
 */
export async function GET(request: NextRequest) {
  await requireAdmin()

  try {
    const { searchParams } = new URL(request.url)
    const filters = parseQuery(searchParams, featureFlagQuerySchema)

    const [flags, stats] = await Promise.all([listFlags(filters), getFlagStats()])

    return NextResponse.json({ flags, stats })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}

/**
 * POST /api/admin/feature-flags
 *
 * Create a new feature flag
 */
export async function POST(request: NextRequest) {
  const user = await requireAdmin()

  try {
    const data = await parseBody(request, createFeatureFlagSchema)

    const flag = await createFlag(data, user.id!)
    return NextResponse.json(flag, { status: 201 })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A flag with this key already exists" }, { status: 409 })
    }
    throw error
  }
}
