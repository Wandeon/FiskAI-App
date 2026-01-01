import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { updateProfileSchema } from "../_schemas"

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check for STAFF or ADMIN role
    if (session.user.systemRole !== "STAFF" && session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { name } = await parseBody(req, updateProfileSchema)

    // Update user profile
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: { name },
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error updating staff profile:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
