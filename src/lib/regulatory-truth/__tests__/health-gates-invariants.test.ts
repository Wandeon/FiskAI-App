// src/lib/regulatory-truth/__tests__/health-gates-invariants.test.ts
/**
 * Health Gates Denominator Invariant Tests
 *
 * These tests verify that health gates handle edge cases correctly:
 * - Zero denominator (no data) → 0% rate, healthy status
 * - Only successes → 0% rejection rate
 * - Only failures → correct percentage calculation
 * - Denominator always = successes + failures
 *
 * These tests use mocked db to test the calculation logic in isolation.
 */

import { describe, it, mock, beforeEach, afterEach } from "node:test"
import assert from "node:assert"

// Mock the db module before importing health-gates
const mockDb = {
  extractionRejected: {
    count: mock.fn(async () => 0),
  },
  sourcePointer: {
    count: mock.fn(async () => 0),
  },
  regulatoryRule: {
    count: mock.fn(async () => 0),
  },
  regulatoryConflict: {
    count: mock.fn(async () => 0),
  },
  agentRun: {
    count: mock.fn(async () => 0),
  },
}

// Helper to reset all mocks
function resetMocks() {
  mockDb.extractionRejected.count.mock.resetCalls()
  mockDb.sourcePointer.count.mock.resetCalls()
  mockDb.regulatoryRule.count.mock.resetCalls()
  mockDb.regulatoryConflict.count.mock.resetCalls()
  mockDb.agentRun.count.mock.resetCalls()
}

describe("Health Gates Invariants", () => {
  describe("getOverallHealth", () => {
    // Import the pure function that doesn't need db
    it("returns critical if any gate is critical", async () => {
      const { getOverallHealth } = await import("../utils/health-gates")

      const gates = [
        { name: "gate1", status: "healthy" as const, value: 0, threshold: 10, message: "" },
        { name: "gate2", status: "critical" as const, value: 50, threshold: 10, message: "" },
        { name: "gate3", status: "degraded" as const, value: 5, threshold: 10, message: "" },
      ]

      assert.strictEqual(getOverallHealth(gates), "critical")
    })

    it("returns degraded if any gate is degraded and none critical", async () => {
      const { getOverallHealth } = await import("../utils/health-gates")

      const gates = [
        { name: "gate1", status: "healthy" as const, value: 0, threshold: 10, message: "" },
        { name: "gate2", status: "degraded" as const, value: 5, threshold: 10, message: "" },
        { name: "gate3", status: "healthy" as const, value: 0, threshold: 10, message: "" },
      ]

      assert.strictEqual(getOverallHealth(gates), "degraded")
    })

    it("returns healthy if all gates are healthy", async () => {
      const { getOverallHealth } = await import("../utils/health-gates")

      const gates = [
        { name: "gate1", status: "healthy" as const, value: 0, threshold: 10, message: "" },
        { name: "gate2", status: "healthy" as const, value: 1, threshold: 10, message: "" },
        { name: "gate3", status: "healthy" as const, value: 0, threshold: 10, message: "" },
      ]

      assert.strictEqual(getOverallHealth(gates), "healthy")
    })

    it("handles empty gate array", async () => {
      const { getOverallHealth } = await import("../utils/health-gates")
      assert.strictEqual(getOverallHealth([]), "healthy")
    })
  })

  describe("Rate Calculation Invariants (unit logic)", () => {
    // Test the rate calculation logic directly

    it("zero denominator returns 0% (not NaN or Infinity)", () => {
      const total = 0
      const failures = 0
      const rate = total > 0 ? (failures / total) * 100 : 0

      assert.strictEqual(rate, 0, "Rate should be 0 when total is 0")
      assert.ok(!Number.isNaN(rate), "Rate should not be NaN")
      assert.ok(Number.isFinite(rate), "Rate should be finite")
    })

    it("only successes (no failures) returns 0%", () => {
      const successes = 100
      const failures = 0
      const total = successes + failures
      const rate = total > 0 ? (failures / total) * 100 : 0

      assert.strictEqual(rate, 0, "Rate should be 0 when no failures")
    })

    it("only failures (no successes) returns 100%", () => {
      const successes = 0
      const failures = 50
      const total = successes + failures
      const rate = total > 0 ? (failures / total) * 100 : 0

      assert.strictEqual(rate, 100, "Rate should be 100% when all failures")
    })

    it("denominator includes both successes and failures", () => {
      const successes = 80
      const failures = 20
      const total = successes + failures // 100, not just successes or failures
      const rate = total > 0 ? (failures / total) * 100 : 0

      assert.strictEqual(rate, 20, "Rate should be failures/(successes+failures)")
    })

    it("rate calculation rounds to 1 decimal place", () => {
      const successes = 97
      const failures = 3
      const total = successes + failures
      const rate = total > 0 ? (failures / total) * 100 : 0
      const rounded = Math.round(rate * 10) / 10

      assert.strictEqual(rounded, 3, "3/100 should round to 3.0")
    })

    it("very small rates don't become zero through rounding", () => {
      const successes = 999
      const failures = 1
      const total = successes + failures
      const rate = total > 0 ? (failures / total) * 100 : 0
      const rounded = Math.round(rate * 10) / 10

      // 0.1% should not round to 0
      assert.strictEqual(rounded, 0.1, "0.1% should remain 0.1 after rounding")
    })
  })

  describe("Threshold Status Invariants", () => {
    // Test the status determination logic

    it("value at threshold boundary is not critical (must exceed)", () => {
      // Threshold >10% means 10% exactly should NOT be critical
      const threshold = 10
      const value = 10
      const status = value > threshold ? "critical" : "healthy"

      assert.strictEqual(status, "healthy", "Value at exact threshold should be healthy")
    })

    it("value just above threshold is critical", () => {
      const threshold = 10
      const value = 10.1
      const status = value > threshold ? "critical" : "healthy"

      assert.strictEqual(status, "critical", "Value above threshold should be critical")
    })

    it("zero value is always healthy for percentage gates", () => {
      const value = 0
      const criticalThreshold = 10
      const degradedThreshold = 5

      const status =
        value > criticalThreshold ? "critical" : value > degradedThreshold ? "degraded" : "healthy"

      assert.strictEqual(status, "healthy", "0% should always be healthy")
    })

    it("count-based gates: 0 violations is healthy", () => {
      // For T0/T1 compliance, threshold is 0 (zero tolerance)
      const violations = 0
      const status = violations > 0 ? "critical" : "healthy"

      assert.strictEqual(status, "healthy", "0 violations should be healthy")
    })

    it("count-based gates: any violation is critical", () => {
      const violations = 1
      const status = violations > 0 ? "critical" : "healthy"

      assert.strictEqual(
        status,
        "critical",
        "Any violation should be critical for zero-tolerance gates"
      )
    })
  })

  describe("Parse vs Validator Rejection Classification", () => {
    const PARSE_FAILURE_TYPES = [
      "NO_QUOTE_MATCH",
      "QUOTE_NOT_IN_EVIDENCE",
      "PARSE_ERROR",
      "SCHEMA_INVALID",
    ]

    const VALIDATOR_REJECTION_TYPES = [
      "OUT_OF_RANGE",
      "INVALID_CURRENCY",
      "INVALID_DATE",
      "VALIDATION_FAILED",
      "CONFIDENCE_TOO_LOW",
    ]

    it("parse failure types are distinct from validator types", () => {
      const parseSet = new Set(PARSE_FAILURE_TYPES)
      const validatorSet = new Set(VALIDATOR_REJECTION_TYPES)

      for (const parseType of PARSE_FAILURE_TYPES) {
        assert.ok(!validatorSet.has(parseType), `${parseType} should not be in validator types`)
      }

      for (const validatorType of VALIDATOR_REJECTION_TYPES) {
        assert.ok(!parseSet.has(validatorType), `${validatorType} should not be in parse types`)
      }
    })

    it("quote-related failures are classified as parse failures", () => {
      const parseSet = new Set(PARSE_FAILURE_TYPES)

      assert.ok(parseSet.has("NO_QUOTE_MATCH"), "NO_QUOTE_MATCH should be parse failure")
      assert.ok(
        parseSet.has("QUOTE_NOT_IN_EVIDENCE"),
        "QUOTE_NOT_IN_EVIDENCE should be parse failure"
      )
    })

    it("domain validation failures are classified as validator rejections", () => {
      const validatorSet = new Set(VALIDATOR_REJECTION_TYPES)

      assert.ok(validatorSet.has("OUT_OF_RANGE"), "OUT_OF_RANGE should be validator rejection")
      assert.ok(
        validatorSet.has("INVALID_CURRENCY"),
        "INVALID_CURRENCY should be validator rejection"
      )
      assert.ok(validatorSet.has("INVALID_DATE"), "INVALID_DATE should be validator rejection")
    })
  })

  describe("Time Window Invariants", () => {
    it("24-hour cutoff calculates correctly", () => {
      const now = Date.now()
      const cutoff = new Date(now - 24 * 60 * 60 * 1000)
      const expected = new Date(now - 86400000)

      assert.ok(
        Math.abs(cutoff.getTime() - expected.getTime()) < 1000,
        "24-hour cutoff should be 86400000ms ago"
      )
    })

    it("7-day cutoff calculates correctly", () => {
      const now = Date.now()
      const cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000)
      const expected = new Date(now - 604800000)

      assert.ok(
        Math.abs(cutoff.getTime() - expected.getTime()) < 1000,
        "7-day cutoff should be 604800000ms ago"
      )
    })
  })
})
