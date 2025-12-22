// src/lib/regulatory-truth/__tests__/deterministic-validators.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import {
  validatePercentage,
  validateCurrency,
  validateDate,
  validateNumericRange,
  validateExtraction,
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
})
