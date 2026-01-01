import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { generateWeeklyDigest, formatDigestEmail } from "@/lib/admin/weekly-digest"
import AdminWeeklyDigest from "@/emails/admin-weekly-digest"
import React from "react"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Generate digest data
    const digestData = await generateWeeklyDigest()

    // Find all admin users
    const adminUsers = await db.user.findMany({
      where: { systemRole: "ADMIN" },
      select: { email: true, name: true },
    })

    if (adminUsers.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No admin users found",
        sent: 0,
      })
    }

    // Send email to each admin
    const emailResults = []
    for (const admin of adminUsers) {
      const result = await sendEmail({
        to: admin.email,
        subject: `FiskAI Tjedni Digest - ${digestData.weekStart.toLocaleDateString("hr-HR")} - ${digestData.weekEnd.toLocaleDateString("hr-HR")}`,
        react: React.createElement(AdminWeeklyDigest, { data: digestData }),
      })

      emailResults.push({
        email: admin.email,
        success: result.success,
        error: result.error,
      })
    }

    const successCount = emailResults.filter((r) => r.success).length
    const failedCount = emailResults.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failedCount,
      recipients: emailResults,
      digest: {
        period: `${digestData.weekStart.toISOString()} - ${digestData.weekEnd.toISOString()}`,
        newCustomers: digestData.newCustomers.count,
        criticalAlerts: digestData.actionItems.length,
        totalTenants: digestData.totalTenants,
      },
    })
  } catch (error) {
    console.error("Weekly digest error:", error)
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
