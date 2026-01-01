import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { getReaderStatus } from "@/lib/stripe/terminal"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

// Explicit empty schema - GET with no query params
const querySchema = z.object({})

export async function GET(request: NextRequest) {
  // Validate query params (none expected)
  const searchParams = Object.fromEntries(request.nextUrl.searchParams)
  querySchema.parse(searchParams)
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    if (!company.stripeTerminalReaderId) {
      return NextResponse.json({ online: false, status: "not_configured" })
    }

    const status = await getReaderStatus(company.stripeTerminalReaderId)

    return NextResponse.json(status)
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Reader status error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 }
    )
  }
}
