// src/app/api/admin/regulatory-truth/sources/[id]/toggle/route.ts

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"

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

    const { id } = await params
    const body = await request.json()
    const { isActive } = body

    if (typeof isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 })
    }

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
    console.error("[toggle] Error toggling source:", error)
    return NextResponse.json({ error: "Failed to toggle source" }, { status: 500 })
  }
}
