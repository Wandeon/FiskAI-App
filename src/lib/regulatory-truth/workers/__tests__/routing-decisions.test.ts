// src/lib/regulatory-truth/workers/__tests__/routing-decisions.test.ts
//
// Unit tests for routing decisions based on health scores

import { describe, it } from "node:test"
import assert from "node:assert"
import { HEALTH_THRESHOLDS, computeAdaptiveThresholds } from "../source-health"

// Type definitions matching router.worker.ts
type RoutingDecision = "SKIP" | "OCR" | "EXTRACT_LOCAL" | "EXTRACT_CLOUD"

interface ScoutResult {
  worthItScore: number
  needsOCR: boolean
  skipReason?: string
  estimatedTokens: number
}

interface BudgetCheckResult {
  allowed: boolean
  denialReason?: string
  recommendedProvider: "LOCAL_OLLAMA" | "CLOUD_OLLAMA" | "CLOUD_OPENAI"
  cloudAllowed?: boolean
}

interface SourceHealthData {
  healthScore: number
  minScoutScore: number
  allowCloud: boolean
  isPaused: boolean
}

// Simplified routing logic matching router.worker.ts
function determineRouting(
  scoutResult: ScoutResult,
  budgetCheck: BudgetCheckResult,
  healthData?: SourceHealthData
): { decision: RoutingDecision; reason: string } {
  const minScoutScore = healthData?.minScoutScore ?? 0.4
  const cloudAllowed = budgetCheck.cloudAllowed ?? true
  const healthScore = healthData?.healthScore ?? 0.5

  if (scoutResult.skipReason) {
    return { decision: "SKIP", reason: scoutResult.skipReason }
  }

  if (scoutResult.worthItScore < minScoutScore) {
    return {
      decision: "SKIP",
      reason: `Low worth-it score: ${(scoutResult.worthItScore * 100).toFixed(1)}% < ${(minScoutScore * 100).toFixed(1)}%`,
    }
  }

  if (scoutResult.needsOCR) {
    return { decision: "OCR", reason: "PDF requires OCR" }
  }

  if (!budgetCheck.allowed) {
    return { decision: "SKIP", reason: `Budget denied: ${budgetCheck.denialReason}` }
  }

  if (budgetCheck.recommendedProvider === "LOCAL_OLLAMA") {
    return {
      decision: "EXTRACT_LOCAL",
      reason: `Local extraction (health=${healthScore.toFixed(2)})`,
    }
  }

  if (
    cloudAllowed &&
    scoutResult.worthItScore >= 0.7 &&
    (budgetCheck.recommendedProvider === "CLOUD_OLLAMA" ||
      budgetCheck.recommendedProvider === "CLOUD_OPENAI")
  ) {
    return { decision: "EXTRACT_CLOUD", reason: `Cloud extraction (high-value)` }
  }

  if (!cloudAllowed) {
    return { decision: "EXTRACT_LOCAL", reason: `Local extraction (cloud restricted)` }
  }

  return { decision: "EXTRACT_LOCAL", reason: `Local extraction (default)` }
}

describe("Routing Decisions", () => {
  describe("Health-Aware Scout Thresholds", () => {
    it("high-health source accepts lower scout scores", () => {
      const highHealthData: SourceHealthData = {
        healthScore: 0.9,
        ...computeAdaptiveThresholds(0.9),
        isPaused: false,
      }

      const scoutResult: ScoutResult = {
        worthItScore: 0.35, // Below default 0.4 threshold
        needsOCR: false,
        estimatedTokens: 1000,
      }

      const budgetCheck: BudgetCheckResult = {
        allowed: true,
        recommendedProvider: "LOCAL_OLLAMA",
        cloudAllowed: true,
      }

      const result = determineRouting(scoutResult, budgetCheck, highHealthData)
      assert.notStrictEqual(
        result.decision,
        "SKIP",
        "High-health source should accept scout score 0.35"
      )
    })

    it("low-health source requires higher scout scores", () => {
      const lowHealthData: SourceHealthData = {
        healthScore: 0.15,
        ...computeAdaptiveThresholds(0.15),
        isPaused: false,
      }

      const scoutResult: ScoutResult = {
        worthItScore: 0.5, // Normally acceptable
        needsOCR: false,
        estimatedTokens: 1000,
      }

      const budgetCheck: BudgetCheckResult = {
        allowed: true,
        recommendedProvider: "LOCAL_OLLAMA",
        cloudAllowed: false, // Low health restricts cloud
      }

      const result = determineRouting(scoutResult, budgetCheck, lowHealthData)
      assert.strictEqual(
        result.decision,
        "SKIP",
        "Low-health source (threshold 0.7) should reject scout score 0.5"
      )
    })
  })

  describe("Cloud Access Restrictions", () => {
    it("poor health sources cannot use cloud LLM", () => {
      const poorHealthData: SourceHealthData = {
        healthScore: 0.15,
        ...computeAdaptiveThresholds(0.15),
        isPaused: false,
      }

      assert.strictEqual(
        poorHealthData.allowCloud,
        false,
        "Poor health should restrict cloud access"
      )

      const scoutResult: ScoutResult = {
        worthItScore: 0.8, // High value
        needsOCR: false,
        estimatedTokens: 1000,
      }

      const budgetCheck: BudgetCheckResult = {
        allowed: true,
        recommendedProvider: "CLOUD_OLLAMA",
        cloudAllowed: poorHealthData.allowCloud, // Should be false
      }

      const result = determineRouting(scoutResult, budgetCheck, poorHealthData)
      assert.notStrictEqual(
        result.decision,
        "EXTRACT_CLOUD",
        "Poor health source should not route to cloud"
      )
    })

    it("excellent health sources can use cloud LLM", () => {
      const excellentHealthData: SourceHealthData = {
        healthScore: 0.9,
        ...computeAdaptiveThresholds(0.9),
        isPaused: false,
      }

      assert.strictEqual(
        excellentHealthData.allowCloud,
        true,
        "Excellent health should allow cloud access"
      )

      const scoutResult: ScoutResult = {
        worthItScore: 0.8, // High value
        needsOCR: false,
        estimatedTokens: 1000,
      }

      const budgetCheck: BudgetCheckResult = {
        allowed: true,
        recommendedProvider: "CLOUD_OLLAMA",
        cloudAllowed: excellentHealthData.allowCloud,
      }

      const result = determineRouting(scoutResult, budgetCheck, excellentHealthData)
      assert.strictEqual(
        result.decision,
        "EXTRACT_CLOUD",
        "Excellent health source should route high-value content to cloud"
      )
    })
  })

  describe("Routing Transitions at Thresholds", () => {
    it("routing changes when crossing FAIR threshold (cloud access)", () => {
      // FAIR and above: cloud allowed
      const atFairThresholds = computeAdaptiveThresholds(HEALTH_THRESHOLDS.FAIR)
      assert.strictEqual(atFairThresholds.allowCloud, true, "At FAIR should allow cloud")

      // Below FAIR (POOR tier): cloud restricted
      const belowFairThresholds = computeAdaptiveThresholds(HEALTH_THRESHOLDS.FAIR - 0.01)
      assert.strictEqual(belowFairThresholds.allowCloud, false, "Below FAIR should restrict cloud")
    })

    it("routing changes when crossing EXCELLENT threshold", () => {
      const atExcellent = computeAdaptiveThresholds(HEALTH_THRESHOLDS.EXCELLENT)
      const belowExcellent = computeAdaptiveThresholds(HEALTH_THRESHOLDS.EXCELLENT - 0.01)

      // At EXCELLENT: 50% budget bonus
      assert.strictEqual(atExcellent.budgetMultiplier, 1.5, "At EXCELLENT should get 1.5x budget")

      // Below EXCELLENT: 20% budget bonus
      assert.strictEqual(
        belowExcellent.budgetMultiplier,
        1.2,
        "Below EXCELLENT should get 1.2x budget"
      )
    })
  })

  describe("Budget Denial Handling", () => {
    it("budget denial always results in SKIP", () => {
      const healthData: SourceHealthData = {
        healthScore: 0.9,
        ...computeAdaptiveThresholds(0.9),
        isPaused: false,
      }

      const scoutResult: ScoutResult = {
        worthItScore: 0.95, // Very high value
        needsOCR: false,
        estimatedTokens: 1000,
      }

      const budgetCheck: BudgetCheckResult = {
        allowed: false,
        denialReason: "DAILY_CAP_EXCEEDED",
        recommendedProvider: "LOCAL_OLLAMA",
        cloudAllowed: true,
      }

      const result = determineRouting(scoutResult, budgetCheck, healthData)
      assert.strictEqual(result.decision, "SKIP", "Budget denial should always SKIP")
      assert.ok(result.reason.includes("Budget denied"), "Reason should mention budget denial")
    })
  })

  describe("OCR Routing", () => {
    it("OCR flag routes to OCR regardless of health", () => {
      const lowHealthData: SourceHealthData = {
        healthScore: 0.1, // Very low
        ...computeAdaptiveThresholds(0.1),
        isPaused: false,
      }

      const scoutResult: ScoutResult = {
        worthItScore: 0.9, // High value
        needsOCR: true, // Needs OCR
        estimatedTokens: 1000,
      }

      const budgetCheck: BudgetCheckResult = {
        allowed: true,
        recommendedProvider: "LOCAL_OLLAMA",
        cloudAllowed: false,
      }

      const result = determineRouting(scoutResult, budgetCheck, lowHealthData)
      assert.strictEqual(result.decision, "OCR", "Should route to OCR when flag is set")
    })
  })

  describe("Default Health Behavior", () => {
    it("uses default thresholds when health data is undefined", () => {
      const scoutResult: ScoutResult = {
        worthItScore: 0.45, // Above default 0.4 threshold
        needsOCR: false,
        estimatedTokens: 1000,
      }

      const budgetCheck: BudgetCheckResult = {
        allowed: true,
        recommendedProvider: "LOCAL_OLLAMA",
        cloudAllowed: true,
      }

      const result = determineRouting(scoutResult, budgetCheck, undefined)
      assert.strictEqual(
        result.decision,
        "EXTRACT_LOCAL",
        "Should use default 0.4 threshold when no health data"
      )
    })

    it("skips content below default threshold when no health data", () => {
      const scoutResult: ScoutResult = {
        worthItScore: 0.35, // Below default 0.4 threshold
        needsOCR: false,
        estimatedTokens: 1000,
      }

      const budgetCheck: BudgetCheckResult = {
        allowed: true,
        recommendedProvider: "LOCAL_OLLAMA",
        cloudAllowed: true,
      }

      const result = determineRouting(scoutResult, budgetCheck, undefined)
      assert.strictEqual(result.decision, "SKIP", "Should skip below default threshold")
    })
  })
})
