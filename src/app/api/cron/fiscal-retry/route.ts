// src/app/api/cron/fiscal-retry/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { executeFiscalRequest } from "@/lib/fiscal/fiscal-pipeline"

const MAX_ATTEMPTS = 5
const RETRY_DELAYS = [60, 300, 900, 3600, 7200] // seconds: 1min, 5min, 15min, 1hr, 2hr

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
      orderBy: { createdAt: "asc" },
      take: 10,
    })

    const results: { id: string; success: boolean; error?: string }[] = []

    for (const request of pendingRequests) {
      // Check if enough time has passed for retry (exponential backoff)
      if (new Date() < request.nextRetryAt) {
        continue // Not time to retry yet
      }

      // Calculate next retry time with exponential backoff
      const nextAttempt = request.attemptCount + 1
      const retryDelay = RETRY_DELAYS[Math.min(nextAttempt - 1, RETRY_DELAYS.length - 1)]
      const nextRetryAt = new Date(Date.now() + retryDelay * 1000)

      // Update attempt count and next retry time
      await db.fiscalRequest.update({
        where: { id: request.id },
        data: {
          status: "PROCESSING",
          attemptCount: nextAttempt,
          nextRetryAt: nextRetryAt,
        },
      })

      try {
        const result = await executeFiscalRequest(request)

        await db.fiscalRequest.update({
          where: { id: request.id },
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
        if (result.success && result.jir && request.invoiceId) {
          await db.eInvoice.update({
            where: { id: request.invoiceId },
            data: {
              jir: result.jir,
              zki: result.zki,
              fiscalStatus: "FISCALIZED",
              fiscalizedAt: new Date(),
            },
          })
        }

        results.push({ id: request.id, success: result.success, error: result.errorMessage })
      } catch (error: any) {
        const nextAttempt = request.attemptCount + 1
        const isFinalAttempt = nextAttempt >= MAX_ATTEMPTS

        // Calculate next retry time if not final attempt
        const retryDelay = RETRY_DELAYS[Math.min(nextAttempt - 1, RETRY_DELAYS.length - 1)]
        const nextRetryAt = new Date(Date.now() + retryDelay * 1000)

        await db.fiscalRequest.update({
          where: { id: request.id },
          data: {
            status: isFinalAttempt ? "DEAD" : "FAILED",
            errorCode: error?.poreznaCode,
            errorMessage: error?.message,
            nextRetryAt: isFinalAttempt ? null : nextRetryAt,
          },
        })

        results.push({ id: request.id, success: false, error: error?.message })
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
