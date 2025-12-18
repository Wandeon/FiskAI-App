import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { notificationPreference } from "@/lib/db/schema/pausalni"
import { eq } from "drizzle-orm"
import { withApiLogging } from "@/lib/api-logging"
import { setTenantContext } from "@/lib/prisma-extensions"

export const GET = withApiLogging(async (request: NextRequest) => {
  try {
    const user = await requireAuth()

    setTenantContext({
      companyId: "", // Not company-specific, user-specific
      userId: user.id!,
    })

    // Fetch user's notification preferences
    const preferences = await drizzleDb
      .select()
      .from(notificationPreference)
      .where(eq(notificationPreference.userId, user.id!))

    // Return preferences grouped by channel
    const emailPref = preferences.find((p) => p.channel === "EMAIL")
    const calendarPref = preferences.find((p) => p.channel === "CALENDAR")

    return NextResponse.json({
      email: emailPref || {
        enabled: true,
        remind7Days: true,
        remind3Days: true,
        remind1Day: true,
        remindDayOf: true,
      },
      calendar: calendarPref || {
        enabled: false,
        googleCalendarConnected: false,
        googleCalendarId: null,
      },
    })
  } catch (error) {
    console.error("Error fetching notification preferences:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const PUT = withApiLogging(async (request: NextRequest) => {
  try {
    const user = await requireAuth()
    const body = await request.json()

    setTenantContext({
      companyId: "", // Not company-specific, user-specific
      userId: user.id!,
    })

    const { channel, enabled, remind7Days, remind3Days, remind1Day, remindDayOf } = body

    if (!channel || !["EMAIL", "CALENDAR"].includes(channel)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 })
    }

    // Check if preference exists
    const existing = await drizzleDb
      .select()
      .from(notificationPreference)
      .where(eq(notificationPreference.userId, user.id!))
      .then((prefs) => prefs.find((p) => p.channel === channel))

    if (existing) {
      // Update existing preference
      await drizzleDb
        .update(notificationPreference)
        .set({
          enabled,
          remind7Days,
          remind3Days,
          remind1Day,
          remindDayOf,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreference.id, existing.id))
    } else {
      // Create new preference
      await drizzleDb.insert(notificationPreference).values({
        userId: user.id!,
        channel,
        enabled: enabled ?? true,
        remind7Days: remind7Days ?? true,
        remind3Days: remind3Days ?? true,
        remind1Day: remind1Day ?? true,
        remindDayOf: remindDayOf ?? true,
        googleCalendarConnected: false,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating notification preferences:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
