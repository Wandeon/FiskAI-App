// src/lib/knowledge-hub/__tests__/constants.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import {
  PAUSAL_TAX_BRACKETS,
  MONTHLY_CONTRIBUTIONS,
  THRESHOLDS,
  HOK,
  PAYMENT_IBANS,
  TZ_RATES,
  getPausalTaxBracket,
} from "../constants"

describe("Knowledge Hub Constants", () => {
  describe("PAUSAL_TAX_BRACKETS", () => {
    it("should have 7 tax brackets", () => {
      assert.strictEqual(PAUSAL_TAX_BRACKETS.length, 7)
    })

    it("should have correct first bracket (0-11300)", () => {
      const first = PAUSAL_TAX_BRACKETS[0]
      assert.strictEqual(first.min, 0)
      assert.strictEqual(first.max, 11300)
      assert.strictEqual(first.quarterlyTax, 50.85)
    })

    it("should have correct last bracket (50000.01-60000)", () => {
      const last = PAUSAL_TAX_BRACKETS[6]
      assert.strictEqual(last.min, 50000.01)
      assert.strictEqual(last.max, 60000)
      assert.strictEqual(last.quarterlyTax, 270)
    })
  })

  describe("getPausalTaxBracket", () => {
    it("should return first bracket for 10000 EUR", () => {
      const bracket = getPausalTaxBracket(10000)
      assert.strictEqual(bracket.quarterlyTax, 50.85)
    })

    it("should return fourth bracket for 25000 EUR", () => {
      const bracket = getPausalTaxBracket(25000)
      assert.strictEqual(bracket.quarterlyTax, 137.7)
    })

    it("should return last bracket for 55000 EUR", () => {
      const bracket = getPausalTaxBracket(55000)
      assert.strictEqual(bracket.quarterlyTax, 270)
    })
  })

  describe("MONTHLY_CONTRIBUTIONS", () => {
    it("should have correct total of 262.51", () => {
      assert.strictEqual(MONTHLY_CONTRIBUTIONS.TOTAL, 262.51)
    })

    it("should have MIO_I at 107.88", () => {
      assert.strictEqual(MONTHLY_CONTRIBUTIONS.MIO_I.amount, 107.88)
    })
  })

  describe("THRESHOLDS", () => {
    it("should have PDV threshold at 60000", () => {
      assert.strictEqual(THRESHOLDS.VAT_REGISTRATION, 60000)
    })
  })

  describe("PAYMENT_IBANS", () => {
    it("should have valid Croatian IBAN format", () => {
      Object.values(PAYMENT_IBANS).forEach((iban) => {
        assert.ok(iban.startsWith("HR"), `IBAN ${iban} should start with HR`)
        assert.strictEqual(iban.length, 21, `IBAN ${iban} should be 21 chars`)
      })
    })
  })
})
