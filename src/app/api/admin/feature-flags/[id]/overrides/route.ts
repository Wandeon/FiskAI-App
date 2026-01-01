import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth-utils"
import { getFlagById, createOverride, deleteOverride } from "@/lib/feature-flags"
import {
  parseParams,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"

const idParamsSchema = z.object({ id: z.string().uuid() })

const createOverrideSchema = z.object({
  companyId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  enabled: z.boolean({ message: "enabled is required" }),
  expiresAt: z.string().datetime().optional(),
  reason: z.string().min(1, "reason is required"),
})

const deleteOverrideSchema = z.object({
  overrideId: z.string().uuid("overrideId is required"),
  reason: z.string().min(1, "reason is required"),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/feature-flags/[id]/overrides
 *
 * Create an override for a feature flag
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAdmin()
    const { id } = parseParams(await params, idParamsSchema)
    const body = await parseBody(request, createOverrideSchema)

    const flag = await getFlagById(id)
    if (!flag) {
      return NextResponse.json({ error: "Feature flag not found" }, { status: 404 })
    }

    const { companyId, userId, enabled, expiresAt, reason } = body

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
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
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
  try {
    const user = await requireAdmin()
    const { id } = parseParams(await params, idParamsSchema)
    const { overrideId, reason } = await parseBody(request, deleteOverrideSchema)

    const flag = await getFlagById(id)
    if (!flag) {
      return NextResponse.json({ error: "Feature flag not found" }, { status: 404 })
    }

    // Verify override belongs to this flag
    const override = flag.overrides.find((o) => o.id === overrideId)
    if (!override) {
      return NextResponse.json({ error: "Override not found" }, { status: 404 })
    }

    await deleteOverride(overrideId, user.id!, reason)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}
