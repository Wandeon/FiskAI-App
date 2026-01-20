// src/lib/regulatory-truth/eval/__tests__/query.test.ts
/**
 * End-to-End Query Tests
 *
 * Tests the full flow: query → evaluation → answer.
 * This is the "first answer" test proving the system works.
 *
 * NOTE (2026-01-20): answerQuery and answerMoramLiUciUPdv are now async.
 * The DB path will fail in unit tests (no DB), falling back to static RULE_REGISTRY.
 */

import { describe, it, expect } from "vitest"
import { answerQuery, answerMoramLiUciUPdv, formatQueryOutput } from "../query"

describe("First Answer: PDV Registration", () => {
  describe("answerQuery", () => {
    it("evaluates YES when revenue > 60000 EUR", async () => {
      const result = await answerQuery({
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

    it("evaluates NO when revenue < 60000 EUR", async () => {
      const result = await answerQuery({
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

    it("returns citeable answer when revenue missing", async () => {
      const result = await answerQuery({
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
    it("returns YES for 92000 EUR", async () => {
      const result = await answerMoramLiUciUPdv(92000, "OBRT")

      expect(result.success).toBe(true)
      expect(result.answer.evaluated).toBe(true)
      expect(result.answer.answerHr).toContain("Da")
    })

    it("returns NO for 45000 EUR", async () => {
      const result = await answerMoramLiUciUPdv(45000, "DOO")

      expect(result.success).toBe(true)
      expect(result.answer.evaluated).toBe(true)
      expect(result.answer.answerHr).toContain("Ne")
    })

    it("returns citeable answer for undefined revenue", async () => {
      const result = await answerMoramLiUciUPdv(undefined)

      expect(result.answer.evaluated).toBe(false)
      expect(result.answer.answerHr).toContain("Prag")
    })
  })

  describe("formatQueryOutput", () => {
    it("formats evaluated answer", async () => {
      const result = await answerMoramLiUciUPdv(92000)
      const formatted = formatQueryOutput(result)

      expect(formatted).toContain("Da")
      expect(formatted).toContain("Evaluacija")
      expect(formatted).toContain("92.000")
      expect(formatted).toContain("60.000")
      expect(formatted).toContain("Izvor: Zakon o PDV-u")
      expect(formatted).toContain("Pouzdanost: HIGH")
    })

    it("formats non-evaluated answer with missing field hint", async () => {
      const result = await answerMoramLiUciUPdv(undefined)
      const formatted = formatQueryOutput(result)

      expect(formatted).toContain("Prag")
      expect(formatted).toContain("Nedostaje")
      expect(formatted).toContain("annualRevenueEurTrailing12m")
    })
  })

  describe("full system output", () => {
    it("produces the expected output structure from spec", async () => {
      const result = await answerMoramLiUciUPdv(92000, "OBRT")

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
  it("handles exactly 60000 EUR (boundary)", async () => {
    const result = await answerMoramLiUciUPdv(60000)

    expect(result.success).toBe(true)
    expect(result.answer.evaluated).toBe(true)
    // >= 60000 means must register
    expect(result.answer.answerHr).toContain("Da")
  })

  it("handles 59999 EUR (just below)", async () => {
    const result = await answerMoramLiUciUPdv(59999)

    expect(result.success).toBe(true)
    expect(result.answer.evaluated).toBe(true)
    expect(result.answer.answerHr).toContain("Ne")
  })

  it("handles 0 EUR", async () => {
    const result = await answerMoramLiUciUPdv(0)

    expect(result.success).toBe(true)
    expect(result.answer.evaluated).toBe(true)
    expect(result.answer.answerHr).toContain("Ne")
  })

  it("handles very large revenue", async () => {
    const result = await answerMoramLiUciUPdv(10000000)

    expect(result.success).toBe(true)
    expect(result.answer.evaluated).toBe(true)
    expect(result.answer.answerHr).toContain("Da")
  })
})

describe("Temporal Selection", () => {
  describe("asOfDate parameter", () => {
    it("includes asOfDate in output", async () => {
      const queryDate = new Date("2025-06-15")
      const result = await answerMoramLiUciUPdv(92000, "OBRT", queryDate)

      expect(result.asOfDate).toBeInstanceOf(Date)
      expect(result.asOfDate.toISOString().split("T")[0]).toBe("2025-06-15")
    })

    it("defaults to current date when asOfDate not provided", async () => {
      const result = await answerMoramLiUciUPdv(92000)

      expect(result.asOfDate).toBeInstanceOf(Date)
      // Should be today (normalized to start of day)
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      expect(result.asOfDate.toISOString().split("T")[0]).toBe(today.toISOString().split("T")[0])
    })

    it("includes temporal selection info when rule is effective", async () => {
      // Query after the rule's effectiveFrom date (2025-01-01)
      const result = await answerMoramLiUciUPdv(92000, "OBRT", new Date("2025-06-15"))

      expect(result.temporalSelection).toBeDefined()
      expect(result.temporalSelection?.wasSelected).toBe(true)
      expect(result.temporalSelection?.reason).toBe("EFFECTIVE")
      expect(result.temporalSelection?.effectivePeriod).toBeDefined()
      expect(result.temporalSelection?.effectivePeriod?.from).toBe("2025-01-01")
      expect(result.temporalSelection?.effectivePeriod?.until).toBeNull()
    })

    it("shows temporal selection info in formatted output", async () => {
      const result = await answerMoramLiUciUPdv(92000, "OBRT", new Date("2025-06-15"))
      const formatted = formatQueryOutput(result)

      expect(formatted).toContain("Temporalna selekcija")
      expect(formatted).toContain("2025-06-15")
      expect(formatted).toContain("2025-01-01")
    })
  })

  describe("rule not yet effective (no coverage)", () => {
    it("returns NO_COVERAGE when query date is before any rule's effectiveFrom", async () => {
      // Query before the rule's effectiveFrom date (2025-01-01)
      const result = await answerMoramLiUciUPdv(92000, "OBRT", new Date("2024-06-15"))

      expect(result.success).toBe(false)
      expect(result.temporalSelection?.wasSelected).toBe(false)
      expect(result.temporalSelection?.reason).toBe("NO_COVERAGE")
      // Should tell user when coverage starts
      expect(result.temporalSelection?.earliestCoverageDate).toBe("2025-01-01")
      expect(result.answer.answerHr).toContain("Nema podataka")
      expect(result.answer.answerHr).toContain("2025-01-01")
    })

    it("does not provide an answer for dates without coverage", async () => {
      // This is the key behavior: don't answer with 60k for 2024
      const result = await answerMoramLiUciUPdv(92000, "OBRT", new Date("2024-12-31"))

      expect(result.success).toBe(false)
      expect(result.answer.evaluated).toBe(false)
      // Should NOT contain the 60k answer
      expect(result.answer.answerHr).not.toContain("moraš ući u sustav PDV-a")
    })
  })

  describe("answerQuery with explicit asOfDate", () => {
    it("passes asOfDate through to temporal selection", async () => {
      const result = await answerQuery({
        queryType: "VAT_REGISTRATION",
        context: {
          taxpayer: {
            country: "HR",
            entityType: "OBRT",
            vat: { annualRevenueEurTrailing12m: 92000 },
          },
        },
        asOfDate: new Date("2025-12-31"),
      })

      expect(result.asOfDate.toISOString().split("T")[0]).toBe("2025-12-31")
      expect(result.temporalSelection?.wasSelected).toBe(true)
    })
  })
})
