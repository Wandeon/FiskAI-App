import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { dismissAlert, resolveAlert, acknowledgeAlert, snoozeAlert } from "@/lib/admin/alerts"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { alertActionSchema } from "../_schemas"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const { action, companyId, type, snoozedUntil } = await parseBody(request, alertActionSchema)
    const userId = user.id

    switch (action) {
      case "dismiss":
        await dismissAlert(companyId, type, userId)
        break
      case "resolve":
        await resolveAlert(companyId, type, userId)
        break
      case "acknowledge":
        await acknowledgeAlert(companyId, type, userId)
        break
      case "snooze":
        // snoozedUntil is guaranteed by schema refine when action is "snooze"
        await snoozeAlert(companyId, type, userId, snoozedUntil!)
        break
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Alert action error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
