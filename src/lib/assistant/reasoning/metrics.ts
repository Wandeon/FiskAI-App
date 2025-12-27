// src/lib/assistant/reasoning/metrics.ts
import type { TerminalOutcome, RiskTier } from "./types"
import type { Surface } from "../types"

export type MetricEvent =
  | { type: "request"; requestId: string; surface: Surface; riskTier: RiskTier }
  | { type: "outcome"; requestId: string; outcome: TerminalOutcome; durationMs: number }
  | { type: "safety_violation"; requestId: string; violation: string }
  | { type: "clarification"; requestId: string }
  | { type: "dispute"; requestId: string; confidence: number }

export interface MetricStats {
  totalRequests: number
  outcomes: Record<TerminalOutcome, number>
  byRiskTier: Record<RiskTier, number>
  bySurface: Record<Surface, number>
  avgDurationMs: number
  safetyViolations: number
  violationsByType?: Record<string, number>
  clarificationRate: number
  disputeRate: number
  highConfidenceDisputeRate: number
}

export interface ReasoningMetrics {
  recordRequest(requestId: string, surface: Surface, riskTier: RiskTier): void
  recordOutcome(requestId: string, outcome: TerminalOutcome, durationMs: number): void
  recordSafetyViolation(requestId: string, violation: string): void
  recordClarification(requestId: string): void
  recordDispute(requestId: string, confidence: number): void
  getStats(): MetricStats
  reset(): void
}

export function createMetricsCollector(): ReasoningMetrics {
  // In-memory metrics (would be replaced with proper metrics system in production)
  const requests = new Map<string, { surface: Surface; riskTier: RiskTier }>()
  const outcomes: { outcome: TerminalOutcome; durationMs: number }[] = []
  const violations: string[] = []
  const violationsByType = new Map<string, number>()
  let clarifications = 0
  const disputes: { confidence: number }[] = []

  return {
    recordRequest(requestId, surface, riskTier) {
      requests.set(requestId, { surface, riskTier })
    },

    recordOutcome(requestId, outcome, durationMs) {
      outcomes.push({ outcome, durationMs })
    },

    recordSafetyViolation(requestId, violation) {
      violations.push(violation)
      violationsByType.set(violation, (violationsByType.get(violation) || 0) + 1)

      // Log critical violation for monitoring
      console.error("[ReasoningMetrics] SAFETY VIOLATION", {
        requestId,
        violation,
        timestamp: new Date().toISOString(),
      })
    },

    recordClarification(requestId) {
      clarifications++
    },

    recordDispute(requestId, confidence) {
      disputes.push({ confidence })

      // Log dispute for monitoring
      console.warn("[ReasoningMetrics] DISPUTE RECORDED", {
        requestId,
        confidence,
        timestamp: new Date().toISOString(),
      })
    },

    getStats() {
      const totalRequests = requests.size

      // Count outcomes by type
      const outcomeCounts: Record<TerminalOutcome, number> = {
        ANSWER: 0,
        CONDITIONAL_ANSWER: 0,
        REFUSAL: 0,
        ERROR: 0,
      }
      for (const o of outcomes) {
        outcomeCounts[o.outcome]++
      }

      // Count by risk tier
      const riskTierCounts: Record<RiskTier, number> = {
        T0: 0,
        T1: 0,
        T2: 0,
        T3: 0,
      }
      for (const r of requests.values()) {
        riskTierCounts[r.riskTier]++
      }

      // Count by surface
      const surfaceCounts: Record<Surface, number> = {
        APP: 0,
        MARKETING: 0,
      }
      for (const r of requests.values()) {
        surfaceCounts[r.surface]++
      }

      // Calculate average duration
      const avgDurationMs =
        outcomes.length > 0
          ? Math.round(outcomes.reduce((sum, o) => sum + o.durationMs, 0) / outcomes.length)
          : 0

      // Calculate clarification rate
      const clarificationRate = totalRequests > 0 ? clarifications / totalRequests : 0

      // Calculate dispute rate
      const disputeRate = outcomes.length > 0 ? disputes.length / outcomes.length : 0

      // Calculate high-confidence dispute rate (disputes >= 0.9 confidence / answers)
      const highConfidenceDisputes = disputes.filter((d) => d.confidence >= 0.9)
      const answerOutcomes = outcomes.filter(
        (o) => o.outcome === "ANSWER" || o.outcome === "CONDITIONAL_ANSWER"
      )
      const highConfidenceDisputeRate =
        answerOutcomes.length > 0 ? highConfidenceDisputes.length / answerOutcomes.length : 0

      // Build violations by type object
      const violationsByTypeObj: Record<string, number> = {}
      for (const [type, count] of violationsByType.entries()) {
        violationsByTypeObj[type] = count
      }

      return {
        totalRequests,
        outcomes: outcomeCounts,
        byRiskTier: riskTierCounts,
        bySurface: surfaceCounts,
        avgDurationMs,
        safetyViolations: violations.length,
        violationsByType:
          Object.keys(violationsByTypeObj).length > 0 ? violationsByTypeObj : undefined,
        clarificationRate,
        disputeRate,
        highConfidenceDisputeRate,
      }
    },

    reset() {
      requests.clear()
      outcomes.length = 0
      violations.length = 0
      violationsByType.clear()
      clarifications = 0
      disputes.length = 0
    },
  }
}

// Singleton instance for global metrics collection
let metricsInstance: ReasoningMetrics | null = null

export function getMetrics(): ReasoningMetrics {
  if (!metricsInstance) {
    metricsInstance = createMetricsCollector()
  }
  return metricsInstance
}

// Reset singleton (useful for testing)
export function resetMetricsSingleton(): void {
  if (metricsInstance) {
    metricsInstance.reset()
  }
  metricsInstance = null
}
