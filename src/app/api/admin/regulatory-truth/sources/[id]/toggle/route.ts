// src/app/api/admin/regulatory-truth/sources/[id]/toggle/route.ts

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import {
  parseParams,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"

const paramsSchema = z.object({
  id: z.string().min(1, "Source ID is required"),
})

const bodySchema = z.object({
  isActive: z.boolean({ message: "isActive is required and must be a boolean" }),
})

/**
 * POST /api/admin/regulatory-truth/sources/[id]/toggle
 *
 * Toggle a regulatory source active/inactive
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = parseParams(await params, paramsSchema)
    const { isActive } = await parseBody(request, bodySchema)

    // Update the source
    const updatedSource = await db.regulatorySource.update({
      where: { id },
      data: { isActive },
    })

    return NextResponse.json({
      success: true,
      source: updatedSource,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[toggle] Error toggling source:", error)
    return NextResponse.json({ error: "Failed to toggle source" }, { status: 500 })
  }
}
