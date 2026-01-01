import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyReleaseHash } from "@/lib/regulatory-truth/utils/release-hash"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { parseParams, isValidationError, formatValidationError } from "@/lib/api/validation"

const paramsSchema = z.object({
  id: z.string().min(1, "Release ID is required"),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check authorization - only ADMIN users can verify releases
    if (session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const resolvedParams = await params
    const { id } = parseParams(resolvedParams, paramsSchema)
    const result = await verifyReleaseHash(id, db)
    return NextResponse.json(result)
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 }
    )
  }
}
