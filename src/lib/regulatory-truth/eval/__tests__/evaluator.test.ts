// src/lib/regulatory-truth/eval/__tests__/evaluator.test.ts
/**
 * Tests for Rule Evaluator
 *
 * Verifies the end-to-end evaluation flow:
 * - Rule evaluation with context
 * - Answer generation
 * - Citation building
 */

import { describe, it, expect } from "vitest"
import {
  evaluateRule,
  generateAnswer,
  VAT_REGISTRATION_RULE,
  getVatThresholdCitationLabel,
  type EvaluationContext,
} from "../index"

// =============================================================================
// Evaluation Context Fixtures
// =============================================================================

function createContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    taxpayer: {
      country: "HR",
      entityType: "OBRT",
      vat: {},
      ...overrides.taxpayer,
    },
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("evaluateRule", () => {
  describe("VAT Registration Rule", () => {
    it("triggers registration when revenue >= 60000 EUR", () => {
      const context = createContext({
        taxpayer: {
          country: "HR",
          entityType: "OBRT",
          vat: {
            annualRevenueEurTrailing12m: 92000,
          },
        },
      })

      const result = evaluateRule(VAT_REGISTRATION_RULE, context)

      expect(result.success).toBe(true)
      expect(result.matched).toBe(true)
      expect(result.obligations).toHaveLength(1)
      expect(result.obligations[0].code).toBe("VAT_REGISTER")
      expect(result.setFields["taxpayer.vat.mustRegisterVAT"]).toBe(true)
      expect(result.evaluation.field).toBe("taxpayer.vat.annualRevenueEurTrailing12m")
      expect(result.evaluation.fieldValue).toBe(92000)
      expect(result.evaluation.threshold).toBe(60000)
      expect(result.evaluation.result).toBe(true)
    })

    it("does not trigger when revenue < 60000 EUR", () => {
      const context = createContext({
        taxpayer: {
          country: "HR",
          entityType: "DOO",
          vat: {
            annualRevenueEurTrailing12m: 45000,
          },
        },
      })

      const result = evaluateRule(VAT_REGISTRATION_RULE, context)

      expect(result.success).toBe(true)
      expect(result.matched).toBe(false)
      expect(result.obligations).toHaveLength(0)
      expect(result.setFields["taxpayer.vat.mustRegisterVAT"]).toBe(false)
    })

    it("triggers at exactly 60000 EUR (boundary)", () => {
      const context = createContext({
        taxpayer: {
          country: "HR",
          entityType: "JDOO",
          vat: {
            annualRevenueEurTrailing12m: 60000,
          },
        },
      })

      const result = evaluateRule(VAT_REGISTRATION_RULE, context)

      expect(result.success).toBe(true)
      expect(result.matched).toBe(true) // >= 60000
      expect(result.obligations[0].code).toBe("VAT_REGISTER")
    })

    it("does not trigger at 59999 EUR (just below boundary)", () => {
      const context = createContext({
        taxpayer: {
          country: "HR",
          entityType: "OBRT",
          vat: {
            annualRevenueEurTrailing12m: 59999,
          },
        },
      })

      const result = evaluateRule(VAT_REGISTRATION_RULE, context)

      expect(result.success).toBe(true)
      expect(result.matched).toBe(false)
    })

    it("fails gracefully when revenue field is missing", () => {
      const context = createContext({
        taxpayer: {
          country: "HR",
          entityType: "OBRT",
          vat: {}, // No revenue field
        },
      })

      const result = evaluateRule(VAT_REGISTRATION_RULE, context)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Missing required field")
      expect(result.citations).toHaveLength(1) // Still has citations for non-executable answer
    })

    it("includes correct citations", () => {
      const context = createContext({
        taxpayer: {
          country: "HR",
          entityType: "OBRT",
          vat: {
            annualRevenueEurTrailing12m: 70000,
          },
        },
      })

      const result = evaluateRule(VAT_REGISTRATION_RULE, context)

      expect(result.citations).toHaveLength(1)
      expect(result.citations[0].nodeKey).toBe("/zakon/clanak:90/stavak:1")
    })
  })
})

describe("generateAnswer", () => {
  describe("VAT Registration", () => {
    it("generates positive answer when must register", () => {
      const context = createContext({
        taxpayer: {
          country: "HR",
          entityType: "OBRT",
          vat: {
            annualRevenueEurTrailing12m: 92000,
          },
        },
      })

      const result = evaluateRule(VAT_REGISTRATION_RULE, context)
      const answer = generateAnswer(result, VAT_REGISTRATION_RULE)

      expect(answer.evaluated).toBe(true)
      expect(answer.answerHr).toContain("Da")
      expect(answer.answerHr).toContain("moraš ući u sustav PDV-a")
      expect(answer.answerHr).toContain("60.000")
      expect(answer.answerHr).toContain("92.000")
      expect(answer.confidence).toBe("HIGH")
      expect(answer.evaluation?.threshold).toBe(60000)
      expect(answer.evaluation?.value).toBe(92000)
    })

    it("generates negative answer when exempt", () => {
      const context = createContext({
        taxpayer: {
          country: "HR",
          entityType: "OBRT",
          vat: {
            annualRevenueEurTrailing12m: 45000,
          },
        },
      })

      const result = evaluateRule(VAT_REGISTRATION_RULE, context)
      const answer = generateAnswer(result, VAT_REGISTRATION_RULE)

      expect(answer.evaluated).toBe(true)
      expect(answer.answerHr).toContain("Ne")
      expect(answer.answerHr).toContain("ne moraš")
      expect(answer.answerHr).toContain("dobrovoljno")
      expect(answer.confidence).toBe("HIGH")
    })

    it("generates citeable answer when field missing", () => {
      const context = createContext({
        taxpayer: {
          country: "HR",
          entityType: "OBRT",
          vat: {},
        },
      })

      const result = evaluateRule(VAT_REGISTRATION_RULE, context)
      const answer = generateAnswer(result, VAT_REGISTRATION_RULE)

      expect(answer.evaluated).toBe(false)
      expect(answer.answerHr).toContain("Prag")
      expect(answer.answerHr).toContain("60000 EUR")
      expect(answer.answerHr).toContain("Ako mi kažeš prihod")
      expect(answer.confidence).toBe("MEDIUM")
      expect(answer.missingField).toBe("taxpayer.vat.annualRevenueEurTrailing12m")
    })
  })
})

describe("getVatThresholdCitationLabel", () => {
  it("returns formatted citation label", () => {
    const label = getVatThresholdCitationLabel()

    expect(label).toBe("Zakon o PDV-u, čl. 90, st. 1 (NN 152/2024)")
  })
})

describe("context mutation", () => {
  it("mutates context with evaluated result", () => {
    const context = createContext({
      taxpayer: {
        country: "HR",
        entityType: "OBRT",
        vat: {
          annualRevenueEurTrailing12m: 92000,
        },
      },
    })

    // Before evaluation
    expect(context.taxpayer.vat?.mustRegisterVAT).toBeUndefined()

    evaluateRule(VAT_REGISTRATION_RULE, context)

    // After evaluation
    expect(context.taxpayer.vat?.mustRegisterVAT).toBe(true)
  })
})
