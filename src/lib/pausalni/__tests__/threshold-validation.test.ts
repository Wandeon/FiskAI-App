import { describe, it, expect } from "vitest"
import { validatePosdFormData, type PosdFormData } from "../forms/posd-generator"

describe("PO-SD threshold validation", () => {
  const createFormData = (grossIncome: number): PosdFormData => {
    const expenseBracket = 25
    const calculatedExpenses = Math.round(grossIncome * (expenseBracket / 100) * 100) / 100
    const netIncome = Math.round((grossIncome - calculatedExpenses) * 100) / 100
    return {
      companyOib: "12345678901",
      companyName: "Test Obrt",
      companyAddress: "Testna ulica 1",
      companyCity: "Zagreb",
      companyPostalCode: "10000",
      periodYear: 2024,
      grossIncome,
      expenseBracket,
      calculatedExpenses,
      netIncome,
      invoiceCount: 10,
    }
  }

  describe("60,000 EUR pausalni threshold", () => {
    it("should pass validation when income is below 60,000 EUR", () => {
      const data = createFormData(59999)
      const result = validatePosdFormData(data)
      expect(result.valid).toBe(true)
      expect(result.errors.some((e) => e.includes("prelazi granicu za pausalno oporezivanje"))).toBe(false)
    })

    it("should pass validation when income is exactly 60,000 EUR", () => {
      const data = createFormData(60000)
      const result = validatePosdFormData(data)
      expect(result.valid).toBe(true)
      expect(result.errors.some((e) => e.includes("prelazi granicu za pausalno oporezivanje"))).toBe(false)
    })

    it("should fail validation when income exceeds 60,000 EUR", () => {
      const data = createFormData(60001)
      const result = validatePosdFormData(data)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("prelazi granicu za pausalno oporezivanje"))).toBe(true)
    })

    it("should include proper Croatian message with diacritics", () => {
      const data = createFormData(75000)
      const result = validatePosdFormData(data)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("Morate prijeci na obrt na dohodak") && e.includes("registrirati se za PDV"))).toBe(true)
    })

    it("should display both income and threshold values in error", () => {
      const data = createFormData(80000)
      const result = validatePosdFormData(data)
      const thresholdError = result.errors.find((e) => e.includes("prelazi granicu za pausalno oporezivanje"))
      expect(thresholdError).toBeDefined()
      expect(thresholdError).toContain("60.000")
      expect(thresholdError).toContain("80.000")
    })
  })
})
