// src/lib/assistant/reasoning/sinks/audit-sink.ts
import { prisma } from "@/lib/prisma"
import type { ReasoningSink } from "./types"
import type {
  ReasoningEvent,
  UserContextSnapshot,
  TerminalOutcome,
  ContextResolutionPayload,
  ApplicabilityPayload,
  ConflictsStagePayload,
  ConfidencePayload,
  RefusalPayload,
} from "../types"
import { isTerminal, getTerminalOutcome } from "../types"

export function createAuditSink(
  requestId: string,
  userContextSnapshot: UserContextSnapshot
): ReasoningSink {
  const events: ReasoningEvent[] = []
  const startTime = Date.now()

  return {
    mode: "buffered",

    write(event: ReasoningEvent): void {
      events.push(event)
    },

    async flush(): Promise<void> {
      if (events.length === 0) return

      // Find terminal event
      const terminalEvent = events.find(isTerminal)
      if (!terminalEvent) {
        console.error("[AuditSink] No terminal event found", { requestId })
        return
      }

      // Extract summary data from events
      const contextEvent = events.find(
        (e) => e.stage === "CONTEXT_RESOLUTION" && e.status === "complete"
      )
      const applicabilityEvent = events.find(
        (e) => e.stage === "APPLICABILITY" && e.status === "complete"
      )
      const conflictsEvent = events.find((e) => e.stage === "CONFLICTS" && e.status === "complete")
      const confidenceEvent = events.find(
        (e) => e.stage === "CONFIDENCE" && e.status === "complete"
      )
      const sourcesEvents = events.filter((e) => e.stage === "SOURCES" && e.status === "progress")

      const contextData = contextEvent?.data as ContextResolutionPayload | undefined
      const applicabilityData = applicabilityEvent?.data as ApplicabilityPayload | undefined
      const conflictsData = conflictsEvent?.data as ConflictsStagePayload | undefined
      const confidenceData = confidenceEvent?.data as ConfidencePayload | undefined

      const outcome = getTerminalOutcome(terminalEvent) as TerminalOutcome
      const refusalData =
        terminalEvent.stage === "REFUSAL" ? (terminalEvent.data as RefusalPayload) : undefined

      try {
        await prisma.reasoningTrace.create({
          data: {
            requestId,
            events: events as unknown as object,
            userContextSnapshot: userContextSnapshot as unknown as object,
            outcome,
            domain: contextData?.domain,
            riskTier: contextData?.riskTier,
            confidence: confidenceData?.overallConfidence,
            sourceCount: sourcesEvents.length,
            eligibleRuleCount: applicabilityData?.eligibleRules,
            exclusionCount: applicabilityData?.excludedRules,
            conflictCount: conflictsData?.conflictCount,
            refusalReason: refusalData?.reason,
            durationMs: Date.now() - startTime,
          },
        })
      } catch (error) {
        console.error("[AuditSink] Failed to write trace", { requestId, error })
        // Don't throw - audit failure shouldn't break the response
      }
    },
  }
}
