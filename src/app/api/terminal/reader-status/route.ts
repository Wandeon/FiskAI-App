import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { getReaderStatus } from "@/lib/stripe/terminal"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    if (!company.stripeTerminalReaderId) {
      return NextResponse.json({ online: false, status: "not_configured" })
    }

    const status = await getReaderStatus(company.stripeTerminalReaderId)

    return NextResponse.json(status)
  } catch (error) {
    console.error("Reader status error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 }
    )
  }
}
