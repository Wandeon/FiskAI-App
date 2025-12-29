import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import {
  dismissAlert,
  resolveAlert,
  acknowledgeAlert,
  snoozeAlert,
} from "@/lib/admin/alerts"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { action, companyId, type, snoozedUntil } = body

    if (!action || !companyId || !type) {
      return NextResponse.json(
        { error: "Missing required fields: action, companyId, type" },
        { status: 400 }
      )
    }

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
        if (!snoozedUntil) {
          return NextResponse.json(
            { error: "snoozedUntil is required for snooze action" },
            { status: 400 }
          )
        }
        await snoozeAlert(companyId, type, userId, new Date(snoozedUntil))
        break
      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Alert action error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
