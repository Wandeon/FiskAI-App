import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import { getFlagById, createOverride, deleteOverride } from "@/lib/feature-flags"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/feature-flags/[id]/overrides
 *
 * Create an override for a feature flag
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin()
  const { id } = await params
  const body = await request.json()

  const flag = await getFlagById(id)
  if (!flag) {
    return NextResponse.json({ error: "Feature flag not found" }, { status: 404 })
  }

  const { companyId, userId, enabled, expiresAt } = body
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""

  if (enabled === undefined) {
    return NextResponse.json({ error: "enabled is required" }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 })
  }

  // Validate that at least one target is specified for non-global flags
  if (flag.scope !== "GLOBAL" && !companyId && !userId) {
    return NextResponse.json(
      { error: "Either companyId or userId is required for non-global flags" },
      { status: 400 }
    )
  }

  try {
    const override = await createOverride(
      {
        flagId: id,
        companyId,
        userId,
        enabled,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
      user.id!,
      reason
    )
    return NextResponse.json(override, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "An override for this target already exists" },
        { status: 409 }
      )
    }
    throw error
  }
}

/**
 * DELETE /api/admin/feature-flags/[id]/overrides
 *
 * Delete an override by overrideId (passed in body)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin()
  const { id } = await params
  const body = await request.json()

  const flag = await getFlagById(id)
  if (!flag) {
    return NextResponse.json({ error: "Feature flag not found" }, { status: 404 })
  }

  const { overrideId } = body
  if (!overrideId) {
    return NextResponse.json({ error: "overrideId is required" }, { status: 400 })
  }
  const deleteReason = typeof body.reason === "string" ? body.reason.trim() : ""
  if (!deleteReason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 })
  }

  // Verify override belongs to this flag
  const override = flag.overrides.find((o) => o.id === overrideId)
  if (!override) {
    return NextResponse.json({ error: "Override not found" }, { status: 404 })
  }

  await deleteOverride(overrideId, user.id!, deleteReason)
  return NextResponse.json({ success: true })
}
