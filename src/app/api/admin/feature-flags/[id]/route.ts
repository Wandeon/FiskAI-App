import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import { getFlagById, updateFlag, deleteFlag, getFlagAuditLog } from "@/lib/feature-flags"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/feature-flags/[id]
 *
 * Get a single feature flag with audit log
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  await requireAdmin()
  const { id } = await params

  const [flag, auditLog] = await Promise.all([getFlagById(id), getFlagAuditLog(id)])

  if (!flag) {
    return NextResponse.json({ error: "Feature flag not found" }, { status: 404 })
  }

  return NextResponse.json({ flag, auditLog })
}

/**
 * PATCH /api/admin/feature-flags/[id]
 *
 * Update a feature flag
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin()
  const { id } = await params
  const body = await request.json()

  const { name, description, scope, status, defaultValue, rolloutPercentage, category, tags, reason } =
    body

  const flag = await getFlagById(id)
  if (!flag) {
    return NextResponse.json({ error: "Feature flag not found" }, { status: 404 })
  }

  const updated = await updateFlag(
    id,
    {
      name,
      description,
      scope,
      status,
      defaultValue,
      rolloutPercentage,
      category,
      tags,
    },
    user.id!,
    reason
  )

  return NextResponse.json(updated)
}

/**
 * DELETE /api/admin/feature-flags/[id]
 *
 * Delete a feature flag
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin()
  const { id } = await params

  const flag = await getFlagById(id)
  if (!flag) {
    return NextResponse.json({ error: "Feature flag not found" }, { status: 404 })
  }

  await deleteFlag(id, user.id!)
  return NextResponse.json({ success: true })
}
