import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { createConnectionToken } from "@/lib/stripe/terminal"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export async function POST() {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const secret = await createConnectionToken(company.id)

    return NextResponse.json({ secret })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Connection token error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create token" },
      { status: 500 }
    )
  }
}
