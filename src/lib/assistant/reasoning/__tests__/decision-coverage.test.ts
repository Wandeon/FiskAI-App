import { describe, it, expect } from "vitest"
import {
  calculateDecisionCoverage,
  type DecisionCoverageResult,
  type ResolvedDimension,
} from "../decision-coverage"

describe("Decision Coverage Calculator", () => {
  describe("calculateDecisionCoverage", () => {
    it("should return ANSWER when all dimensions resolved", () => {
      const result = calculateDecisionCoverage("vat-rate", {
        Item: "coffee",
        ServiceContext: "on-premises",
        Date: "2025-01-01",
        Place: "HR",
        BuyerType: "B2C",
      })

      expect(result.terminalOutcome).toBe("ANSWER")
      expect(result.requiredScore).toBe(1)
      expect(result.totalScore).toBe(1)
    })

    it("should return CONDITIONAL_ANSWER when optional dimensions missing", () => {
      const result = calculateDecisionCoverage("vat-rate", {
        Item: "coffee",
        Date: "2025-01-01",
        Place: "HR",
        // ServiceContext missing (optional)
        // BuyerType missing (optional)
      })

      expect(result.terminalOutcome).toBe("CONDITIONAL_ANSWER")
      expect(result.requiredScore).toBe(1)
      expect(result.totalScore).toBeLessThan(1)
      expect(result.branches).toBeDefined()
    })

    it("should return REFUSAL when required dimensions missing", () => {
      const result = calculateDecisionCoverage("vat-rate", {
        // Item missing (required)
        Date: "2025-01-01",
        Place: "HR",
      })

      expect(result.terminalOutcome).toBe("REFUSAL")
      expect(result.requiredScore).toBeLessThan(1)
      expect(result.unresolved.some((u) => u.dimension === "Item")).toBe(true)
    })

    it("should handle conditional requirements", () => {
      // B2B requires VAT_ID
      const result = calculateDecisionCoverage("vat-rate", {
        Item: "coffee",
        Date: "2025-01-01",
        Place: "HR",
        BuyerType: "B2B",
        // VAT_ID missing (conditionally required)
      })

      expect(result.terminalOutcome).toBe("REFUSAL")
      expect(result.unresolved.some((u) => u.dimension === "VAT_ID")).toBe(true)
    })

    it("should not require VAT_ID for B2C", () => {
      const result = calculateDecisionCoverage("vat-rate", {
        Item: "coffee",
        ServiceContext: "on-premises",
        Date: "2025-01-01",
        Place: "HR",
        BuyerType: "B2C",
        // VAT_ID not required for B2C
      })

      expect(result.terminalOutcome).toBe("ANSWER")
      // Verify VAT_ID is not in the unresolved list
      expect(result.unresolved.some((u) => u.dimension === "VAT_ID")).toBe(false)
    })
  })
})
