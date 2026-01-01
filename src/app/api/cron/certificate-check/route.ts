import { NextResponse } from "next/server"
import {
  findExpiringCertificates,
  sendCertificateExpiryNotification,
  shouldSendNotification,
  updateNotificationTracking,
  NOTIFICATION_INTERVALS,
  type ExpiringCertificate,
} from "@/lib/compliance/certificate-monitor"
import { db } from "@/lib/db"
import { CertificateNotificationStatus } from "@prisma/client"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

// Retry configuration
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAYS = [
  60 * 60 * 1000, // 1 hour
  3 * 60 * 60 * 1000, // 3 hours
  6 * 60 * 60 * 1000, // 6 hours
]

/**
 * Certificate Expiry Check Cron Job
 *
 * Runs daily to check for expiring FINA certificates and send notifications
 * at standard intervals: 30, 14, 7, and 1 day(s) before expiry.
 *
 * Includes retry logic for failed email notifications:
 * - Failed notifications are tracked in CertificateNotification table
 * - Retries are attempted with exponential backoff (1h, 3h, 6h)
 * - After 3 failed attempts, notification is marked as FAILED
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Track results
    const results = {
      newNotificationsSent: [] as Array<{
        companyId: string
        daysRemaining: number
        notificationDay: number
      }>,
      retriesSent: [] as Array<{
        companyId: string
        notificationDay: number
        attemptCount: number
      }>,
      retriesFailed: [] as Array<{
        companyId: string
        notificationDay: number
        error: string
        willRetry: boolean
      }>,
      skipped: [] as Array<{
        companyId: string
        daysRemaining: number
        reason: string
      }>,
      permanentlyFailed: [] as Array<{
        companyId: string
        notificationDay: number
      }>,
    }

    // Step 1: Retry pending notifications that are due
    await retryPendingNotifications(results)

    // Step 2: Find certificates expiring within 30 days and send new notifications
    const expiringCerts = await findExpiringCertificates(30)

    // Process each certificate
    for (const cert of expiringCerts) {
      // Skip if no valid email
      if (!cert.ownerEmail) {
        results.skipped.push({
          companyId: cert.companyId,
          daysRemaining: cert.daysRemaining,
          reason: "no_owner_email",
        })
        continue
      }

      // Check if notification should be sent based on interval tracking
      const notificationDay = shouldSendNotification(cert.daysRemaining, cert.lastNotificationDay)

      if (notificationDay === null) {
        results.skipped.push({
          companyId: cert.companyId,
          daysRemaining: cert.daysRemaining,
          reason: `already_notified_at_${cert.lastNotificationDay}_days`,
        })
        continue
      }

      // Check if there's already a pending/retrying notification for this interval
      const existingNotification = await db.certificateNotification.findUnique({
        where: {
          certificateId_notificationDay: {
            certificateId: cert.certificateId,
            notificationDay,
          },
        },
      })

      if (existingNotification) {
        // Already being handled (pending, retrying, sent, or failed)
        results.skipped.push({
          companyId: cert.companyId,
          daysRemaining: cert.daysRemaining,
          reason: `notification_${existingNotification.status.toLowerCase()}_for_${notificationDay}_days`,
        })
        continue
      }

      // Try to send new notification
      await sendNewNotification(cert, notificationDay, results)
    }

    return NextResponse.json({
      success: true,
      checked: expiringCerts.length,
      newNotificationsSent: results.newNotificationsSent.length,
      retriesSent: results.retriesSent.length,
      retriesFailed: results.retriesFailed.length,
      permanentlyFailed: results.permanentlyFailed.length,
      skipped: results.skipped.length,
      details: {
        newNotifications: results.newNotificationsSent,
        retries: results.retriesSent,
        retryFailures: results.retriesFailed,
        permanentFailures: results.permanentlyFailed,
        skipped: results.skipped,
      },
      intervals: NOTIFICATION_INTERVALS,
    })
  } catch (error) {
    console.error("Certificate check error:", error)
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

/**
 * Retry pending notifications that are due for retry
 */
async function retryPendingNotifications(results: {
  retriesSent: Array<{ companyId: string; notificationDay: number; attemptCount: number }>
  retriesFailed: Array<{
    companyId: string
    notificationDay: number
    error: string
    willRetry: boolean
  }>
  permanentlyFailed: Array<{ companyId: string; notificationDay: number }>
}) {
  // Find notifications that are pending retry
  const pendingNotifications = await db.certificateNotification.findMany({
    where: {
      status: CertificateNotificationStatus.RETRYING,
      nextRetryAt: {
        lte: new Date(),
      },
    },
  })

  for (const notification of pendingNotifications) {
    // Get the certificate details for sending
    const certDetails = await getCertificateDetails(notification.certificateId)

    if (!certDetails) {
      // Certificate no longer exists, mark as failed
      await db.certificateNotification.update({
        where: { id: notification.id },
        data: {
          status: CertificateNotificationStatus.FAILED,
          error: "Certificate no longer exists",
        },
      })
      results.permanentlyFailed.push({
        companyId: notification.companyId,
        notificationDay: notification.notificationDay,
      })
      continue
    }

    try {
      // Attempt to send the notification
      await sendCertificateExpiryNotification(certDetails)

      // Success - update notification and certificate tracking
      await db.certificateNotification.update({
        where: { id: notification.id },
        data: {
          status: CertificateNotificationStatus.SENT,
          sentAt: new Date(),
          error: null,
        },
      })

      await updateNotificationTracking(
        notification.certificateId,
        notification.notificationDay as 30 | 14 | 7 | 1
      )

      results.retriesSent.push({
        companyId: notification.companyId,
        notificationDay: notification.notificationDay,
        attemptCount: notification.attemptCount,
      })
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error"
      const newAttemptCount = notification.attemptCount + 1

      if (newAttemptCount >= notification.maxAttempts) {
        // Max retries reached, mark as permanently failed
        await db.certificateNotification.update({
          where: { id: notification.id },
          data: {
            status: CertificateNotificationStatus.FAILED,
            attemptCount: newAttemptCount,
            error: errorMessage,
          },
        })

        console.error(
          `Certificate notification permanently failed for ${notification.companyId} (${notification.notificationDay} days): ${errorMessage}`
        )

        results.permanentlyFailed.push({
          companyId: notification.companyId,
          notificationDay: notification.notificationDay,
        })
      } else {
        // Schedule next retry with exponential backoff
        const retryDelay =
          RETRY_DELAYS[newAttemptCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1]
        const nextRetryAt = new Date(Date.now() + retryDelay)

        await db.certificateNotification.update({
          where: { id: notification.id },
          data: {
            attemptCount: newAttemptCount,
            nextRetryAt,
            error: errorMessage,
          },
        })

        console.warn(
          `Certificate notification retry ${newAttemptCount}/${notification.maxAttempts} failed for ${notification.companyId}: ${errorMessage}. Next retry at ${nextRetryAt.toISOString()}`
        )

        results.retriesFailed.push({
          companyId: notification.companyId,
          notificationDay: notification.notificationDay,
          error: errorMessage,
          willRetry: true,
        })
      }
    }
  }
}

/**
 * Send a new notification for a certificate
 *
 * Uses a "claim-then-send" pattern to prevent duplicate emails:
 * 1. Upsert a PENDING record first (acts as a distributed lock via unique constraint)
 * 2. Only the instance that successfully creates/claims the PENDING record proceeds
 * 3. Send the email
 * 4. Update to SENT on success, or RETRYING on failure
 *
 * This prevents duplicates when:
 * - Multiple cron instances run concurrently
 * - Email succeeds but subsequent DB write fails
 */
async function sendNewNotification(
  cert: ExpiringCertificate,
  notificationDay: 30 | 14 | 7 | 1,
  results: {
    newNotificationsSent: Array<{
      companyId: string
      daysRemaining: number
      notificationDay: number
    }>
    retriesFailed: Array<{
      companyId: string
      notificationDay: number
      error: string
      willRetry: boolean
    }>
    skipped: Array<{
      companyId: string
      daysRemaining: number
      reason: string
    }>
  }
) {
  // Step 1: Claim ownership by creating a PENDING record first
  // The unique constraint on (certificateId, notificationDay) ensures only one
  // instance can successfully create this record. Others will get a conflict.
  let notification
  try {
    notification = await db.certificateNotification.upsert({
      where: {
        certificateId_notificationDay: {
          certificateId: cert.certificateId,
          notificationDay,
        },
      },
      // If record exists, don't modify it - we lost the race
      update: {},
      // Create new PENDING record to claim ownership
      create: {
        certificateId: cert.certificateId,
        companyId: cert.companyId,
        notificationDay,
        status: CertificateNotificationStatus.PENDING,
        attemptCount: 0,
        maxAttempts: MAX_RETRY_ATTEMPTS,
      },
    })

    // If the record already existed (not PENDING or attemptCount > 0), another instance owns it
    if (
      notification.status !== CertificateNotificationStatus.PENDING ||
      notification.attemptCount > 0
    ) {
      results.skipped.push({
        companyId: cert.companyId,
        daysRemaining: cert.daysRemaining,
        reason: `notification_already_${notification.status.toLowerCase()}_for_${notificationDay}_days`,
      })
      return
    }
  } catch (claimError) {
    // Unique constraint violation means another instance claimed it
    console.warn(
      `Could not claim notification for ${cert.companyId} (${notificationDay} days): already claimed`
    )
    results.skipped.push({
      companyId: cert.companyId,
      daysRemaining: cert.daysRemaining,
      reason: `notification_claimed_by_another_instance_for_${notificationDay}_days`,
    })
    return
  }

  // Step 2: We own the PENDING record - now send the email
  try {
    await sendCertificateExpiryNotification(cert)

    // Step 3a: Email sent successfully - update to SENT
    await db.certificateNotification.update({
      where: { id: notification.id },
      data: {
        status: CertificateNotificationStatus.SENT,
        attemptCount: 1,
        sentAt: new Date(),
      },
    })

    // Update tracking to prevent duplicate notifications at this interval
    await updateNotificationTracking(cert.certificateId, notificationDay)

    results.newNotificationsSent.push({
      companyId: cert.companyId,
      daysRemaining: cert.daysRemaining,
      notificationDay,
    })
  } catch (emailError) {
    // Step 3b: Email failed - schedule for retry
    const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error"
    console.error(`Failed to send notification for ${cert.companyId}:`, emailError)

    const retryDelay = RETRY_DELAYS[0] // First retry delay (1 hour)
    const nextRetryAt = new Date(Date.now() + retryDelay)

    await db.certificateNotification.update({
      where: { id: notification.id },
      data: {
        status: CertificateNotificationStatus.RETRYING,
        attemptCount: 1,
        nextRetryAt,
        error: errorMessage,
      },
    })

    results.retriesFailed.push({
      companyId: cert.companyId,
      notificationDay,
      error: errorMessage,
      willRetry: true,
    })
  }
}

/**
 * Get certificate details for retry attempts
 */
async function getCertificateDetails(certificateId: string): Promise<ExpiringCertificate | null> {
  const cert = await db.fiscalCertificate.findUnique({
    where: { id: certificateId },
    include: {
      company: {
        include: {
          users: {
            where: { role: "OWNER" },
            include: { user: true },
          },
        },
      },
    },
  })

  if (!cert) return null

  const daysRemaining = Math.ceil(
    (cert.certNotAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return {
    certificateId: cert.id,
    companyId: cert.companyId,
    companyName: cert.company.name,
    ownerEmail: cert.company.users[0]?.user?.email || "",
    validUntil: cert.certNotAfter,
    daysRemaining,
    lastNotificationDay: cert.lastExpiryNotificationDay,
  }
}
