/**
 * ANSWER SYNTHESIZER TESTS
 *
 * Tests for LLM-based answer synthesis functionality.
 *
 * NOTE: These tests require OPENAI_API_KEY to be set.
 * They are integration tests that call the actual OpenAI API.
 */

import { describe, it } from "node:test"
import assert from "node:assert"
import { synthesizeAnswer, synthesizeMultiRuleAnswer } from "../answer-synthesizer"
import type { RuleCandidate } from "../rule-selector"

// Skip tests if no API key is configured
const SKIP_TESTS = !process.env.OPENAI_API_KEY

describe("Answer Synthesizer", () => {
  const mockRule: RuleCandidate = {
    id: "rule-1",
    conceptSlug: "pdv-stopa",
    titleHr: "Opća stopa PDV-a",
    bodyHr: "Opća stopa poreza na dodanu vrijednost u Hrvatskoj iznosi 25%.",
    explanationHr: "Primjenjuje se na većinu proizvoda i usluga.",
    value: "25",
    valueType: "percentage",
    authority: "LAW",
    confidence: 0.95,
    effectiveFrom: "2013-01-01",
    effectiveUntil: null,
    appliesWhen: null,
    obligationType: "OBLIGATION",
  }

  it("should synthesize answer from single rule", { skip: SKIP_TESTS }, async () => {
    const context = {
      userQuery: "Kolika je stopa PDV-a u Hrvatskoj?",
      rules: [mockRule],
      primaryRule: mockRule,
      surface: "MARKETING" as const,
    }

    const result = await synthesizeAnswer(context)

    assert.ok(result, "Should return synthesized answer")
    assert.ok(result.headline.length > 0, "Should have headline")
    assert.ok(result.headline.length <= 120, "Headline should be within length limit")
    assert.ok(result.directAnswer.length > 0, "Should have direct answer")
    assert.ok(result.directAnswer.length <= 240, "Answer should be within length limit")
    assert.strictEqual(result.confidence, 0.95, "Should preserve rule confidence")
  })

  it("should synthesize answer from multiple rules", { skip: SKIP_TESTS }, async () => {
    const rule2: RuleCandidate = {
      ...mockRule,
      id: "rule-2",
      titleHr: "Snižena stopa PDV-a",
      bodyHr: "Snižena stopa PDV-a iznosi 13% za određene proizvode.",
      value: "13",
      conceptSlug: "pdv-stopa-snizena",
    }

    const context = {
      userQuery: "Koje su stope PDV-a u Hrvatskoj?",
      rules: [mockRule, rule2],
      primaryRule: mockRule,
      surface: "MARKETING" as const,
    }

    const result = await synthesizeMultiRuleAnswer(context)

    assert.ok(result, "Should return synthesized answer")
    assert.ok(result.headline.length > 0, "Should have headline")
    assert.ok(result.directAnswer.length > 0, "Should have direct answer")
    // Multi-rule answer should mention both rates or indicate multiple scenarios
    assert.ok(
      result.directAnswer.includes("25") || result.directAnswer.includes("13"),
      "Should reference rule values"
    )
  })

  it("should handle synthesis failure gracefully", async () => {
    // Test with invalid context to trigger error handling
    const context = {
      userQuery: "",
      rules: [],
      primaryRule: mockRule,
      surface: "MARKETING" as const,
    }

    const result = await synthesizeAnswer(context)

    // Should return null on failure, allowing fallback to template-based answer
    assert.strictEqual(result, null, "Should return null on failure")
  })

  it("should include company context when provided", { skip: SKIP_TESTS }, async () => {
    const context = {
      userQuery: "Kolika je stopa PDV-a za moj obrt?",
      rules: [mockRule],
      primaryRule: mockRule,
      surface: "APP" as const,
      companyContext: {
        legalForm: "OBRT",
        vatStatus: "U sustavu PDV-a",
      },
    }

    const result = await synthesizeAnswer(context)

    assert.ok(result, "Should return synthesized answer with company context")
    assert.ok(result.headline.length > 0, "Should have headline")
    assert.ok(result.directAnswer.length > 0, "Should have direct answer")
  })
})
