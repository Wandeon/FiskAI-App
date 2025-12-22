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
})
