// src/lib/regulatory-truth/eval/__tests__/query.test.ts
/**
 * End-to-End Query Tests
 *
 * Tests the full flow: query → evaluation → answer.
 * This is the "first answer" test proving the system works.
 */

import { describe, it, expect } from "vitest"
import { answerQuery, answerMoramLiUciUPdv, formatQueryOutput } from "../query"

describe("First Answer: PDV Registration", () => {
  describe("answerQuery", () => {
    it("evaluates YES when revenue > 60000 EUR", () => {
      const result = answerQuery({
        queryType: "VAT_REGISTRATION",
        context: {
          taxpayer: {
            country: "HR",
            entityType: "OBRT",
            vat: { annualRevenueEurTrailing12m: 92000 },
          },
        },
      })

      expect(result.success).toBe(true)
      expect(result.answer.evaluated).toBe(true)
      expect(result.answer.answerHr).toContain("Da")
      expect(result.answer.answerHr).toContain("moraš ući u sustav PDV-a")
      expect(result.answer.confidence).toBe("HIGH")
      expect(result.citationLabel).toBe("Zakon o PDV-u, čl. 90, st. 1 (NN 152/2024)")
    })

    it("evaluates NO when revenue < 60000 EUR", () => {
      const result = answerQuery({
        queryType: "VAT_REGISTRATION",
        context: {
          taxpayer: {
            country: "HR",
            entityType: "DOO",
            vat: { annualRevenueEurTrailing12m: 45000 },
          },
        },
      })

      expect(result.success).toBe(true)
      expect(result.answer.evaluated).toBe(true)
      expect(result.answer.answerHr).toContain("Ne")
      expect(result.answer.answerHr).toContain("dobrovoljno")
    })

    it("returns citeable answer when revenue missing", () => {
      const result = answerQuery({
        queryType: "VAT_REGISTRATION",
        context: {
          taxpayer: {
            country: "HR",
            entityType: "OBRT",
            vat: {},
          },
        },
      })

      expect(result.success).toBe(false)
      expect(result.answer.evaluated).toBe(false)
      expect(result.answer.answerHr).toContain("Prag")
      expect(result.answer.answerHr).toContain("60000 EUR")
      expect(result.answer.answerHr).toContain("Ako mi kažeš prihod")
      expect(result.answer.confidence).toBe("MEDIUM")
      expect(result.answer.missingField).toBe("taxpayer.vat.annualRevenueEurTrailing12m")
    })
  })

  describe("answerMoramLiUciUPdv (convenience)", () => {
    it("returns YES for 92000 EUR", () => {
      const result = answerMoramLiUciUPdv(92000, "OBRT")

      expect(result.success).toBe(true)
      expect(result.answer.evaluated).toBe(true)
      expect(result.answer.answerHr).toContain("Da")
    })

    it("returns NO for 45000 EUR", () => {
      const result = answerMoramLiUciUPdv(45000, "DOO")

      expect(result.success).toBe(true)
      expect(result.answer.evaluated).toBe(true)
      expect(result.answer.answerHr).toContain("Ne")
    })

    it("returns citeable answer for undefined revenue", () => {
      const result = answerMoramLiUciUPdv(undefined)

      expect(result.answer.evaluated).toBe(false)
      expect(result.answer.answerHr).toContain("Prag")
    })
  })

  describe("formatQueryOutput", () => {
    it("formats evaluated answer", () => {
      const result = answerMoramLiUciUPdv(92000)
      const formatted = formatQueryOutput(result)

      expect(formatted).toContain("Da")
      expect(formatted).toContain("Evaluacija")
      expect(formatted).toContain("92.000")
      expect(formatted).toContain("60.000")
      expect(formatted).toContain("Izvor: Zakon o PDV-u")
      expect(formatted).toContain("Pouzdanost: HIGH")
    })

    it("formats non-evaluated answer with missing field hint", () => {
      const result = answerMoramLiUciUPdv(undefined)
      const formatted = formatQueryOutput(result)

      expect(formatted).toContain("Prag")
      expect(formatted).toContain("Nedostaje")
      expect(formatted).toContain("annualRevenueEurTrailing12m")
    })
  })

  describe("full system output", () => {
    it("produces the expected output structure from spec", () => {
      const result = answerMoramLiUciUPdv(92000, "OBRT")

      // Verify the output matches the spec structure
      expect(result).toMatchObject({
        success: true,
        queryType: "VAT_REGISTRATION",
        answer: {
          evaluated: true,
          confidence: "HIGH",
          evaluation: {
            field: "taxpayer.vat.annualRevenueEurTrailing12m",
            value: 92000,
            threshold: 60000,
            comparison: ">=",
          },
        },
        citationLabel: "Zakon o PDV-u, čl. 90, st. 1 (NN 152/2024)",
      })

      // Verify citations are present
      expect(result.answer.citations).toHaveLength(1)
      expect(result.answer.citations[0].nodeKey).toBe("/zakon/clanak:90/stavak:1")
    })
  })
})

describe("Edge Cases", () => {
  it("handles exactly 60000 EUR (boundary)", () => {
    const result = answerMoramLiUciUPdv(60000)

    expect(result.success).toBe(true)
    expect(result.answer.evaluated).toBe(true)
    // >= 60000 means must register
    expect(result.answer.answerHr).toContain("Da")
  })

  it("handles 59999 EUR (just below)", () => {
    const result = answerMoramLiUciUPdv(59999)

    expect(result.success).toBe(true)
    expect(result.answer.evaluated).toBe(true)
    expect(result.answer.answerHr).toContain("Ne")
  })

  it("handles 0 EUR", () => {
    const result = answerMoramLiUciUPdv(0)

    expect(result.success).toBe(true)
    expect(result.answer.evaluated).toBe(true)
    expect(result.answer.answerHr).toContain("Ne")
  })

  it("handles very large revenue", () => {
    const result = answerMoramLiUciUPdv(10000000)

    expect(result.success).toBe(true)
    expect(result.answer.evaluated).toBe(true)
    expect(result.answer.answerHr).toContain("Da")
  })
})
