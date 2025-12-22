// src/lib/regulatory-truth/__tests__/arbiter.test.ts

import { describe, it } from "node:test"
import assert from "node:assert"
import type { ArbiterOutput } from "../schemas"
import { ArbiterOutputSchema } from "../schemas"
import { getAuthorityScore, checkEscalationCriteria } from "../agents/arbiter"

describe("Arbiter Agent", () => {
  it("should validate arbiter output schema", () => {
    const validOutput: ArbiterOutput = {
      arbitration: {
        conflict_id: "test-conflict-id",
        conflict_type: "SOURCE_CONFLICT",
        conflicting_items: [
          {
            item_id: "rule-a",
            item_type: "rule",
            claim: "Rule A claims value is 40000",
          },
          {
            item_id: "rule-b",
            item_type: "rule",
            claim: "Rule B claims value is 42000",
          },
        ],
        resolution: {
          winning_item_id: "rule-a",
          resolution_strategy: "hierarchy",
          rationale_hr: "Zakon iz 2024 ima veću snagu od uredbe iz 2023",
          rationale_en: "Law from 2024 has higher authority than regulation from 2023",
        },
        confidence: 0.95,
        requires_human_review: false,
        human_review_reason: null,
      },
    }

    // Should not throw
    const result = ArbiterOutputSchema.safeParse(validOutput)
    assert.strictEqual(result.success, true, "Valid arbiter output should pass schema validation")
  })

  it("should reject invalid arbiter output", () => {
    const invalidOutput = {
      arbitration: {
        conflict_id: "test-conflict-id",
        conflict_type: "INVALID_TYPE", // Invalid conflict type
        conflicting_items: [],
        resolution: {
          winning_item_id: "rule-a",
          resolution_strategy: "hierarchy",
          rationale_hr: "Test",
          rationale_en: "Test",
        },
        confidence: 1.5, // Invalid confidence (> 1.0)
        requires_human_review: false,
        human_review_reason: null,
      },
    }

    const result = ArbiterOutputSchema.safeParse(invalidOutput)
    assert.strictEqual(
      result.success,
      false,
      "Invalid arbiter output should fail schema validation"
    )
  })

  it("should detect escalation for equal authority levels", () => {
    const scoreA = getAuthorityScore("LAW")
    const scoreB = getAuthorityScore("LAW")

    assert.strictEqual(scoreA, scoreB, "Equal authority levels should have same score")
    assert.strictEqual(scoreA, 1, "LAW should have score 1")
  })

  it("should order authority levels correctly", () => {
    const lawScore = getAuthorityScore("LAW")
    const guidanceScore = getAuthorityScore("GUIDANCE")
    const procedureScore = getAuthorityScore("PROCEDURE")
    const practiceScore = getAuthorityScore("PRACTICE")

    assert.ok(lawScore < guidanceScore, "LAW should have higher authority than GUIDANCE")
    assert.ok(
      guidanceScore < procedureScore,
      "GUIDANCE should have higher authority than PROCEDURE"
    )
    assert.ok(
      procedureScore < practiceScore,
      "PROCEDURE should have higher authority than PRACTICE"
    )
  })

  it("should detect low confidence escalation", () => {
    const ruleA = {
      authorityLevel: "LAW" as const,
      riskTier: "T1",
      effectiveFrom: new Date("2024-01-01"),
      confidence: 0.9,
    }

    const ruleB = {
      authorityLevel: "GUIDANCE" as const,
      riskTier: "T1",
      effectiveFrom: new Date("2023-01-01"),
      confidence: 0.9,
    }

    const arbitrationLowConfidence = {
      conflict_id: "test",
      conflict_type: "SOURCE_CONFLICT" as const,
      conflicting_items: [],
      resolution: {
        winning_item_id: "rule-a",
        resolution_strategy: "hierarchy" as const,
        rationale_hr: "Test",
        rationale_en: "Test",
      },
      confidence: 0.75, // Low confidence
      requires_human_review: false,
      human_review_reason: null,
    }

    const shouldEscalate = checkEscalationCriteria(ruleA, ruleB, arbitrationLowConfidence)
    assert.strictEqual(shouldEscalate, true, "Should escalate for low confidence (<0.8)")
  })

  it("should detect T0 conflict escalation", () => {
    const ruleA = {
      authorityLevel: "LAW" as const,
      riskTier: "T0", // Critical
      effectiveFrom: new Date("2024-01-01"),
      confidence: 0.95,
    }

    const ruleB = {
      authorityLevel: "LAW" as const,
      riskTier: "T0", // Critical
      effectiveFrom: new Date("2023-01-01"),
      confidence: 0.95,
    }

    const arbitration = {
      conflict_id: "test",
      conflict_type: "SOURCE_CONFLICT" as const,
      conflicting_items: [],
      resolution: {
        winning_item_id: "rule-a",
        resolution_strategy: "temporal" as const,
        rationale_hr: "Test",
        rationale_en: "Test",
      },
      confidence: 0.9,
      requires_human_review: false,
      human_review_reason: null,
    }

    const shouldEscalate = checkEscalationCriteria(ruleA, ruleB, arbitration)
    assert.strictEqual(shouldEscalate, true, "Should escalate for T0 vs T0 conflicts")
  })
})
