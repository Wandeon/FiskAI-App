// src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import {
  validatePercentage,
  validateCurrency,
  validateDate,
  validateNumericRange,
  validateExtraction,
  validateValueInQuote,
  validateInterestRate,
  validateExchangeRate,
  validateByDomain,
} from "../utils/deterministic-validators"

describe("deterministic-validators", () => {
  describe("validatePercentage", () => {
    it("accepts valid percentages 0-100", () => {
      assert.strictEqual(validatePercentage(25).valid, true)
      assert.strictEqual(validatePercentage(0).valid, true)
      assert.strictEqual(validatePercentage(100).valid, true)
    })

    it("rejects percentages > 100", () => {
      const result = validatePercentage(150)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("exceed 100"))
    })

    it("rejects negative percentages", () => {
      const result = validatePercentage(-5)
      assert.strictEqual(result.valid, false)
    })

    it("accepts custom max percentage", () => {
      assert.strictEqual(validatePercentage(25, 30).valid, true)
      assert.strictEqual(validatePercentage(30, 30).valid, true)
    })

    it("rejects values above custom max", () => {
      const result = validatePercentage(35, 30)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("exceed 30"))
    })
  })

  describe("validateCurrency", () => {
    it("accepts reasonable EUR amounts", () => {
      assert.strictEqual(validateCurrency(40000, "eur").valid, true)
      assert.strictEqual(validateCurrency(1000000, "eur").valid, true)
    })

    it("rejects negative amounts", () => {
      const result = validateCurrency(-100, "eur")
      assert.strictEqual(result.valid, false)
    })

    it("rejects absurdly large amounts", () => {
      const result = validateCurrency(999999999999, "eur")
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("unrealistic"))
    })
  })

  describe("validateDate", () => {
    it("accepts valid ISO dates", () => {
      assert.strictEqual(validateDate("2025-01-15").valid, true)
    })

    it("rejects invalid date formats", () => {
      assert.strictEqual(validateDate("15/01/2025").valid, false)
      assert.strictEqual(validateDate("2025-13-01").valid, false)
    })

    it("rejects dates too far in past", () => {
      const result = validateDate("1900-01-01")
      assert.strictEqual(result.valid, false)
    })

    it("rejects dates too far in future", () => {
      const result = validateDate("2100-01-01")
      assert.strictEqual(result.valid, false)
    })
  })

  describe("validateNumericRange", () => {
    it("accepts values within range", () => {
      assert.strictEqual(validateNumericRange(50, 0, 100).valid, true)
      assert.strictEqual(validateNumericRange(0, 0, 100).valid, true)
      assert.strictEqual(validateNumericRange(100, 0, 100).valid, true)
    })

    it("rejects values below minimum", () => {
      const result = validateNumericRange(-1, 0, 100)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("below minimum"))
    })

    it("rejects values above maximum", () => {
      const result = validateNumericRange(101, 0, 100)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("above maximum"))
    })
  })

  describe("validateExtraction", () => {
    it("passes valid extraction", () => {
      const result = validateExtraction({
        domain: "pdv",
        value_type: "percentage",
        extracted_value: 25,
        exact_quote: "PDV stopa iznosi 25%",
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, true)
      assert.deepStrictEqual(result.errors, [])
    })

    it("catches invalid percentage", () => {
      const result = validateExtraction({
        domain: "pdv",
        value_type: "percentage",
        extracted_value: 150,
        exact_quote: "stopa iznosi 150%",
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, false)
      assert.ok(result.errors.length > 0)
    })
  })

  describe("validateValueInQuote", () => {
    it("accepts when value appears in quote", () => {
      const result = validateValueInQuote("25", "PDV stopa iznosi 25%")
      assert.strictEqual(result.valid, true)
    })

    it("accepts numeric match with formatting", () => {
      const result = validateValueInQuote("40000", "Prag iznosi 40.000 EUR")
      assert.strictEqual(result.valid, true)
    })

    it("accepts date match", () => {
      const result = validateValueInQuote("2025-01-15", "do 15. siječnja 2025.")
      assert.strictEqual(result.valid, true)
    })

    it("rejects when value NOT in quote", () => {
      const result = validateValueInQuote("30", "PDV stopa iznosi 25%")
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("not found"))
    })

    it("rejects inferred values", () => {
      const result = validateValueInQuote("39816.84", "Paušalni obrt ima prag prihoda")
      assert.strictEqual(result.valid, false)
    })

    it("rejects substring matches in larger numbers", () => {
      // 25 should NOT match in 2025
      const result = validateValueInQuote("25", "Za 2025. godinu stopa iznosi 13%")
      assert.strictEqual(result.valid, false)
    })

    it("requires complete number match not partial", () => {
      // 40 should NOT match in 40.000
      const result = validateValueInQuote("40", "prag od 40.000 EUR")
      assert.strictEqual(result.valid, false)
    })

    it("handles decimal numbers with comma", () => {
      const result = validateValueInQuote("25.5", "stopa iznosi 25,5%")
      assert.strictEqual(result.valid, true)
    })

    it("handles decimal numbers with period", () => {
      const result = validateValueInQuote("25.5", "stopa iznosi 25.5%")
      assert.strictEqual(result.valid, true)
    })
  })

  describe("validateInterestRate", () => {
    it("accepts valid interest rates 0-20", () => {
      assert.strictEqual(validateInterestRate(5).valid, true)
      assert.strictEqual(validateInterestRate(0).valid, true)
      assert.strictEqual(validateInterestRate(20).valid, true)
    })

    it("rejects interest rates > 20", () => {
      const result = validateInterestRate(25)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("exceed 20"))
    })

    it("rejects negative interest rates", () => {
      const result = validateInterestRate(-1)
      assert.strictEqual(result.valid, false)
    })

    it("accepts custom max interest rate", () => {
      assert.strictEqual(validateInterestRate(15, 15).valid, true)
    })
  })

  describe("validateExchangeRate", () => {
    it("accepts valid exchange rates", () => {
      assert.strictEqual(validateExchangeRate(1.5).valid, true)
      assert.strictEqual(validateExchangeRate(7.5345).valid, true)
      assert.strictEqual(validateExchangeRate(100).valid, true)
    })

    it("rejects zero or negative rates", () => {
      assert.strictEqual(validateExchangeRate(0).valid, false)
      assert.strictEqual(validateExchangeRate(-1).valid, false)
    })

    it("rejects unrealistically low rates", () => {
      const result = validateExchangeRate(0.00001)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("unrealistically low"))
    })

    it("rejects unrealistically high rates", () => {
      const result = validateExchangeRate(20000)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("unrealistically high"))
    })

    it("accepts custom range", () => {
      assert.strictEqual(validateExchangeRate(5, 1, 10).valid, true)
      assert.strictEqual(validateExchangeRate(0.5, 0.1, 1).valid, true)
    })
  })

  describe("validateByDomain", () => {
    it("applies PDV domain percentage max 30", () => {
      assert.strictEqual(validateByDomain("pdv", "percentage", 25).valid, true)
      assert.strictEqual(validateByDomain("pdv", "percentage", 30).valid, true)
      const result = validateByDomain("pdv", "percentage", 35)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("exceed 30"))
    })

    it("applies doprinosi domain percentage max 50", () => {
      assert.strictEqual(validateByDomain("doprinosi", "percentage", 40).valid, true)
      assert.strictEqual(validateByDomain("doprinosi", "percentage", 50).valid, true)
      const result = validateByDomain("doprinosi", "percentage", 55)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("exceed 50"))
    })

    it("applies porez_dohodak domain percentage max 60", () => {
      assert.strictEqual(validateByDomain("porez_dohodak", "percentage", 50).valid, true)
      assert.strictEqual(validateByDomain("porez_dohodak", "percentage", 60).valid, true)
      const result = validateByDomain("porez_dohodak", "percentage", 65)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("exceed 60"))
    })

    it("applies pausalni domain currency max 1M EUR", () => {
      assert.strictEqual(validateByDomain("pausalni", "currency_eur", 500000).valid, true)
      assert.strictEqual(validateByDomain("pausalni", "currency_eur", 1000000).valid, true)
      const result = validateByDomain("pausalni", "currency_eur", 1500000)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("unrealistic"))
    })

    it("applies interest_rates domain percentage max 20", () => {
      assert.strictEqual(validateByDomain("interest_rates", "interest_rate", 10).valid, true)
      assert.strictEqual(validateByDomain("interest_rates", "interest_rate", 20).valid, true)
      const result = validateByDomain("interest_rates", "interest_rate", 25)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes("exceed 20"))
    })

    it("applies exchange_rates domain range 0.0001-10000", () => {
      assert.strictEqual(validateByDomain("exchange_rates", "exchange_rate", 7.5345).valid, true)
      assert.strictEqual(validateByDomain("exchange_rates", "exchange_rate", 0.0001).valid, true)
      assert.strictEqual(validateByDomain("exchange_rates", "exchange_rate", 10000).valid, true)
      const resultLow = validateByDomain("exchange_rates", "exchange_rate", 0.00001)
      assert.strictEqual(resultLow.valid, false)
      const resultHigh = validateByDomain("exchange_rates", "exchange_rate", 15000)
      assert.strictEqual(resultHigh.valid, false)
    })

    it("falls back to default ranges for unknown domains", () => {
      assert.strictEqual(validateByDomain("unknown_domain", "percentage", 50).valid, true)
      assert.strictEqual(validateByDomain("unknown_domain", "percentage", 100).valid, true)
      const result = validateByDomain("unknown_domain", "percentage", 150)
      assert.strictEqual(result.valid, false)
    })
  })

  describe("validateExtraction - domain-aware", () => {
    it("accepts PDV extraction with 25%", () => {
      const result = validateExtraction({
        domain: "pdv",
        value_type: "percentage",
        extracted_value: 25,
        exact_quote: "PDV stopa iznosi 25%",
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, true)
    })

    it("rejects PDV extraction with 35% (exceeds max 30)", () => {
      const result = validateExtraction({
        domain: "pdv",
        value_type: "percentage",
        extracted_value: 35,
        exact_quote: "stopa iznosi 35%",
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("exceed 30")))
    })

    it("accepts doprinosi extraction with 45%", () => {
      const result = validateExtraction({
        domain: "doprinosi",
        value_type: "percentage",
        extracted_value: 45,
        exact_quote: "doprinos iznosi 45%",
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, true)
    })

    it("rejects doprinosi extraction with 55% (exceeds max 50)", () => {
      const result = validateExtraction({
        domain: "doprinosi",
        value_type: "percentage",
        extracted_value: 55,
        exact_quote: "doprinos iznosi 55%",
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("exceed 50")))
    })

    it("accepts pausalni extraction with 500000 EUR", () => {
      const result = validateExtraction({
        domain: "pausalni",
        value_type: "currency_eur",
        extracted_value: 500000,
        exact_quote: "prag iznosi 500.000 EUR",
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, true)
    })

    it("rejects pausalni extraction with 1.5M EUR (exceeds max 1M)", () => {
      const result = validateExtraction({
        domain: "pausalni",
        value_type: "currency_eur",
        extracted_value: 1500000,
        exact_quote: "prag iznosi 1.500.000 EUR",
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("unrealistic")))
    })

    it("accepts interest rate extraction with 10%", () => {
      const result = validateExtraction({
        domain: "interest_rates",
        value_type: "interest_rate",
        extracted_value: 10,
        exact_quote: "kamatna stopa iznosi 10%",
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, true)
    })

    it("accepts exchange rate extraction with 7.5345", () => {
      const result = validateExtraction({
        domain: "exchange_rates",
        value_type: "exchange_rate",
        extracted_value: 7.5345,
        exact_quote: '"middle_rate": 7.5345',
        confidence: 0.95,
      })
      assert.strictEqual(result.valid, true)
    })
  })
})
