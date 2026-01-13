// src/lib/regulatory-truth/workers/__tests__/source-health.test.ts
//
// Unit tests for source health scoring and adaptive thresholds

import { describe, it, beforeEach } from "node:test"
import assert from "node:assert"
import {
  computeHealthScore,
  computeAdaptiveThresholds,
  HEALTH_THRESHOLDS,
  HEALTH_STATES,
  configureHealth,
  getHealthConfig,
  _resetForTesting,
  getHealthStateFromScore,
  getHealthStateIndex,
  checkDwellTime,
  computeAllowedStateTransition,
  checkStarvationAllowanceEligibility,
  isObservationMode,
  type HealthConfig,
  type HealthState,
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
        minDwellHoursPoor: 12,
        minDwellHoursCritical: 24,
        starvationAllowanceIntervalHours: 48,
        starvationAllowanceMaxPerWindow: 3,
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

  describe("Health State Helpers", () => {
    it("should convert score to correct health state", () => {
      assert.strictEqual(getHealthStateFromScore(0.9), "EXCELLENT")
      assert.strictEqual(getHealthStateFromScore(0.8), "EXCELLENT") // At boundary
      assert.strictEqual(getHealthStateFromScore(0.7), "GOOD")
      assert.strictEqual(getHealthStateFromScore(0.6), "GOOD") // At boundary
      assert.strictEqual(getHealthStateFromScore(0.5), "FAIR")
      assert.strictEqual(getHealthStateFromScore(0.4), "FAIR") // At boundary
      assert.strictEqual(getHealthStateFromScore(0.3), "POOR")
      assert.strictEqual(getHealthStateFromScore(0.2), "POOR") // At boundary
      assert.strictEqual(getHealthStateFromScore(0.1), "CRITICAL")
      assert.strictEqual(getHealthStateFromScore(0.05), "CRITICAL")
      assert.strictEqual(getHealthStateFromScore(0), "CRITICAL")
    })

    it("should return correct state index", () => {
      assert.strictEqual(getHealthStateIndex("EXCELLENT"), 0)
      assert.strictEqual(getHealthStateIndex("GOOD"), 1)
      assert.strictEqual(getHealthStateIndex("FAIR"), 2)
      assert.strictEqual(getHealthStateIndex("POOR"), 3)
      assert.strictEqual(getHealthStateIndex("CRITICAL"), 4)
    })

    it("should have correct state ordering", () => {
      assert.deepStrictEqual(HEALTH_STATES, ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"])
    })
  })

  describe("Dwell Time (Anti-Flapping)", () => {
    it("should allow upgrade when dwell time satisfied", () => {
      // Source has been in POOR for 13 hours (> 12 required)
      const enteredAt = new Date(Date.now() - 13 * 60 * 60 * 1000)
      const result = checkDwellTime("POOR", enteredAt)
      assert.strictEqual(result.allowed, true, "Should allow upgrade after dwell time")
      assert.strictEqual(result.hoursRemaining, 0)
    })

    it("should block upgrade when dwell time not satisfied (POOR)", () => {
      // Source has been in POOR for only 6 hours (< 12 required)
      const enteredAt = new Date(Date.now() - 6 * 60 * 60 * 1000)
      const result = checkDwellTime("POOR", enteredAt)
      assert.strictEqual(result.allowed, false, "Should block upgrade before dwell time")
      assert.ok(result.hoursRemaining > 5, "Should have hours remaining")
      assert.ok(result.hoursRemaining < 7, "Should have ~6 hours remaining")
    })

    it("should block upgrade when dwell time not satisfied (CRITICAL)", () => {
      // Source has been in CRITICAL for 12 hours (< 24 required)
      const enteredAt = new Date(Date.now() - 12 * 60 * 60 * 1000)
      const result = checkDwellTime("CRITICAL", enteredAt)
      assert.strictEqual(result.allowed, false, "Should block CRITICAL upgrade")
      assert.ok(result.hoursRemaining > 11, "Should have ~12 hours remaining")
    })

    it("should allow upgrade for non-restricted states", () => {
      // FAIR, GOOD, EXCELLENT have no dwell time requirements
      const enteredAt = new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
      assert.strictEqual(checkDwellTime("FAIR", enteredAt).allowed, true)
      assert.strictEqual(checkDwellTime("GOOD", enteredAt).allowed, true)
      assert.strictEqual(checkDwellTime("EXCELLENT", enteredAt).allowed, true)
    })

    it("should use custom config for dwell time", () => {
      const customConfig: HealthConfig = {
        ...getHealthConfig(),
        minDwellHoursPoor: 6, // Reduced from 12
      }
      // 7 hours in POOR (> 6 custom, < 12 default)
      const enteredAt = new Date(Date.now() - 7 * 60 * 60 * 1000)
      const result = checkDwellTime("POOR", enteredAt, customConfig)
      assert.strictEqual(result.allowed, true, "Should allow with reduced dwell time")
    })
  })

  describe("Stepwise Transitions", () => {
    it("should allow single-step upgrade", () => {
      // POOR -> FAIR (one step)
      const enteredAt = new Date(Date.now() - 13 * 60 * 60 * 1000) // Past dwell time
      const result = computeAllowedStateTransition("POOR", "FAIR", enteredAt)
      assert.strictEqual(result.allowedState, "FAIR")
      assert.strictEqual(result.blocked, false)
      assert.strictEqual(result.reason, "HEALTH_UPGRADE")
    })

    it("should block multi-step upgrade", () => {
      // CRITICAL -> GOOD would be 3 steps, but should only allow to POOR
      const enteredAt = new Date(Date.now() - 25 * 60 * 60 * 1000) // Past dwell time
      const result = computeAllowedStateTransition("CRITICAL", "GOOD", enteredAt)
      assert.strictEqual(result.allowedState, "POOR", "Should only allow one step upgrade")
      assert.strictEqual(result.blocked, true)
      assert.strictEqual(result.reason, "STEPWISE_BLOCKED")
    })

    it("should block multi-step upgrade from POOR to EXCELLENT", () => {
      // POOR -> EXCELLENT would be 3 steps
      const enteredAt = new Date(Date.now() - 13 * 60 * 60 * 1000)
      const result = computeAllowedStateTransition("POOR", "EXCELLENT", enteredAt)
      assert.strictEqual(result.allowedState, "FAIR", "Should cap at FAIR")
      assert.strictEqual(result.blocked, true)
      assert.strictEqual(result.reason, "STEPWISE_BLOCKED")
    })

    it("should allow downgrades of any size", () => {
      // EXCELLENT -> CRITICAL (4 steps down) should be allowed
      const enteredAt = new Date()
      const result = computeAllowedStateTransition("EXCELLENT", "CRITICAL", enteredAt)
      assert.strictEqual(result.allowedState, "CRITICAL", "Downgrade should be unrestricted")
      assert.strictEqual(result.blocked, false)
      assert.strictEqual(result.reason, "HEALTH_DOWNGRADE")
    })

    it("should return no change when target equals current", () => {
      const enteredAt = new Date()
      const result = computeAllowedStateTransition("FAIR", "FAIR", enteredAt)
      assert.strictEqual(result.allowedState, "FAIR")
      assert.strictEqual(result.blocked, false)
      assert.strictEqual(result.reason, null)
    })

    it("should prioritize dwell time over stepwise constraint", () => {
      // CRITICAL with insufficient dwell time trying to upgrade
      const enteredAt = new Date(Date.now() - 10 * 60 * 60 * 1000) // Only 10 hours
      const result = computeAllowedStateTransition("CRITICAL", "POOR", enteredAt)
      assert.strictEqual(result.allowedState, "CRITICAL", "Should stay in CRITICAL")
      assert.strictEqual(result.blocked, true)
      assert.strictEqual(result.reason, "DWELL_TIME_BLOCKED")
    })
  })

  describe("No Oscillation Proof", () => {
    it("single good outcome cannot immediately upgrade from CRITICAL", () => {
      // Simulate: source in CRITICAL for 6 hours, health score improves
      const enteredAt = new Date(Date.now() - 6 * 60 * 60 * 1000)

      // Even with EXCELLENT target score, should stay in CRITICAL
      const result = computeAllowedStateTransition("CRITICAL", "EXCELLENT", enteredAt)
      assert.strictEqual(result.allowedState, "CRITICAL", "Must stay in CRITICAL due to dwell time")
      assert.strictEqual(result.reason, "DWELL_TIME_BLOCKED")
    })

    it("rapid improvement is always gradual", () => {
      // Simulate: Perfect data arrives, source should still upgrade gradually
      const states: HealthState[] = []
      let currentState: HealthState = "CRITICAL"

      // Each upgrade requires dwell time satisfaction (simulate passage of time)
      for (let step = 0; step < 5; step++) {
        // Simulate 25 hours passing (enough for CRITICAL dwell)
        const enteredAt = new Date(Date.now() - 25 * 60 * 60 * 1000)
        const result = computeAllowedStateTransition(currentState, "EXCELLENT", enteredAt)
        states.push(result.allowedState)

        // Can only upgrade one level if not already at EXCELLENT
        if (currentState !== "EXCELLENT") {
          const currentIdx = getHealthStateIndex(currentState)
          const newIdx = getHealthStateIndex(result.allowedState)
          assert.ok(
            currentIdx - newIdx <= 1,
            `Step ${step}: From ${currentState} should only upgrade by 1 level, got ${result.allowedState}`
          )
        }
        currentState = result.allowedState
      }

      // After 4 steps from CRITICAL, should be at EXCELLENT
      assert.strictEqual(currentState, "EXCELLENT", "Should reach EXCELLENT after 4 gradual steps")
    })
  })

  describe("Starvation Allowance", () => {
    it("should be eligible when in POOR with no previous allowances", () => {
      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const result = checkStarvationAllowanceEligibility("POOR", null, 0, windowStart)
      assert.strictEqual(result.eligible, true)
    })

    it("should be eligible when in CRITICAL with sufficient interval", () => {
      const windowStart = new Date(Date.now() - 100 * 60 * 60 * 1000)
      const lastAllowance = new Date(Date.now() - 50 * 60 * 60 * 1000) // 50 hours ago
      const result = checkStarvationAllowanceEligibility("CRITICAL", lastAllowance, 1, windowStart)
      assert.strictEqual(result.eligible, true)
    })

    it("should not be eligible when max allowances reached", () => {
      const windowStart = new Date(Date.now() - 100 * 60 * 60 * 1000)
      const lastAllowance = new Date(Date.now() - 50 * 60 * 60 * 1000)
      const result = checkStarvationAllowanceEligibility("POOR", lastAllowance, 3, windowStart)
      assert.strictEqual(result.eligible, false)
      assert.ok(result.reason.includes("Max allowances"))
    })

    it("should not be eligible when interval not reached", () => {
      const windowStart = new Date(Date.now() - 100 * 60 * 60 * 1000)
      const lastAllowance = new Date(Date.now() - 24 * 60 * 60 * 1000) // Only 24 hours ago (< 48)
      const result = checkStarvationAllowanceEligibility("POOR", lastAllowance, 1, windowStart)
      assert.strictEqual(result.eligible, false)
      assert.ok(result.reason.includes("interval"))
    })

    it("should not be eligible for healthy sources", () => {
      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000)
      assert.strictEqual(
        checkStarvationAllowanceEligibility("FAIR", null, 0, windowStart).eligible,
        false
      )
      assert.strictEqual(
        checkStarvationAllowanceEligibility("GOOD", null, 0, windowStart).eligible,
        false
      )
      assert.strictEqual(
        checkStarvationAllowanceEligibility("EXCELLENT", null, 0, windowStart).eligible,
        false
      )
    })

    it("should use custom config for starvation allowance", () => {
      const customConfig: HealthConfig = {
        ...getHealthConfig(),
        starvationAllowanceIntervalHours: 24, // Reduced from 48
        starvationAllowanceMaxPerWindow: 5, // Increased from 3
      }
      const windowStart = new Date(Date.now() - 100 * 60 * 60 * 1000)
      const lastAllowance = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours (> 24 custom)
      const result = checkStarvationAllowanceEligibility(
        "POOR",
        lastAllowance,
        4, // Would be blocked by default (>3), but allowed by custom (<=5)
        windowStart,
        customConfig
      )
      assert.strictEqual(result.eligible, true)
    })
  })

  describe("Observation Mode", () => {
    it("should return false when env var is not set", () => {
      delete process.env.RTL_OBSERVATION_MODE
      assert.strictEqual(isObservationMode(), false)
    })

    it("should return false when env var is not 'true'", () => {
      process.env.RTL_OBSERVATION_MODE = "false"
      assert.strictEqual(isObservationMode(), false)

      process.env.RTL_OBSERVATION_MODE = "1"
      assert.strictEqual(isObservationMode(), false)

      process.env.RTL_OBSERVATION_MODE = ""
      assert.strictEqual(isObservationMode(), false)
    })

    it("should return true when env var is 'true'", () => {
      process.env.RTL_OBSERVATION_MODE = "true"
      assert.strictEqual(isObservationMode(), true)
    })
  })
})
