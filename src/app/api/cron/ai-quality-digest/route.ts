import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { getWeeklyAIQualityDigest } from "@/lib/ai/feedback-analytics"
import AIQualityDigest from "@/emails/ai-quality-digest"
import React from "react"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const digestData = await getWeeklyAIQualityDigest()

    const adminUsers = await db.user.findMany({
      where: { systemRole: "ADMIN" },
      select: { email: true, name: true },
    })

    if (adminUsers.length === 0) {
      return NextResponse.json({ success: false, message: "No admin users", sent: 0 })
    }

    const emailResults = []
    for (const admin of adminUsers) {
      const result = await sendEmail({
        to: admin.email,
        subject: `FiskAI AI Quality Digest - ${digestData.weekStart.toLocaleDateString("hr-HR")}`,
        react: React.createElement(AIQualityDigest, { data: digestData }),
      })
      emailResults.push({ email: admin.email, success: result.success })
    }

    return NextResponse.json({
      success: true,
      sent: emailResults.filter((r) => r.success).length,
      digest: { globalAccuracy: digestData.globalStats.accuracy },
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
