// src/app/api/admin/regulatory-truth/rules/approve/route.ts
//
// Bulk approve API for workers to call.
// This is the ONLY way for workers to approve rules - local approveRule is removed.
//
// Auth: Bearer token (RTL_WORKER_API_KEY or CRON_SECRET)
// Idempotency: releaseId required, prevents duplicate operations

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { approveRule } from "@/lib/regulatory-truth/services/rule-status-service"
import { runWithRegulatoryContext } from "@/lib/db"
import { logAuditEvent } from "@/lib/regulatory-truth/utils/audit-log"
import {
  checkIdempotency,
  storeResponseSummary,
} from "@/lib/regulatory-truth/utils/api-idempotency"
import { ApiIdempotencyRoute } from "@prisma/client"

// Auth: prefer dedicated key, fallback to CRON_SECRET for initial rollout
const RTL_WORKER_API_KEY = process.env.RTL_WORKER_API_KEY || process.env.CRON_SECRET

// Timeout for the entire approve operation (30 seconds)
const APPROVE_TIMEOUT_MS = 30_000

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

const ApproveRequestSchema = z.object({
  ruleIds: z
    .array(z.string().min(1))
    .min(1, "At least one rule ID required")
    .max(100, "Maximum 100 rules per request"),
  source: z.string().min(1, "Source identifier required"),
  approvedBy: z.string().min(1, "Approver identifier required"),
  releaseId: z.string().min(8, "releaseId required (min 8 chars) for idempotency"),
  sourceSlug: z.string().optional(), // For auto-approval allowlist check
  autoApprove: z.boolean().optional(), // Whether this is auto-approval
})

// Response shape (stable contract for workers)
interface ApproveResponse {
  success: boolean
  approvedCount: number
  failedCount: number
  results: Array<{
    ruleId: string
    success: boolean
    error?: string
  }>
  errors?: string[]
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
): Promise<NextResponse<ApproveResponse | { error: string; details?: unknown }>> {
  const startTime = Date.now()

  // ==========================================================================
  // AUTH CHECK
  // ==========================================================================

  const authHeader = request.headers.get("authorization")
  if (!RTL_WORKER_API_KEY) {
    console.error("[approve-api] RTL_WORKER_API_KEY not configured")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${RTL_WORKER_API_KEY}`) {
    console.warn("[approve-api] Unauthorized request attempt")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ==========================================================================
  // PARSE REQUEST
  // ==========================================================================

  let body: z.infer<typeof ApproveRequestSchema>
  try {
    const rawBody = await request.json()
    body = ApproveRequestSchema.parse(rawBody)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { ruleIds, source, approvedBy, releaseId, sourceSlug, autoApprove } = body

  console.log(
    `[approve-api] Request: ${ruleIds.length} rules from ${source} ` +
      `(releaseId: ${releaseId}, autoApprove: ${autoApprove ?? false})`
  )

  // ==========================================================================
  // IDEMPOTENCY CHECK
  // ==========================================================================

  const idempotencyCheck = await checkIdempotency(
    ApiIdempotencyRoute.APPROVE_RULES,
    releaseId,
    {
      ruleIds,
      source,
      actor: approvedBy,
      autoApprove,
      sourceSlug,
    },
    {
      source,
      approvedBy,
      ruleCount: ruleIds.length,
      autoApprove,
      sourceSlug,
    }
  )

  if (idempotencyCheck.isConflict) {
    console.warn(`[approve-api] Idempotency conflict for releaseId ${releaseId}`)
    await logAuditEvent({
      action: "IDEMPOTENCY_CONFLICT",
      entityType: "PIPELINE",
      entityId: `api-approve-${releaseId}`,
      performedBy: approvedBy,
      metadata: {
        route: "APPROVE_RULES",
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
    const storedResponse = idempotencyCheck.existing?.responseSummary as ApproveResponse | null
    console.log(
      `[approve-api] Idempotent replay for releaseId ${releaseId} ` +
        `(original: ${storedResponse?.approvedCount ?? "?"} approved, ${storedResponse?.failedCount ?? "?"} failed)`
    )
    await logAuditEvent({
      action: "IDEMPOTENT_REPLAY",
      entityType: "PIPELINE",
      entityId: `api-approve-${releaseId}`,
      performedBy: approvedBy,
      metadata: {
        route: "APPROVE_RULES",
        releaseId,
        source,
        ruleCount: ruleIds.length,
        originalCreatedAt: idempotencyCheck.existing?.createdAt,
        originalApprovedCount: storedResponse?.approvedCount,
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
    console.error(`[approve-api] Replay without stored response for ${releaseId} - this is a bug`)
    return NextResponse.json({
      success: true,
      approvedCount: 0,
      failedCount: 0,
      results: [],
      errors: ["Replay error: original response not stored"],
      replayed: true,
    })
  }

  // ==========================================================================
  // APPROVE WITH TIMEOUT
  // ==========================================================================

  try {
    const results: Array<{ ruleId: string; success: boolean; error?: string }> = []
    const errors: string[] = []

    // Process each rule with regulatory context
    const approvePromise = runWithRegulatoryContext(
      { source, actorUserId: approvedBy, autoApprove: autoApprove ?? false },
      async () => {
        for (const ruleId of ruleIds) {
          try {
            const result = await approveRule(ruleId, approvedBy, source, {
              sourceSlug,
            })

            results.push({
              ruleId,
              success: result.success,
              error: result.error,
            })

            if (!result.success && result.error) {
              errors.push(`${ruleId}: ${result.error}`)
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            results.push({
              ruleId,
              success: false,
              error: errorMsg,
            })
            errors.push(`${ruleId}: ${errorMsg}`)
          }
        }
      }
    )

    // Timeout protection
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Approve operation timed out")), APPROVE_TIMEOUT_MS)
    })

    await Promise.race([approvePromise, timeoutPromise])

    // ==========================================================================
    // AUDIT LOG
    // ==========================================================================

    const approvedCount = results.filter((r) => r.success).length

    await logAuditEvent({
      action: "BULK_APPROVE_VIA_API",
      entityType: "PIPELINE",
      entityId: `api-approve-${releaseId}`,
      performedBy: approvedBy,
      metadata: {
        releaseId,
        source,
        sourceSlug,
        autoApprove,
        requestedCount: ruleIds.length,
        approvedCount,
        failedCount: results.filter((r) => !r.success).length,
        durationMs: Date.now() - startTime,
      },
    })

    // ==========================================================================
    // RESPONSE
    // ==========================================================================

    const response: ApproveResponse = {
      success: approvedCount > 0 || ruleIds.length === 0,
      approvedCount,
      failedCount: results.filter((r) => !r.success).length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    }

    // Store response for deterministic replay
    await storeResponseSummary(ApiIdempotencyRoute.APPROVE_RULES, releaseId, response).catch(
      (err) => {
        // Log but don't fail - response is already computed
        console.error(`[approve-api] Failed to store response summary: ${err}`)
      }
    )

    console.log(
      `[approve-api] Complete: ${approvedCount} approved, ${response.failedCount} failed ` +
        `(${Date.now() - startTime}ms)`
    )

    return NextResponse.json(response)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[approve-api] Error: ${errorMsg}`)

    // Log failed attempt for observability
    await logAuditEvent({
      action: "BULK_APPROVE_VIA_API",
      entityType: "PIPELINE",
      entityId: `api-approve-${releaseId}`,
      performedBy: approvedBy,
      metadata: {
        releaseId,
        source,
        requestedCount: ruleIds.length,
        error: errorMsg,
        durationMs: Date.now() - startTime,
      },
    }).catch(() => {}) // Don't fail on audit log error

    return NextResponse.json(
      { error: "Approve operation failed", details: errorMsg },
      { status: 500 }
    )
  }
}
