// src/lib/regulatory-truth/utils/__tests__/rule-revocation.test.ts
//
// Unit tests for rule revocation logic

import { describe, it, expect } from "vitest"
import { RevocationReason } from "../rule-revocation.types"

describe("RevocationReason enum", () => {
  it("should have all expected source-related values", () => {
    expect(RevocationReason.SOURCE_RETRACTED).toBe("SOURCE_RETRACTED")
    expect(RevocationReason.SOURCE_SUPERSEDED).toBe("SOURCE_SUPERSEDED")
    expect(RevocationReason.SOURCE_ERROR).toBe("SOURCE_ERROR")
  })

  it("should have all expected extraction-related values", () => {
    expect(RevocationReason.EXTRACTION_ERROR).toBe("EXTRACTION_ERROR")
    expect(RevocationReason.MISINTERPRETATION).toBe("MISINTERPRETATION")
  })

  it("should have all expected conflict-related values", () => {
    expect(RevocationReason.CONFLICT_RESOLUTION).toBe("CONFLICT_RESOLUTION")
    expect(RevocationReason.DUPLICATE).toBe("DUPLICATE")
  })

  it("should have all expected external-related values", () => {
    expect(RevocationReason.EXTERNAL_CORRECTION).toBe("EXTERNAL_CORRECTION")
    expect(RevocationReason.REGULATORY_CHANGE).toBe("REGULATORY_CHANGE")
  })

  it("should have all expected administrative values", () => {
    expect(RevocationReason.MANUAL_REVIEW).toBe("MANUAL_REVIEW")
    expect(RevocationReason.QUALITY_ASSURANCE).toBe("QUALITY_ASSURANCE")
  })
})

describe("Revocation reason formatting", () => {
  it("should format reason correctly for revokedReason field", () => {
    // The revokedReason field uses format: "[REASON] detail"
    const reason = RevocationReason.SOURCE_RETRACTED
    const detail = "Original NN article 123/2024 was corrected"
    const formatted = `[${reason}] ${detail}`

    expect(formatted).toBe("[SOURCE_RETRACTED] Original NN article 123/2024 was corrected")
  })

  it("should be parseable back to reason enum", () => {
    const formatted = "[EXTRACTION_ERROR] LLM misread currency value"
    const match = formatted.match(/^\[([A-Z_]+)\]/)

    expect(match).not.toBeNull()
    expect(match![1]).toBe("EXTRACTION_ERROR")
    expect(RevocationReason[match![1] as keyof typeof RevocationReason]).toBe("EXTRACTION_ERROR")
  })
})

describe("Revocation scenarios documentation", () => {
  // These tests document expected revocation scenarios without hitting the database

  describe("SOURCE_RETRACTED scenario", () => {
    it("should be used when official source issues correction", () => {
      // Example: Narodne novine publishes ispravak (correction)
      const scenario = {
        reason: RevocationReason.SOURCE_RETRACTED,
        detail: "NN 45/2024 Article 15 was corrected in NN 52/2024",
        affectsRules: ["rule-pausalni-threshold-2024"],
      }

      expect(scenario.reason).toBe("SOURCE_RETRACTED")
    })
  })

  describe("SOURCE_SUPERSEDED scenario", () => {
    it("should be used when new law replaces old", () => {
      // Example: New law completely replaces old regulation
      const scenario = {
        reason: RevocationReason.SOURCE_SUPERSEDED,
        detail: "Zakon o paušalnom oporezivanju 2025 replaces 2020 version",
        affectsRules: ["rules-from-2020-law"],
      }

      expect(scenario.reason).toBe("SOURCE_SUPERSEDED")
    })
  })

  describe("EXTRACTION_ERROR scenario", () => {
    it("should be used for LLM parsing mistakes", () => {
      // Example: LLM extracted wrong value from table
      const scenario = {
        reason: RevocationReason.EXTRACTION_ERROR,
        detail: "LLM extracted 1000000 but actual value was 100000",
        affectsRules: ["rule-with-wrong-value"],
      }

      expect(scenario.reason).toBe("EXTRACTION_ERROR")
    })
  })

  describe("CONFLICT_RESOLUTION scenario", () => {
    it("should be used when arbiter resolves conflict by revoking one rule", () => {
      // Example: Two rules for same concept, arbiter picks winner
      const scenario = {
        reason: RevocationReason.CONFLICT_RESOLUTION,
        detail: "Arbiter resolved conflict in favor of rule-abc, revoking rule-xyz",
        affectsRules: ["rule-xyz"],
      }

      expect(scenario.reason).toBe("CONFLICT_RESOLUTION")
    })
  })

  describe("DUPLICATE scenario", () => {
    it("should be used for deduplicated rules", () => {
      // Example: Same rule extracted twice from different evidence
      const scenario = {
        reason: RevocationReason.DUPLICATE,
        detail: "Duplicate of rule-abc (same concept, value, effective date)",
        affectsRules: ["rule-xyz"],
      }

      expect(scenario.reason).toBe("DUPLICATE")
    })
  })

  describe("EXTERNAL_CORRECTION scenario", () => {
    it("should be used when accountant identifies error", () => {
      // Example: Professional accountant spots mistake in extracted rule
      const scenario = {
        reason: RevocationReason.EXTERNAL_CORRECTION,
        detail: "Accountant review identified incorrect PDV rate interpretation",
        affectsRules: ["rule-vat-calculation"],
      }

      expect(scenario.reason).toBe("EXTERNAL_CORRECTION")
    })
  })

  describe("MANUAL_REVIEW scenario", () => {
    it("should be used for human review rejections", () => {
      // Example: Human reviewer in HumanReviewQueue rejects rule
      const scenario = {
        reason: RevocationReason.MANUAL_REVIEW,
        detail: "Rejected during T0 human review - context misinterpreted",
        affectsRules: ["rule-pending-review"],
      }

      expect(scenario.reason).toBe("MANUAL_REVIEW")
    })
  })

  describe("QUALITY_ASSURANCE scenario", () => {
    it("should be used for automated QA failures", () => {
      // Example: Automated QA check finds issue post-creation
      const scenario = {
        reason: RevocationReason.QUALITY_ASSURANCE,
        detail: "QA check detected AppliesWhen DSL now invalid after schema update",
        affectsRules: ["rule-with-invalid-dsl"],
      }

      expect(scenario.reason).toBe("QUALITY_ASSURANCE")
    })
  })
})

describe("Lineage tracking documentation", () => {
  it("should track CandidateFacts that led to rule", () => {
    // Lineage should answer: "What inputs produced this rule?"
    const expectedLineage = {
      candidateFactIds: ["cf1", "cf2"],
      agentRunIds: ["ar1", "ar2"],
      sourcePointerIds: ["sp1", "sp2"],
      evidenceIds: ["e1", "e2"],
      supersededRuleIds: [],
    }

    expect(expectedLineage.candidateFactIds.length).toBe(2)
    expect(expectedLineage.agentRunIds.length).toBe(2)
  })

  it("should track superseded rules", () => {
    // When a rule is superseded by another, track both directions
    const lineage = {
      candidateFactIds: ["cf1"],
      agentRunIds: ["ar1"],
      sourcePointerIds: ["sp1"],
      evidenceIds: ["e1"],
      supersededRuleIds: ["rule-2024-version"],
    }

    expect(lineage.supersededRuleIds).toContain("rule-2024-version")
  })
})
