// src/app/api/admin/regulatory-truth/rules/publish/route.ts
//
// Bulk publish API for workers to call.
// This is the ONLY way to publish rules - workers must call this endpoint.
//
// Auth: Bearer token (RTL_WORKER_API_KEY or CRON_SECRET)
// Idempotency: releaseId required, prevents duplicate operations

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { publishRules } from "@/lib/regulatory-truth/services/rule-status-service"
import { logAuditEvent } from "@/lib/regulatory-truth/utils/audit-log"
import {
  checkIdempotency,
  storeResponseSummary,
} from "@/lib/regulatory-truth/utils/api-idempotency"
import { ApiIdempotencyRoute } from "@prisma/client"

// Auth: prefer dedicated key, fallback to CRON_SECRET for initial rollout
const RTL_WORKER_API_KEY = process.env.RTL_WORKER_API_KEY || process.env.CRON_SECRET

// Timeout for the entire publish operation (30 seconds)
const PUBLISH_TIMEOUT_MS = 30_000

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

const PublishRequestSchema = z.object({
  ruleIds: z
    .array(z.string().min(1))
    .min(1, "At least one rule ID required")
    .max(100, "Maximum 100 rules per request"),
  source: z.string().min(1, "Source identifier required"),
  actorUserId: z.string().optional(),
  releaseId: z.string().min(8, "releaseId required (min 8 chars) for idempotency"),
})

// Response shape (stable contract for workers)
interface PublishResponse {
  success: boolean
  publishedCount: number
  failedCount: number
  results: Array<{
    ruleId: string
    success: boolean
    error?: string
  }>
  errors?: string[]
  releaseId?: string
  /** Set to true if this was an idempotent replay (no work done) */
  replayed?: boolean
}

// =============================================================================
// ENDPOINT
// =============================================================================

export const dynamic = "force-dynamic"
export const maxDuration = 60 // Vercel timeout

export async function POST(
  request: NextRequest
): Promise<NextResponse<PublishResponse | { error: string; details?: unknown }>> {
  const startTime = Date.now()

  // ==========================================================================
  // AUTH CHECK
  // ==========================================================================

  const authHeader = request.headers.get("authorization")
  if (!RTL_WORKER_API_KEY) {
    console.error("[publish-api] RTL_WORKER_API_KEY not configured")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${RTL_WORKER_API_KEY}`) {
    console.warn("[publish-api] Unauthorized request attempt")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ==========================================================================
  // PARSE REQUEST
  // ==========================================================================

  let body: z.infer<typeof PublishRequestSchema>
  try {
    const rawBody = await request.json()
    body = PublishRequestSchema.parse(rawBody)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { ruleIds, source, actorUserId, releaseId } = body

  console.log(
    `[publish-api] Request: ${ruleIds.length} rules from ${source} (releaseId: ${releaseId})`
  )

  // ==========================================================================
  // IDEMPOTENCY CHECK
  // ==========================================================================

  const idempotencyCheck = await checkIdempotency(
    ApiIdempotencyRoute.PUBLISH_RULES,
    releaseId,
    {
      ruleIds,
      source,
      actor: actorUserId || "WORKER_API",
    },
    {
      source,
      actorUserId,
      ruleCount: ruleIds.length,
    }
  )

  if (idempotencyCheck.isConflict) {
    console.warn(`[publish-api] Idempotency conflict for releaseId ${releaseId}`)
    await logAuditEvent({
      action: "IDEMPOTENCY_CONFLICT",
      entityType: "PIPELINE",
      entityId: `api-publish-${releaseId}`,
      performedBy: actorUserId || "WORKER_API",
      metadata: {
        route: "PUBLISH_RULES",
        releaseId,
        source,
        ruleCount: ruleIds.length,
        originalRequest: idempotencyCheck.existing,
      },
    }).catch(() => {})

    return NextResponse.json(
      { error: idempotencyCheck.error || "Idempotency conflict" },
      { status: 409 }
    )
  }

  if (idempotencyCheck.isReplay) {
    const storedResponse = idempotencyCheck.existing?.responseSummary as PublishResponse | null
    console.log(
      `[publish-api] Idempotent replay for releaseId ${releaseId} ` +
        `(original: ${storedResponse?.publishedCount ?? "?"} published, ${storedResponse?.failedCount ?? "?"} failed)`
    )
    await logAuditEvent({
      action: "IDEMPOTENT_REPLAY",
      entityType: "PIPELINE",
      entityId: `api-publish-${releaseId}`,
      performedBy: actorUserId || "WORKER_API",
      metadata: {
        route: "PUBLISH_RULES",
        releaseId,
        source,
        ruleCount: ruleIds.length,
        originalCreatedAt: idempotencyCheck.existing?.createdAt,
        originalPublishedCount: storedResponse?.publishedCount,
        originalFailedCount: storedResponse?.failedCount,
      },
    }).catch(() => {})

    // Return the EXACT stored response from first execution (deterministic replay)
    if (storedResponse) {
      return NextResponse.json({
        ...storedResponse,
        replayed: true,
      })
    }

    // Fallback: this shouldn't happen (incomplete keys are treated as new)
    // but handle gracefully if responseSummary is somehow missing
    console.error(`[publish-api] Replay without stored response for ${releaseId} - this is a bug`)
    return NextResponse.json({
      success: true,
      publishedCount: 0,
      failedCount: 0,
      results: [],
      errors: ["Replay error: original response not stored"],
      releaseId,
      replayed: true,
    })
  }

  // ==========================================================================
  // PUBLISH WITH TIMEOUT
  // ==========================================================================

  try {
    // Timeout protection: don't let a stuck DB hold the endpoint forever
    const publishPromise = publishRules(ruleIds, source, actorUserId)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Publish operation timed out")), PUBLISH_TIMEOUT_MS)
    })

    const result = await Promise.race([publishPromise, timeoutPromise])

    // ==========================================================================
    // AUDIT LOG
    // ==========================================================================

    await logAuditEvent({
      action: "BULK_PUBLISH_VIA_API",
      entityType: "PIPELINE",
      entityId: `api-publish-${releaseId}`,
      performedBy: actorUserId || "WORKER_API",
      metadata: {
        releaseId,
        source,
        requestedCount: ruleIds.length,
        publishedCount: result.publishedCount,
        failedCount: result.failedCount,
        durationMs: Date.now() - startTime,
      },
    })

    // ==========================================================================
    // RESPONSE
    // ==========================================================================

    const response: PublishResponse = {
      success: result.success,
      publishedCount: result.publishedCount,
      failedCount: result.failedCount,
      results: result.results.map((r) => ({
        ruleId: r.ruleId,
        success: r.success,
        error: r.error,
      })),
      errors: result.errors.length > 0 ? result.errors : undefined,
      releaseId,
    }

    // Store response for deterministic replay
    await storeResponseSummary(ApiIdempotencyRoute.PUBLISH_RULES, releaseId, response).catch(
      (err) => {
        // Log but don't fail - response is already computed
        console.error(`[publish-api] Failed to store response summary: ${err}`)
      }
    )

    console.log(
      `[publish-api] Complete: ${result.publishedCount} published, ${result.failedCount} failed ` +
        `(${Date.now() - startTime}ms)`
    )

    return NextResponse.json(response)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[publish-api] Error: ${errorMsg}`)

    // Log failed attempt for observability
    await logAuditEvent({
      action: "BULK_PUBLISH_VIA_API",
      entityType: "PIPELINE",
      entityId: `api-publish-${releaseId}`,
      performedBy: actorUserId || "WORKER_API",
      metadata: {
        releaseId,
        source,
        requestedCount: ruleIds.length,
        error: errorMsg,
        durationMs: Date.now() - startTime,
      },
    }).catch(() => {}) // Don't fail on audit log error

    return NextResponse.json(
      { error: "Publish operation failed", details: errorMsg },
      { status: 500 }
    )
  }
}
