import { NextResponse } from "next/server"
import {
  findExpiringCertificates,
  sendCertificateExpiryNotification,
  shouldSendNotification,
  updateNotificationTracking,
  NOTIFICATION_INTERVALS,
} from "@/lib/compliance/certificate-monitor"

/**
 * Certificate Expiry Check Cron Job
 *
 * Runs daily to check for expiring FINA certificates and send notifications
 * at standard intervals: 30, 14, 7, and 1 day(s) before expiry.
 *
 * Notifications are tracked to prevent duplicates - only one notification
 * per interval is sent.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Find all certificates expiring within 30 days
    const expiringCerts = await findExpiringCertificates(30)

    // Track notifications sent
    const notificationsSent: Array<{
      companyId: string
      daysRemaining: number
      notificationDay: number
    }> = []

    // Track skipped notifications (already sent for this interval)
    const skipped: Array<{
      companyId: string
      daysRemaining: number
      reason: string
    }> = []

    // Process each certificate
    for (const cert of expiringCerts) {
      // Skip if no valid email
      if (!cert.ownerEmail) {
        skipped.push({
          companyId: cert.companyId,
          daysRemaining: cert.daysRemaining,
          reason: "no_owner_email",
        })
        continue
      }

      // Check if notification should be sent based on interval tracking
      const notificationDay = shouldSendNotification(cert.daysRemaining, cert.lastNotificationDay)

      if (notificationDay === null) {
        skipped.push({
          companyId: cert.companyId,
          daysRemaining: cert.daysRemaining,
          reason: `already_notified_at_${cert.lastNotificationDay}_days`,
        })
        continue
      }

      try {
        // Send the notification email
        await sendCertificateExpiryNotification(cert)

        // Update tracking to prevent duplicate notifications
        await updateNotificationTracking(cert.certificateId, notificationDay)

        notificationsSent.push({
          companyId: cert.companyId,
          daysRemaining: cert.daysRemaining,
          notificationDay,
        })
      } catch (emailError) {
        console.error(`Failed to send notification for ${cert.companyId}:`, emailError)
        skipped.push({
          companyId: cert.companyId,
          daysRemaining: cert.daysRemaining,
          reason: "email_send_failed",
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: expiringCerts.length,
      notified: notificationsSent.length,
      notifications: notificationsSent,
      skipped: skipped.length,
      skippedDetails: skipped,
      intervals: NOTIFICATION_INTERVALS,
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
