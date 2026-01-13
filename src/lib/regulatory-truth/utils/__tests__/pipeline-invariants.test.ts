// src/lib/regulatory-truth/utils/__tests__/pipeline-invariants.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  assertAppliedImpliesItems,
  validateOutcome,
  assertExtractorOutputValid,
  assertComposerInputValid,
  assertRuleHasEvidence,
  assertCriticalRuleApproved,
  InvariantViolationError,
} from "../pipeline-invariants"

describe("pipeline-invariants", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  describe("assertAppliedImpliesItems", () => {
    it("throws when SUCCESS_APPLIED has itemsProduced = 0", () => {
      expect(() => assertAppliedImpliesItems("SUCCESS_APPLIED", 0)).toThrow(InvariantViolationError)
    })

    it("does not throw when SUCCESS_APPLIED has itemsProduced > 0", () => {
      expect(() => assertAppliedImpliesItems("SUCCESS_APPLIED", 1)).not.toThrow()
      expect(() => assertAppliedImpliesItems("SUCCESS_APPLIED", 10)).not.toThrow()
    })

    it("does not throw for other outcomes with itemsProduced = 0", () => {
      expect(() => assertAppliedImpliesItems("SUCCESS_NO_CHANGE", 0)).not.toThrow()
      expect(() => assertAppliedImpliesItems("EMPTY_OUTPUT", 0)).not.toThrow()
      expect(() => assertAppliedImpliesItems("VALIDATION_REJECTED", 0)).not.toThrow()
    })

    it("does not throw for null/undefined outcome", () => {
      expect(() => assertAppliedImpliesItems(null, 0)).not.toThrow()
      expect(() => assertAppliedImpliesItems(undefined, 0)).not.toThrow()
    })

    it("includes context in error", () => {
      try {
        assertAppliedImpliesItems("SUCCESS_APPLIED", 0, {
          runId: "test-run-123",
          agentType: "EXTRACTOR",
        })
        expect.fail("Should have thrown")
      } catch (e) {
        const error = e as InvariantViolationError
        expect(error.details.runId).toBe("test-run-123")
        expect(error.details.agentType).toBe("EXTRACTOR")
      }
    })
  })

  describe("validateOutcome", () => {
    it("returns SUCCESS_NO_CHANGE when output exists but no items", () => {
      const outcome = validateOutcome(true, 0, "SUCCESS_APPLIED")
      expect(outcome).toBe("SUCCESS_NO_CHANGE")
      expect(console.warn).toHaveBeenCalled()
    })

    it("returns SUCCESS_APPLIED when output and items exist", () => {
      const outcome = validateOutcome(true, 5, "SUCCESS_APPLIED")
      expect(outcome).toBe("SUCCESS_APPLIED")
    })

    it("returns EMPTY_OUTPUT when no output", () => {
      const outcome = validateOutcome(false, 0, "SUCCESS_APPLIED")
      expect(outcome).toBe("EMPTY_OUTPUT")
    })

    it("preserves non-SUCCESS_APPLIED outcomes", () => {
      expect(validateOutcome(true, 0, "VALIDATION_REJECTED")).toBe("VALIDATION_REJECTED")
      expect(validateOutcome(false, 0, "TIMEOUT")).toBe("TIMEOUT")
    })
  })

  describe("assertExtractorOutputValid", () => {
    it("allows empty arrays (no extraction)", () => {
      expect(() => assertExtractorOutputValid([], [])).not.toThrow()
    })

    it("logs when candidateFactIds populated", () => {
      assertExtractorOutputValid([], ["cf-1", "cf-2"], { evidenceId: "ev-1" })
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Created 2 CandidateFacts"))
    })
  })

  describe("assertComposerInputValid", () => {
    it("throws when no pointers provided", () => {
      expect(() => assertComposerInputValid([])).toThrow(InvariantViolationError)
    })

    it("does not throw when pointers provided", () => {
      expect(() => assertComposerInputValid(["ptr-1"])).not.toThrow()
    })
  })

  describe("assertRuleHasEvidence", () => {
    it("throws when pointerCount is 0", () => {
      expect(() => assertRuleHasEvidence("rule-1", 0)).toThrow(InvariantViolationError)
    })

    it("does not throw when pointerCount > 0", () => {
      expect(() => assertRuleHasEvidence("rule-1", 1)).not.toThrow()
    })
  })

  describe("assertCriticalRuleApproved", () => {
    it("throws when T0 rule has no approvedBy", () => {
      expect(() => assertCriticalRuleApproved("rule-1", "T0", null)).toThrow(
        InvariantViolationError
      )
    })

    it("throws when T1 rule has no approvedBy", () => {
      expect(() => assertCriticalRuleApproved("rule-1", "T1", null)).toThrow(
        InvariantViolationError
      )
    })

    it("does not throw when T0/T1 has approvedBy", () => {
      expect(() => assertCriticalRuleApproved("rule-1", "T0", "user-1")).not.toThrow()
      expect(() => assertCriticalRuleApproved("rule-1", "T1", "user-1")).not.toThrow()
    })

    it("does not throw for T2/T3 without approvedBy", () => {
      expect(() => assertCriticalRuleApproved("rule-1", "T2", null)).not.toThrow()
      expect(() => assertCriticalRuleApproved("rule-1", "T3", null)).not.toThrow()
    })
  })
})
