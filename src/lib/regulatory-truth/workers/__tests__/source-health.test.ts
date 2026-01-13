// src/lib/regulatory-truth/workers/__tests__/source-health.test.ts
//
// Unit tests for source health scoring and adaptive thresholds

import { describe, it, beforeEach } from "node:test"
import assert from "node:assert"
import {
  computeHealthScore,
  computeAdaptiveThresholds,
  HEALTH_THRESHOLDS,
  configureHealth,
  getHealthConfig,
  _resetForTesting,
  type HealthConfig,
} from "../source-health"

describe("Source Health Scoring", () => {
  beforeEach(() => {
    _resetForTesting()
  })

  describe("computeHealthScore", () => {
    it("should return neutral score (0.5) with insufficient data", () => {
      // Less than minAttemptsForScore (default 10)
      const score = computeHealthScore(5, 2, 1, 1000, 3)
      assert.strictEqual(score, 0.5, "Should return neutral score with <10 attempts")
    })

    it("should return high score for successful source", () => {
      // 90% success rate, good efficiency
      const score = computeHealthScore(90, 5, 5, 90000, 50)
      assert.ok(score >= HEALTH_THRESHOLDS.GOOD, `Score ${score} should be >= GOOD threshold`)
    })

    it("should return low score for high error rate", () => {
      // 50% error rate
      const score = computeHealthScore(20, 10, 20, 30000, 10)
      assert.ok(score < HEALTH_THRESHOLDS.FAIR, `Score ${score} should be < FAIR threshold`)
    })

    it("should return low score for high empty rate", () => {
      // Lots of empty outputs (tokens used but nothing produced)
      const score = computeHealthScore(30, 50, 10, 80000, 10)
      assert.ok(score < HEALTH_THRESHOLDS.FAIR, `Score ${score} should be < FAIR threshold`)
    })

    it("should penalize poor token efficiency", () => {
      // Using lots of tokens for very few items
      const inefficientScore = computeHealthScore(50, 5, 5, 500000, 10) // 50k tokens/item
      const efficientScore = computeHealthScore(50, 5, 5, 50000, 50) // 1k tokens/item
      assert.ok(
        efficientScore > inefficientScore,
        `Efficient source (${efficientScore}) should score higher than inefficient (${inefficientScore})`
      )
    })

    it("should clamp score between 0 and 1", () => {
      // Perfect source
      const perfectScore = computeHealthScore(1000, 0, 0, 100000, 1000)
      assert.ok(perfectScore <= 1, `Score ${perfectScore} should be <= 1`)
      assert.ok(perfectScore >= 0, `Score ${perfectScore} should be >= 0`)

      // Terrible source
      const terribleScore = computeHealthScore(0, 100, 100, 100000, 0)
      assert.ok(terribleScore <= 1, `Score ${terribleScore} should be <= 1`)
      assert.ok(terribleScore >= 0, `Score ${terribleScore} should be >= 0`)
    })

    it("should use custom config when provided", () => {
      const customConfig: HealthConfig = {
        windowSizeHours: 168,
        minAttemptsForScore: 5, // Lower threshold
        autoUnpauseHours: 24,
        successWeight: 0.7, // Higher weight for success
        efficiencyWeight: 0.2,
        emptyPenalty: 0.05,
        errorPenalty: 0.1,
      }

      // With default config (10 attempts required), this would return 0.5
      // With custom config (5 attempts required), it should calculate a real score
      const score = computeHealthScore(7, 1, 1, 9000, 5, customConfig)
      assert.notStrictEqual(score, 0.5, "Should calculate real score with custom config")
    })
  })

  describe("computeAdaptiveThresholds", () => {
    it("should return relaxed thresholds for excellent health", () => {
      const thresholds = computeAdaptiveThresholds(0.9) // Above EXCELLENT (0.8)
      assert.strictEqual(thresholds.minScoutScore, 0.3, "Should have lowest scout threshold")
      assert.strictEqual(thresholds.allowCloud, true, "Should allow cloud")
      assert.strictEqual(thresholds.budgetMultiplier, 1.5, "Should get 50% more budget")
    })

    it("should return slightly relaxed thresholds for good health", () => {
      const thresholds = computeAdaptiveThresholds(0.7) // Between GOOD (0.6) and EXCELLENT
      assert.strictEqual(thresholds.minScoutScore, 0.35)
      assert.strictEqual(thresholds.allowCloud, true)
      assert.strictEqual(thresholds.budgetMultiplier, 1.2)
    })

    it("should return default thresholds for fair health", () => {
      const thresholds = computeAdaptiveThresholds(0.5) // Between FAIR (0.4) and GOOD
      assert.strictEqual(thresholds.minScoutScore, 0.4, "Should have default scout threshold")
      assert.strictEqual(thresholds.allowCloud, true, "Should allow cloud")
      assert.strictEqual(thresholds.budgetMultiplier, 1.0, "Should have normal budget")
    })

    it("should return restricted thresholds for poor health", () => {
      const thresholds = computeAdaptiveThresholds(0.3) // Between POOR (0.2) and FAIR
      assert.strictEqual(thresholds.minScoutScore, 0.5, "Should have higher scout threshold")
      assert.strictEqual(thresholds.allowCloud, false, "Should NOT allow cloud")
      assert.strictEqual(thresholds.budgetMultiplier, 0.5, "Should have half budget")
    })

    it("should return very restricted thresholds for critical health", () => {
      const thresholds = computeAdaptiveThresholds(0.05) // Below CRITICAL (0.1)
      assert.strictEqual(thresholds.minScoutScore, 0.7, "Should have highest scout threshold")
      assert.strictEqual(thresholds.allowCloud, false, "Should NOT allow cloud")
      assert.strictEqual(thresholds.budgetMultiplier, 0.2, "Should have 20% budget")
    })

    it("should transition at exact threshold boundaries", () => {
      // At exactly EXCELLENT boundary
      const atExcellent = computeAdaptiveThresholds(HEALTH_THRESHOLDS.EXCELLENT)
      assert.strictEqual(atExcellent.budgetMultiplier, 1.5, "At EXCELLENT should get bonus")

      // Just below EXCELLENT
      const belowExcellent = computeAdaptiveThresholds(HEALTH_THRESHOLDS.EXCELLENT - 0.01)
      assert.strictEqual(
        belowExcellent.budgetMultiplier,
        1.2,
        "Below EXCELLENT should get GOOD level"
      )

      // At exactly FAIR boundary - cloud is allowed
      const atFair = computeAdaptiveThresholds(HEALTH_THRESHOLDS.FAIR)
      assert.strictEqual(atFair.allowCloud, true, "At FAIR should allow cloud")

      // Just below FAIR - cloud is restricted (POOR tier)
      const belowFair = computeAdaptiveThresholds(HEALTH_THRESHOLDS.FAIR - 0.01)
      assert.strictEqual(belowFair.allowCloud, false, "Below FAIR should restrict cloud")
    })
  })

  describe("Safety Invariants", () => {
    it("paused sources cannot use cloud LLM (threshold check)", () => {
      // When health is critical, allowCloud should be false
      const criticalThresholds = computeAdaptiveThresholds(HEALTH_THRESHOLDS.CRITICAL - 0.01)
      assert.strictEqual(
        criticalThresholds.allowCloud,
        false,
        "Critical health sources should not use cloud LLM"
      )

      const poorThresholds = computeAdaptiveThresholds(HEALTH_THRESHOLDS.POOR - 0.01)
      assert.strictEqual(
        poorThresholds.allowCloud,
        false,
        "Poor health sources should not use cloud LLM"
      )
    })

    it("health score changes are bounded per update", () => {
      // Simulate incremental updates and verify score doesn't swing wildly
      const baseline = computeHealthScore(50, 10, 10, 50000, 25)

      // Add one success
      const afterSuccess = computeHealthScore(51, 10, 10, 51000, 26)
      const successDelta = Math.abs(afterSuccess - baseline)
      assert.ok(
        successDelta < 0.05,
        `Score delta from single success (${successDelta}) should be < 0.05`
      )

      // Add one error
      const afterError = computeHealthScore(50, 10, 11, 51000, 25)
      const errorDelta = Math.abs(afterError - baseline)
      assert.ok(errorDelta < 0.05, `Score delta from single error (${errorDelta}) should be < 0.05`)
    })

    it("router decisions change at threshold boundaries", () => {
      // Verify that crossing a threshold changes the routing decision

      // Just below FAIR - should restrict
      const belowFair = computeAdaptiveThresholds(HEALTH_THRESHOLDS.FAIR - 0.01)
      // Just at FAIR - should be normal
      const atFair = computeAdaptiveThresholds(HEALTH_THRESHOLDS.FAIR)

      assert.notStrictEqual(
        belowFair.minScoutScore,
        atFair.minScoutScore,
        "Scout threshold should change at FAIR boundary"
      )

      // Just below POOR - should be very restricted
      const belowPoor = computeAdaptiveThresholds(HEALTH_THRESHOLDS.POOR - 0.01)
      // Just at POOR - should be restricted
      const atPoor = computeAdaptiveThresholds(HEALTH_THRESHOLDS.POOR)

      assert.notStrictEqual(
        belowPoor.budgetMultiplier,
        atPoor.budgetMultiplier,
        "Budget multiplier should change at POOR boundary"
      )
    })

    it("budget multiplier never exceeds 2x or goes below 0.1x", () => {
      // Test across all health levels
      for (let h = 0; h <= 1; h += 0.1) {
        const thresholds = computeAdaptiveThresholds(h)
        assert.ok(
          thresholds.budgetMultiplier >= 0.1,
          `Budget multiplier ${thresholds.budgetMultiplier} at health ${h} should be >= 0.1`
        )
        assert.ok(
          thresholds.budgetMultiplier <= 2.0,
          `Budget multiplier ${thresholds.budgetMultiplier} at health ${h} should be <= 2.0`
        )
      }
    })
  })

  describe("Health Configuration", () => {
    it("should allow configuration updates", () => {
      const originalConfig = getHealthConfig()

      configureHealth({ windowSizeHours: 72, minAttemptsForScore: 5 })

      const newConfig = getHealthConfig()
      assert.strictEqual(newConfig.windowSizeHours, 72)
      assert.strictEqual(newConfig.minAttemptsForScore, 5)
      // Other values should remain
      assert.strictEqual(newConfig.successWeight, originalConfig.successWeight)
    })

    it("should reset properly for testing", () => {
      configureHealth({ windowSizeHours: 999 })
      const modifiedConfig = getHealthConfig()
      assert.strictEqual(modifiedConfig.windowSizeHours, 999)

      _resetForTesting()
      const resetConfig = getHealthConfig()
      assert.strictEqual(resetConfig.windowSizeHours, 168, "Should reset to default")
    })
  })
})
