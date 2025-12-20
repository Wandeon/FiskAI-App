import { NextResponse } from "next/server"
import {
  findExpiringCertificates,
  sendCertificateExpiryNotification,
} from "@/lib/compliance/certificate-monitor"

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const expiringCerts = await findExpiringCertificates(30)

    // Track notifications sent
    const notificationsSent = []

    // Send notifications for certificates expiring in <30 days
    for (const cert of expiringCerts) {
      // Send weekly reminders for 30-8 days remaining
      if (cert.daysRemaining <= 30 && cert.daysRemaining > 7 && cert.daysRemaining % 7 === 0) {
        await sendCertificateExpiryNotification(cert)
        notificationsSent.push({
          companyId: cert.companyId,
          daysRemaining: cert.daysRemaining,
          type: "weekly",
        })
      }
      // Send daily reminders in final week
      if (cert.daysRemaining <= 7) {
        await sendCertificateExpiryNotification(cert)
        notificationsSent.push({
          companyId: cert.companyId,
          daysRemaining: cert.daysRemaining,
          type: "daily",
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: expiringCerts.length,
      notified: notificationsSent.length,
      notifications: notificationsSent,
    })
  } catch (error) {
    console.error("Certificate check error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
