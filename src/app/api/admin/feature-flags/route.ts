import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import {
  listFlags,
  createFlag,
  getFlagStats,
  type FeatureFlagFilters,
} from "@/lib/feature-flags"

/**
 * GET /api/admin/feature-flags
 *
 * List all feature flags with optional filters
 */
export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  const { searchParams } = new URL(request.url)

  const filters: FeatureFlagFilters = {}
  const status = searchParams.get("status")
  const scope = searchParams.get("scope")
  const category = searchParams.get("category")
  const search = searchParams.get("search")

  if (status) filters.status = status as FeatureFlagFilters["status"]
  if (scope) filters.scope = scope as FeatureFlagFilters["scope"]
  if (category) filters.category = category
  if (search) filters.search = search

  const [flags, stats] = await Promise.all([listFlags(filters), getFlagStats()])

  return NextResponse.json({ flags, stats })
}

/**
 * POST /api/admin/feature-flags
 *
 * Create a new feature flag
 */
export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  const body = await request.json()

  const { key, name, description, scope, status, defaultValue, rolloutPercentage, category, tags } =
    body

  if (!key || !name) {
    return NextResponse.json({ error: "Key and name are required" }, { status: 400 })
  }

  // Validate key format
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return NextResponse.json(
      { error: "Key must be lowercase alphanumeric with underscores, starting with a letter" },
      { status: 400 }
    )
  }

  try {
    const flag = await createFlag(
      {
        key,
        name,
        description,
        scope,
        status,
        defaultValue,
        rolloutPercentage,
        category,
        tags,
      },
      user.id!
    )
    return NextResponse.json(flag, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A flag with this key already exists" }, { status: 409 })
    }
    throw error
  }
}
