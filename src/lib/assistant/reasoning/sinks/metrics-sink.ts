// src/lib/assistant/reasoning/sinks/metrics-sink.ts
import type { ReasoningSink } from "./types"
import type { ReasoningEvent, ContextResolutionPayload, RiskTier } from "../types"
import type { Surface } from "../../types"
import { isTerminal, getTerminalOutcome } from "../types"
import { getMetrics } from "../metrics"

/**
 * Metrics sink for live monitoring of reasoning pipeline.
 *
 * Records:
 * - Request count and classification on CONTEXT_RESOLUTION complete
 * - Clarification events when CLARIFICATION stage is emitted
 * - Outcome and duration on terminal events
 *
 * Mode: nonBlocking - metrics recording should never slow down the response
 */
export function createMetricsSink(requestId: string, surface: Surface = "APP"): ReasoningSink {
  const metrics = getMetrics()
  let riskTier: RiskTier = "T2" // Default until context resolution completes
  let requestRecorded = false
  const startTime = Date.now()

  return {
    mode: "nonBlocking",

    write(event: ReasoningEvent): void {
      // On CONTEXT_RESOLUTION complete, record the request with risk tier
      if (event.stage === "CONTEXT_RESOLUTION" && event.status === "complete") {
        const data = event.data as ContextResolutionPayload | undefined
        if (data?.riskTier) {
          riskTier = data.riskTier as RiskTier
        }
        if (!requestRecorded) {
          metrics.recordRequest(requestId, surface, riskTier)
          requestRecorded = true
        }
      }

      // Record clarification events
      if (event.stage === "CLARIFICATION") {
        metrics.recordClarification(requestId)
      }

      // On terminal event, record outcome with duration
      if (isTerminal(event)) {
        const outcome = getTerminalOutcome(event)
        if (outcome) {
          const durationMs = Date.now() - startTime
          metrics.recordOutcome(requestId, outcome, durationMs)
        }
      }
    },

    async flush(): Promise<void> {
      // Metrics are recorded immediately in write(), nothing to flush
      // This method exists for interface compliance
    },
  }
}
