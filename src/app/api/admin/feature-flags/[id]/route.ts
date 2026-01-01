import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { FeatureFlagScope } from "@prisma/client"
import { requireAdmin } from "@/lib/auth-utils"
import { getFlagById, updateFlag, deleteFlag, getFlagAuditLog } from "@/lib/feature-flags"
import {
  parseParams,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import { updateFeatureFlagSchema } from "@/app/api/admin/_schemas"

const idParamsSchema = z.object({ id: z.string().uuid() })

const updateWithReasonSchema = updateFeatureFlagSchema.extend({
  scope: z.nativeEnum(FeatureFlagScope).optional(),
  reason: z.string().optional(),
})

const deleteBodySchema = z.object({
  reason: z.string().min(1, "Deletion reason is required"),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/feature-flags/[id]
 *
 * Get a single feature flag with audit log
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin()
    const { id } = parseParams(await params, idParamsSchema)

    const [flag, auditLog] = await Promise.all([getFlagById(id), getFlagAuditLog(id)])

    if (!flag) {
      return NextResponse.json({ error: "Feature flag not found" }, { status: 404 })
    }

    return NextResponse.json({ flag, auditLog })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}

/**
 * PATCH /api/admin/feature-flags/[id]
 *
 * Update a feature flag
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAdmin()
    const { id } = parseParams(await params, idParamsSchema)
    const body = await parseBody(request, updateWithReasonSchema)

    const {
      name,
      description,
      scope,
      status,
      defaultValue,
      rolloutPercentage,
      category,
      tags,
      reason,
    } = body

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
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}

/**
 * DELETE /api/admin/feature-flags/[id]
 *
 * Soft-delete a feature flag (requires reason)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAdmin()
    const { id } = parseParams(await params, idParamsSchema)
    const { reason } = await parseBody(request, deleteBodySchema)

    const flag = await getFlagById(id)
    if (!flag) {
      return NextResponse.json({ error: "Feature flag not found" }, { status: 404 })
    }

    await deleteFlag(id, user.id!, reason)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}
