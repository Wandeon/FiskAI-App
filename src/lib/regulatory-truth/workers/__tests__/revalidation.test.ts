// src/lib/regulatory-truth/workers/__tests__/revalidation.test.ts
//
// Test-Driven Development for Task 4.2: Continuous Re-Validation
//
// Tests the revalidation worker that schedules re-validation of published rules
// based on their risk tier:
// - T0: Weekly (7 days)
// - T1: Bi-weekly (14 days)
// - T2: Monthly (30 days)
// - T3: Quarterly (90 days)

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import {
  REVALIDATION_INTERVALS,
  isRuleDueForRevalidation,
  revalidateRule,
  createRevalidationAlert,
  type RevalidationResult,
  type RuleForRevalidation,
  type RevalidationCheck,
} from "../../utils/revalidation"

describe("revalidation.worker", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-15T10:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("REVALIDATION_INTERVALS", () => {
    it("should define T0 revalidation as weekly (7 days)", () => {
      expect(REVALIDATION_INTERVALS.T0).toBe(7)
    })

    it("should define T1 revalidation as bi-weekly (14 days)", () => {
      expect(REVALIDATION_INTERVALS.T1).toBe(14)
    })

    it("should define T2 revalidation as monthly (30 days)", () => {
      expect(REVALIDATION_INTERVALS.T2).toBe(30)
    })

    it("should define T3 revalidation as quarterly (90 days)", () => {
      expect(REVALIDATION_INTERVALS.T3).toBe(90)
    })
  })

  describe("isRuleDueForRevalidation", () => {
    describe("T0 rules (weekly)", () => {
      it("should mark T0 rule as due when never validated", () => {
        const rule: RuleForRevalidation = {
          id: "rule-1",
          riskTier: "T0",
          lastValidatedAt: null,
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(true)
      })

      it("should mark T0 rule as due when validated more than 7 days ago", () => {
        const rule: RuleForRevalidation = {
          id: "rule-1",
          riskTier: "T0",
          lastValidatedAt: new Date("2026-01-07T10:00:00Z"), // 8 days ago
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(true)
      })

      it("should NOT mark T0 rule as due when validated within 7 days", () => {
        const rule: RuleForRevalidation = {
          id: "rule-1",
          riskTier: "T0",
          lastValidatedAt: new Date("2026-01-10T10:00:00Z"), // 5 days ago
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(false)
      })
    })

    describe("T1 rules (bi-weekly)", () => {
      it("should mark T1 rule as due when never validated", () => {
        const rule: RuleForRevalidation = {
          id: "rule-2",
          riskTier: "T1",
          lastValidatedAt: null,
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(true)
      })

      it("should mark T1 rule as due when validated more than 14 days ago", () => {
        const rule: RuleForRevalidation = {
          id: "rule-2",
          riskTier: "T1",
          lastValidatedAt: new Date("2025-12-31T10:00:00Z"), // 15 days ago
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(true)
      })

      it("should NOT mark T1 rule as due when validated within 14 days", () => {
        const rule: RuleForRevalidation = {
          id: "rule-2",
          riskTier: "T1",
          lastValidatedAt: new Date("2026-01-05T10:00:00Z"), // 10 days ago
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(false)
      })
    })

    describe("T2 rules (monthly)", () => {
      it("should mark T2 rule as due when never validated", () => {
        const rule: RuleForRevalidation = {
          id: "rule-3",
          riskTier: "T2",
          lastValidatedAt: null,
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(true)
      })

      it("should mark T2 rule as due when validated more than 30 days ago", () => {
        const rule: RuleForRevalidation = {
          id: "rule-3",
          riskTier: "T2",
          lastValidatedAt: new Date("2025-12-14T10:00:00Z"), // 32 days ago
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(true)
      })

      it("should NOT mark T2 rule as due when validated within 30 days", () => {
        const rule: RuleForRevalidation = {
          id: "rule-3",
          riskTier: "T2",
          lastValidatedAt: new Date("2025-12-20T10:00:00Z"), // 26 days ago
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(false)
      })
    })

    describe("T3 rules (quarterly)", () => {
      it("should mark T3 rule as due when never validated", () => {
        const rule: RuleForRevalidation = {
          id: "rule-4",
          riskTier: "T3",
          lastValidatedAt: null,
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(true)
      })

      it("should mark T3 rule as due when validated more than 90 days ago", () => {
        const rule: RuleForRevalidation = {
          id: "rule-4",
          riskTier: "T3",
          lastValidatedAt: new Date("2025-10-15T10:00:00Z"), // 92 days ago
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(true)
      })

      it("should NOT mark T3 rule as due when validated within 90 days", () => {
        const rule: RuleForRevalidation = {
          id: "rule-4",
          riskTier: "T3",
          lastValidatedAt: new Date("2025-11-01T10:00:00Z"), // 75 days ago
          status: "PUBLISHED",
        }

        expect(isRuleDueForRevalidation(rule)).toBe(false)
      })
    })

    it("should NOT process non-PUBLISHED rules", () => {
      const rule: RuleForRevalidation = {
        id: "rule-5",
        riskTier: "T0",
        lastValidatedAt: null,
        status: "DRAFT",
      }

      expect(isRuleDueForRevalidation(rule)).toBe(false)
    })
  })

  describe("revalidateRule", () => {
    it("should return passed=true when all checks pass", () => {
      const checks: RevalidationCheck[] = [
        { name: "quote-in-evidence", passed: true },
        { name: "source-availability", passed: true },
        { name: "conflict-detection", passed: true },
        { name: "confidence-recalculation", passed: true },
      ]

      const result = revalidateRule("rule-1", checks)

      expect(result.passed).toBe(true)
      expect(result.ruleId).toBe("rule-1")
      expect(result.failures).toHaveLength(0)
      expect(result.checks).toHaveLength(4)
    })

    it("should return passed=false when quote-in-evidence check fails", () => {
      const checks: RevalidationCheck[] = [
        { name: "quote-in-evidence", passed: false, reason: "Quote not found in evidence" },
        { name: "source-availability", passed: true },
        { name: "conflict-detection", passed: true },
        { name: "confidence-recalculation", passed: true },
      ]

      const result = revalidateRule("rule-1", checks)

      expect(result.passed).toBe(false)
      expect(result.failures).toHaveLength(1)
      expect(result.failures[0]).toEqual({
        check: "quote-in-evidence",
        reason: "Quote not found in evidence",
      })
    })

    it("should return passed=false when source-availability check fails", () => {
      const checks: RevalidationCheck[] = [
        { name: "quote-in-evidence", passed: true },
        { name: "source-availability", passed: false, reason: "Source URL returns 404" },
        { name: "conflict-detection", passed: true },
        { name: "confidence-recalculation", passed: true },
      ]

      const result = revalidateRule("rule-1", checks)

      expect(result.passed).toBe(false)
      expect(result.failures).toHaveLength(1)
      expect(result.failures[0]).toEqual({
        check: "source-availability",
        reason: "Source URL returns 404",
      })
    })

    it("should return passed=false when conflict-detection check fails", () => {
      const checks: RevalidationCheck[] = [
        { name: "quote-in-evidence", passed: true },
        { name: "source-availability", passed: true },
        { name: "conflict-detection", passed: false, reason: "New conflicting rule found" },
        { name: "confidence-recalculation", passed: true },
      ]

      const result = revalidateRule("rule-1", checks)

      expect(result.passed).toBe(false)
      expect(result.failures).toHaveLength(1)
      expect(result.failures[0]).toEqual({
        check: "conflict-detection",
        reason: "New conflicting rule found",
      })
    })

    it("should return passed=false when confidence-recalculation check fails", () => {
      const checks: RevalidationCheck[] = [
        { name: "quote-in-evidence", passed: true },
        { name: "source-availability", passed: true },
        { name: "conflict-detection", passed: true },
        {
          name: "confidence-recalculation",
          passed: false,
          reason: "Confidence dropped below threshold: 0.65 < 0.70",
        },
      ]

      const result = revalidateRule("rule-1", checks)

      expect(result.passed).toBe(false)
      expect(result.failures).toHaveLength(1)
      expect(result.failures[0]).toEqual({
        check: "confidence-recalculation",
        reason: "Confidence dropped below threshold: 0.65 < 0.70",
      })
    })

    it("should collect all failures when multiple checks fail", () => {
      const checks: RevalidationCheck[] = [
        { name: "quote-in-evidence", passed: false, reason: "Quote not found" },
        { name: "source-availability", passed: false, reason: "Source 404" },
        { name: "conflict-detection", passed: true },
        { name: "confidence-recalculation", passed: false, reason: "Low confidence" },
      ]

      const result = revalidateRule("rule-1", checks)

      expect(result.passed).toBe(false)
      expect(result.failures).toHaveLength(3)
      expect(result.failures.map((f) => f.check)).toEqual([
        "quote-in-evidence",
        "source-availability",
        "confidence-recalculation",
      ])
    })
  })

  describe("createRevalidationAlert", () => {
    it("should create alert data with correct structure for failed revalidation", () => {
      const result: RevalidationResult = {
        ruleId: "rule-1",
        passed: false,
        failures: [
          { check: "quote-in-evidence", reason: "Quote not found in evidence" },
          { check: "source-availability", reason: "Source URL returns 404" },
        ],
        checks: [
          { name: "quote-in-evidence", passed: false, reason: "Quote not found in evidence" },
          { name: "source-availability", passed: false, reason: "Source URL returns 404" },
          { name: "conflict-detection", passed: true },
          { name: "confidence-recalculation", passed: true },
        ],
        validatedAt: new Date("2026-01-15T10:00:00Z"),
      }

      const alertData = createRevalidationAlert(result)

      expect(alertData.type).toBe("REVALIDATION_FAILED")
      expect(alertData.severity).toBe("HIGH")
      expect(alertData.affectedRuleIds).toEqual(["rule-1"])
      expect(alertData.humanActionRequired).toBe(true)
      expect(alertData.description).toContain("rule-1")
      expect(alertData.description).toContain("quote-in-evidence")
      expect(alertData.description).toContain("source-availability")
    })

    it("should include all failure reasons in description", () => {
      const result: RevalidationResult = {
        ruleId: "rule-2",
        passed: false,
        failures: [{ check: "conflict-detection", reason: "Conflicting rule xyz found" }],
        checks: [
          { name: "quote-in-evidence", passed: true },
          { name: "source-availability", passed: true },
          { name: "conflict-detection", passed: false, reason: "Conflicting rule xyz found" },
          { name: "confidence-recalculation", passed: true },
        ],
        validatedAt: new Date("2026-01-15T10:00:00Z"),
      }

      const alertData = createRevalidationAlert(result)

      expect(alertData.description).toContain("conflict-detection")
      expect(alertData.description).toContain("Conflicting rule xyz found")
    })

    it("should set humanActionRequired to true for failed revalidation", () => {
      const result: RevalidationResult = {
        ruleId: "rule-3",
        passed: false,
        failures: [{ check: "confidence-recalculation", reason: "Low confidence" }],
        checks: [],
        validatedAt: new Date(),
      }

      const alertData = createRevalidationAlert(result)

      expect(alertData.humanActionRequired).toBe(true)
    })
  })

  describe("validation suite completeness", () => {
    it("should run quote-in-evidence check during revalidation", () => {
      // Verify the check is part of the validation suite
      const checks: RevalidationCheck[] = [
        { name: "quote-in-evidence", passed: true },
        { name: "source-availability", passed: true },
        { name: "conflict-detection", passed: true },
        { name: "confidence-recalculation", passed: true },
      ]

      const result = revalidateRule("rule-1", checks)
      expect(result.checks.some((c) => c.name === "quote-in-evidence")).toBe(true)
    })

    it("should run source-availability check during revalidation", () => {
      const checks: RevalidationCheck[] = [
        { name: "quote-in-evidence", passed: true },
        { name: "source-availability", passed: true },
        { name: "conflict-detection", passed: true },
        { name: "confidence-recalculation", passed: true },
      ]

      const result = revalidateRule("rule-1", checks)
      expect(result.checks.some((c) => c.name === "source-availability")).toBe(true)
    })

    it("should run conflict-detection check during revalidation", () => {
      const checks: RevalidationCheck[] = [
        { name: "quote-in-evidence", passed: true },
        { name: "source-availability", passed: true },
        { name: "conflict-detection", passed: true },
        { name: "confidence-recalculation", passed: true },
      ]

      const result = revalidateRule("rule-1", checks)
      expect(result.checks.some((c) => c.name === "conflict-detection")).toBe(true)
    })

    it("should run confidence-recalculation check during revalidation", () => {
      const checks: RevalidationCheck[] = [
        { name: "quote-in-evidence", passed: true },
        { name: "source-availability", passed: true },
        { name: "conflict-detection", passed: true },
        { name: "confidence-recalculation", passed: true },
      ]

      const result = revalidateRule("rule-1", checks)
      expect(result.checks.some((c) => c.name === "confidence-recalculation")).toBe(true)
    })
  })
})
