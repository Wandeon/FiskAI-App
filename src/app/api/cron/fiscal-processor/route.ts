// src/app/api/cron/fiscal-processor/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { FiscalRequest } from "@prisma/client"
import { executeFiscalRequest } from "@/lib/fiscal/fiscal-pipeline"
import { buildFiscalResponseCreateInput } from "@/lib/fiscal/response-builder"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer `) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const batchSize = 10
  const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`

  try {
    // Recover stale locks first
    await recoverStaleLocks()

    // Acquire jobs with row locking
    // Use database NOW() to prevent race conditions from clock skew between app servers
    // Add minimum lock age (60s) to prevent processing locks that were just acquired
    const jobs = await db.$queryRaw<FiscalRequest[]>`
      UPDATE "FiscalRequest"
      SET
        "lockedAt" = NOW(),
        "lockedBy" = ${workerId},
        "status" = 'PROCESSING'
      WHERE id IN (
        SELECT id FROM "FiscalRequest"
        WHERE "status" IN ('QUEUED', 'FAILED')
          AND "nextRetryAt" <= NOW()
          AND "attemptCount" < "maxAttempts"
          AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '60 seconds')
        ORDER BY "nextRetryAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      )
      RETURNING *
    `

    const results = []

    // Process each job
    for (const job of jobs) {
      const result = await processJob(job, workerId)
      results.push({ id: job.id, ...result })
    }

    return NextResponse.json({
      processed: jobs.length,
      results,
    })
  } catch (error) {
    console.error("[fiscal-processor] error:", error)
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

async function processJob(
  job: FiscalRequest,
  workerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await executeFiscalRequest(job)
    const attemptNumber = job.attemptCount + 1

    await db.fiscalResponse.create({
      data: buildFiscalResponseCreateInput(job, {
        status: "SUCCESS",
        attemptNumber,
        jir: result.jir,
        zki: result.zki,
        responseXml: result.responseXml,
      }),
    })

    // Success - update with JIR
    await db.fiscalRequest.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        jir: result.jir,
        responseXml: result.responseXml,
        lockedAt: null,
        lockedBy: null,
        attemptCount: attemptNumber,
      },
    })

    // Update invoice with JIR
    if (job.invoiceId && result.jir) {
      await db.eInvoice.update({
        where: { id: job.invoiceId },
        data: {
          jir: result.jir,
          zki: result.zki,
          fiscalizedAt: new Date(),
          fiscalStatus: "COMPLETED",
        },
      })
    }

    return { success: true }
  } catch (error) {
    const classification = classifyError(error)
    const attemptCount = job.attemptCount + 1

    await db.fiscalResponse.create({
      data: buildFiscalResponseCreateInput(job, {
        status: "FAILED",
        attemptNumber: attemptCount,
        zki: job.zki,
        errorCode: classification.code,
        errorMessage: classification.message,
        httpStatus: classification.httpStatus,
      }),
    })

    await db.fiscalRequest.update({
      where: { id: job.id },
      data: {
        status: classification.retriable ? "FAILED" : "DEAD",
        attemptCount,
        errorCode: classification.code,
        errorMessage: classification.message,
        lastHttpStatus: classification.httpStatus,
        nextRetryAt: classification.retriable ? calculateNextRetry(attemptCount) : undefined,
        lockedAt: null,
        lockedBy: null,
      },
    })

    if (job.invoiceId) {
      await db.eInvoice.update({
        where: { id: job.invoiceId },
        data: {
          fiscalStatus: classification.retriable ? "PENDING" : "FAILED",
          ...(classification.retriable ? {} : { status: "ERROR" }),
        },
      })
    }

    return { success: false, error: classification.message }
  }
}

interface ErrorClassification {
  code: string
  message: string
  httpStatus?: number
  retriable: boolean
}

function classifyError(error: unknown): ErrorClassification {
  // Network errors - always retry
  if (error instanceof Error) {
    if (
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("timeout")
    ) {
      return { code: "NETWORK_ERROR", message: error.message, retriable: true }
    }
  }

  // HTTP response errors
  if (error && typeof error === "object" && "httpStatus" in error) {
    const httpError = error as { httpStatus: number; body?: string }

    if (httpError.httpStatus >= 500) {
      return {
        code: "SERVER_ERROR",
        message: `HTTP ${httpError.httpStatus}`,
        httpStatus: httpError.httpStatus,
        retriable: true,
      }
    }

    if (httpError.httpStatus === 429) {
      return {
        code: "RATE_LIMITED",
        message: "Too many requests",
        httpStatus: 429,
        retriable: true,
      }
    }

    return {
      code: "VALIDATION_ERROR",
      message: httpError.body || `HTTP ${httpError.httpStatus}`,
      httpStatus: httpError.httpStatus,
      retriable: false,
    }
  }

  // Porezna-specific error codes
  if (error && typeof error === "object" && "poreznaCode" in error) {
    const poreznaError = error as { poreznaCode: string; message: string }

    // t001-t099: Temporary errors - retry
    const retriable = poreznaError.poreznaCode.startsWith("t")

    return {
      code: poreznaError.poreznaCode,
      message: poreznaError.message,
      retriable,
    }
  }

  return { code: "UNKNOWN", message: String(error), retriable: false }
}

function calculateNextRetry(attemptCount: number): Date {
  // Exponential backoff: 30s, 2m, 8m, 32m, 2h
  const baseDelaySeconds = 30
  const delaySeconds = baseDelaySeconds * Math.pow(4, attemptCount - 1)
  const maxDelaySeconds = 2 * 60 * 60

  const actualDelay = Math.min(delaySeconds, maxDelaySeconds)
  const jitter = actualDelay * 0.1 * (Math.random() * 2 - 1)

  return new Date(Date.now() + (actualDelay + jitter) * 1000)
}

async function recoverStaleLocks() {
  // Use database NOW() and transaction isolation to prevent recovering locks
  // that are actively being processed by slow-running jobs
  await db.$executeRaw`
    UPDATE "FiscalRequest"
    SET
      "status" = 'FAILED',
      "lockedAt" = NULL,
      "lockedBy" = NULL,
      "errorMessage" = 'Lock expired - worker may have crashed'
    WHERE "status" = 'PROCESSING'
      AND "lockedAt" < NOW() - INTERVAL '5 minutes'
  `
}
