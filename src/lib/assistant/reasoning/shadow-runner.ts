// src/lib/assistant/reasoning/shadow-runner.ts
import { nanoid } from "nanoid"
import { buildAnswer } from "@/lib/assistant/query-engine/answer-builder"
import { buildAnswerWithReasoning } from "./pipeline"
import { createAuditSink, consumeReasoning } from "./sinks"
import type { AssistantResponse, Surface } from "@/lib/assistant/types"
import type { UserContextSnapshot } from "./types"
import { prisma } from "@/lib/prisma"

/**
 * Run both legacy and new pipelines.
 * Legacy response is returned immediately.
 * New pipeline runs in background and logs trace.
 */
export async function runShadowMode(
  query: string,
  surface: Surface,
  companyId?: string
): Promise<AssistantResponse> {
  const shadowRequestId = `shadow_${nanoid()}`

  // Run legacy pipeline (this is what we return)
  const legacyResponse = await buildAnswer(query, surface, companyId)

  // Run new pipeline in background (fire and forget)
  runNewPipelineInBackground(shadowRequestId, query, surface, companyId).catch((error) => {
    console.error("[ShadowMode] Background pipeline failed", {
      shadowRequestId,
      error: error instanceof Error ? error.message : "Unknown",
    })
  })

  return legacyResponse
}

async function runNewPipelineInBackground(
  shadowRequestId: string,
  query: string,
  surface: Surface,
  _companyId?: string // Prefixed with _ to indicate intentionally unused for now
): Promise<void> {
  const startTime = Date.now()

  // Create user context snapshot
  const userContextSnapshot: UserContextSnapshot = {
    assumedDefaults: ["vatStatus: unknown", "turnoverBand: unknown"],
  }

  // Create audit sink only (no SSE in shadow mode)
  const auditSink = createAuditSink(shadowRequestId, userContextSnapshot)

  try {
    // Run new pipeline
    const generator = buildAnswerWithReasoning(
      shadowRequestId,
      query,
      surface as "APP" | "MARKETING",
      undefined // No company context in shadow mode for now
    )

    // Consume to completion
    const terminal = await consumeReasoning(generator, [auditSink])

    // Log shadow comparison
    console.info("[ShadowMode] Pipeline completed", {
      shadowRequestId,
      outcome: terminal.outcome,
      durationMs: Date.now() - startTime,
    })
  } catch (error) {
    // Log shadow error (don't fail the main request)
    console.error("[ShadowMode] Pipeline error", {
      shadowRequestId,
      error: error instanceof Error ? error.message : "Unknown",
      durationMs: Date.now() - startTime,
    })
  }
}

/**
 * Compare shadow results for metrics.
 * Called after both pipelines complete.
 */
export async function compareShadowResults(
  legacyRequestId: string,
  shadowRequestId: string
): Promise<{
  match: boolean
  differences: string[]
}> {
  try {
    const trace = await prisma.reasoningTrace.findUnique({
      where: { requestId: shadowRequestId },
    })

    if (!trace) {
      return { match: false, differences: ["Shadow trace not found"] }
    }

    // Compare outcomes
    // This would need the legacy response stored somewhere for full comparison
    // For now, just verify trace exists

    return { match: true, differences: [] }
  } catch (_error) {
    return { match: false, differences: ["Comparison failed"] }
  }
}
