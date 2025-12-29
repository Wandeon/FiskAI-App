// src/app/api/cron/fiscal-retry/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { executeFiscalRequest } from "@/lib/fiscal/fiscal-pipeline"

// Croatian law requires fiscalization within 48 hours
const DEADLINE_HOURS = 48
const MAX_ATTEMPTS = 10

// Exponential backoff: 1m, 5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h, 24h
// Total coverage: ~52 hours, well within 48h window with early retries
const RETRY_DELAYS = [60, 300, 900, 1800, 3600, 7200, 14400, 28800, 43200, 86400]

// Alert thresholds (hours remaining before deadline)
const ALERT_THRESHOLDS = {
  WARNING: 12, // Alert when 12 hours remaining
  CRITICAL: 4, // Critical alert when 4 hours remaining
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Find pending fiscal requests that are due for retry
    const pendingRequests = await db.fiscalRequest.findMany({
      where: {
        status: { in: ["QUEUED", "FAILED"] },
        attemptCount: { lt: MAX_ATTEMPTS },
      },
      include: {
        company: {
          select: { id: true, name: true, email: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    })

    const results: {
      id: string
      success: boolean
      error?: string
      alertSent?: boolean
    }[] = []

    for (const fiscalRequest of pendingRequests) {
      // Check if enough time has passed for retry (exponential backoff)
      if (fiscalRequest.nextRetryAt && new Date() < fiscalRequest.nextRetryAt) {
        continue // Not time to retry yet
      }

      // Calculate time since creation (for 48-hour deadline)
      const hoursSinceCreation =
        (Date.now() - fiscalRequest.createdAt.getTime()) / (1000 * 60 * 60)
      const hoursRemaining = DEADLINE_HOURS - hoursSinceCreation

      // Check if we're approaching or past the 48-hour deadline
      let alertSent = false
      if (hoursRemaining <= 0) {
        // Deadline passed - mark as DEAD and send critical alert
        await markDeadlineExpired(fiscalRequest)
        await sendDeadlineAlert(fiscalRequest, "EXPIRED")
        alertSent = true

        results.push({
          id: fiscalRequest.id,
          success: false,
          error: "48-hour deadline expired",
          alertSent: true,
        })
        continue
      } else if (hoursRemaining <= ALERT_THRESHOLDS.CRITICAL) {
        // Critical alert - 4 hours or less remaining
        await sendDeadlineAlert(fiscalRequest, "CRITICAL")
        alertSent = true
      } else if (hoursRemaining <= ALERT_THRESHOLDS.WARNING) {
        // Warning alert - 12 hours or less remaining
        await sendDeadlineAlert(fiscalRequest, "WARNING")
        alertSent = true
      }

      // Calculate next retry time with exponential backoff
      const nextAttempt = fiscalRequest.attemptCount + 1
      const retryDelay =
        RETRY_DELAYS[Math.min(nextAttempt - 1, RETRY_DELAYS.length - 1)]
      const nextRetryAt = new Date(Date.now() + retryDelay * 1000)

      // Log the retry attempt for audit
      await logRetryAttempt(fiscalRequest, nextAttempt, hoursRemaining)

      // Update attempt count and next retry time
      await db.fiscalRequest.update({
        where: { id: fiscalRequest.id },
        data: {
          status: "PROCESSING",
          attemptCount: nextAttempt,
          nextRetryAt: nextRetryAt,
        },
      })

      try {
        const result = await executeFiscalRequest(fiscalRequest)

        await db.fiscalRequest.update({
          where: { id: fiscalRequest.id },
          data: {
            status: result.success ? "COMPLETED" : "FAILED",
            jir: result.jir,
            zki: result.zki,
            responseXml: result.responseXml,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          },
        })

        // Update invoice if successful
        if (result.success && result.jir && fiscalRequest.invoiceId) {
          await db.eInvoice.update({
            where: { id: fiscalRequest.invoiceId },
            data: {
              jir: result.jir,
              zki: result.zki,
              fiscalStatus: "FISCALIZED",
              fiscalizedAt: new Date(),
            },
          })

          // Log successful fiscalization
          await logRetrySuccess(fiscalRequest, nextAttempt)
        }

        results.push({
          id: fiscalRequest.id,
          success: result.success,
          error: result.errorMessage,
          alertSent,
        })
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        const poreznaCode =
          error && typeof error === "object" && "poreznaCode" in error
            ? (error as { poreznaCode?: string }).poreznaCode
            : undefined
        const isFinalAttempt = nextAttempt >= MAX_ATTEMPTS

        // Calculate next retry time if not final attempt
        const retryDelayForError =
          RETRY_DELAYS[Math.min(nextAttempt - 1, RETRY_DELAYS.length - 1)]
        const nextRetryAtForError = new Date(
          Date.now() + retryDelayForError * 1000
        )

        await db.fiscalRequest.update({
          where: { id: fiscalRequest.id },
          data: {
            status: isFinalAttempt ? "DEAD" : "FAILED",
            errorCode: poreznaCode || undefined,
            errorMessage: errorMessage,
            nextRetryAt: isFinalAttempt ? undefined : nextRetryAtForError,
          },
        })

        // Log the failure
        await logRetryFailure(fiscalRequest, nextAttempt, errorMessage)

        // Send alert if this is the final attempt
        if (isFinalAttempt) {
          await sendDeadlineAlert(fiscalRequest, "MAX_RETRIES")
        }

        results.push({
          id: fiscalRequest.id,
          success: false,
          error: errorMessage,
          alertSent,
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error("Fiscal retry cron error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// Mark request as dead when 48-hour deadline expires
async function markDeadlineExpired(
  fiscalRequest: Awaited<
    ReturnType<typeof db.fiscalRequest.findMany>
  >[number] & {
    company?: { id: string; name: string; email: string | null } | null
    invoice?: { id: string; invoiceNumber: string | null } | null
  }
) {
  await db.fiscalRequest.update({
    where: { id: fiscalRequest.id },
    data: {
      status: "DEAD",
      errorMessage: "48-hour fiscalization deadline expired",
    },
  })

  // Update invoice status
  if (fiscalRequest.invoiceId) {
    await db.eInvoice.update({
      where: { id: fiscalRequest.invoiceId },
      data: {
        fiscalStatus: "FAILED",
      },
    })
  }
}

// Send alert notification
async function sendDeadlineAlert(
  fiscalRequest: Awaited<
    ReturnType<typeof db.fiscalRequest.findMany>
  >[number] & {
    company?: { id: string; name: string; email: string | null } | null
    invoice?: { id: string; invoiceNumber: string | null } | null
  },
  alertType: "WARNING" | "CRITICAL" | "EXPIRED" | "MAX_RETRIES"
) {
  const companyId = fiscalRequest.company?.id || fiscalRequest.companyId
  const companyName = fiscalRequest.company?.name || "Unknown"
  const invoiceNumber = fiscalRequest.invoice?.invoiceNumber || "N/A"

  // Create audit log entry for the alert
  await db.auditLog.create({
    data: {
      userId: null, // System action
      companyId,
      action: "UPDATE",
      entity: "FiscalRequest",
      entityId: fiscalRequest.id,
      changes: {
        alertType,
        attemptCount: fiscalRequest.attemptCount,
        invoiceNumber,
        companyName,
        message: getAlertMessage(alertType),
      },
    },
  })

  // Log to console for monitoring systems to pick up
  console.warn(
    `[FISCAL_ALERT] ${alertType}: Company ${companyName}, Invoice ${invoiceNumber}, ` +
      `Attempts: ${fiscalRequest.attemptCount}/${MAX_ATTEMPTS}, ` +
      `Request ID: ${fiscalRequest.id}`
  )
}

function getAlertMessage(alertType: string): string {
  switch (alertType) {
    case "WARNING":
      return "Fiskalizacija se priblizava roku od 48 sati - preostalo manje od 12 sati"
    case "CRITICAL":
      return "HITNO: Fiskalizacija ima manje od 4 sata do isteka roka!"
    case "EXPIRED":
      return "Rok za fiskalizaciju od 48 sati je istekao - potrebna rucna intervencija"
    case "MAX_RETRIES":
      return "Dostignut maksimalan broj pokusaja fiskalizacije (10) - potrebna rucna intervencija"
    default:
      return "Fiskalizacija zahtijeva paznju"
  }
}

// Audit logging functions
async function logRetryAttempt(
  fiscalRequest: Awaited<
    ReturnType<typeof db.fiscalRequest.findMany>
  >[number] & {
    company?: { id: string; name: string; email: string | null } | null
    invoice?: { id: string; invoiceNumber: string | null } | null
  },
  attemptNumber: number,
  hoursRemaining: number
) {
  const companyId = fiscalRequest.company?.id || fiscalRequest.companyId

  await db.auditLog.create({
    data: {
      userId: null, // System action
      companyId,
      action: "UPDATE",
      entity: "FiscalRequest",
      entityId: fiscalRequest.id,
      changes: {
        event: "RETRY_ATTEMPT",
        attemptNumber,
        maxAttempts: MAX_ATTEMPTS,
        hoursRemaining: hoursRemaining.toFixed(2),
        invoiceNumber: fiscalRequest.invoice?.invoiceNumber || "N/A",
      },
    },
  })
}

async function logRetrySuccess(
  fiscalRequest: Awaited<
    ReturnType<typeof db.fiscalRequest.findMany>
  >[number] & {
    company?: { id: string; name: string; email: string | null } | null
    invoice?: { id: string; invoiceNumber: string | null } | null
  },
  attemptNumber: number
) {
  const companyId = fiscalRequest.company?.id || fiscalRequest.companyId

  await db.auditLog.create({
    data: {
      userId: null, // System action
      companyId,
      action: "UPDATE",
      entity: "FiscalRequest",
      entityId: fiscalRequest.id,
      changes: {
        event: "FISCALIZATION_SUCCESS",
        attemptNumber,
        invoiceNumber: fiscalRequest.invoice?.invoiceNumber || "N/A",
        message: "Fiskalizacija uspjesno zavrsena",
      },
    },
  })
}

async function logRetryFailure(
  fiscalRequest: Awaited<
    ReturnType<typeof db.fiscalRequest.findMany>
  >[number] & {
    company?: { id: string; name: string; email: string | null } | null
    invoice?: { id: string; invoiceNumber: string | null } | null
  },
  attemptNumber: number,
  errorMessage: string
) {
  const companyId = fiscalRequest.company?.id || fiscalRequest.companyId

  await db.auditLog.create({
    data: {
      userId: null, // System action
      companyId,
      action: "UPDATE",
      entity: "FiscalRequest",
      entityId: fiscalRequest.id,
      changes: {
        event: "RETRY_FAILED",
        attemptNumber,
        maxAttempts: MAX_ATTEMPTS,
        errorMessage,
        invoiceNumber: fiscalRequest.invoice?.invoiceNumber || "N/A",
      },
    },
  })
}
