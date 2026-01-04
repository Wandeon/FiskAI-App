// src/lib/regulatory-truth/__tests__/explanation-validator.test.ts

import { describe, it } from "node:test"
import assert from "node:assert"
import {
  validateExplanation,
  extractModalVerbs,
  extractNumericValues,
  createQuoteOnlyExplanation,
  getEvidenceStrengthBadge,
} from "../utils/explanation-validator"

describe("Explanation Validator", () => {
  describe("extractModalVerbs", () => {
    it("extracts Croatian modal verbs", () => {
      const text = "Poduzetnik mora prijaviti porez. Uvijek se primjenjuje."
      const verbs = extractModalVerbs(text, "hr")

      assert.ok(verbs.includes("mora"))
      assert.ok(verbs.includes("uvijek"))
    })

    it("extracts English modal verbs", () => {
      const text = "You must always file taxes. Never skip this step."
      const verbs = extractModalVerbs(text, "en")

      assert.ok(verbs.includes("must"))
      assert.ok(verbs.includes("always"))
      assert.ok(verbs.includes("never"))
    })

    it("returns empty array when no modal verbs", () => {
      const text = "Porez se prijavljuje godišnje."
      const verbs = extractModalVerbs(text, "hr")

      assert.deepStrictEqual(verbs, [])
    })
  })

  describe("extractNumericValues", () => {
    it("extracts decimal numbers", () => {
      const text = "Prag iznosi 39.816,84 EUR ili 39816.84 u decimalnom formatu."
      const values = extractNumericValues(text)

      assert.ok(values.includes("39.816"))
      assert.ok(values.includes("39816.84"))
    })

    it("extracts percentages", () => {
      const text = "Stopa iznosi 25% ili 12.5% za umanjenje."
      const values = extractNumericValues(text)

      assert.ok(values.includes("25"))
      assert.ok(values.includes("12.5"))
    })

    it("extracts dates", () => {
      const text = "Rok je 2025-01-31 ili 31.01.2025."
      const values = extractNumericValues(text)

      assert.ok(values.includes("2025-01-31"))
      assert.ok(values.includes("31.01.2025"))
    })

    it("extracts currency values", () => {
      const text = "Iznos je €100 ili 500€ ili HRK 750."
      const values = extractNumericValues(text)

      assert.ok(values.includes("100"))
      assert.ok(values.includes("500"))
      assert.ok(values.includes("750"))
    })
  })

  describe("validateExplanation", () => {
    const sourceQuotes = [
      "Poduzetnik mora prijaviti porez do 31. siječnja.",
      "Godišnji prag za paušalno oporezivanje iznosi 39.816,84 EUR.",
    ]

    it("passes when modal verbs appear in sources", () => {
      const explanation = "Poduzetnik mora prijaviti godišnji porez."
      const result = validateExplanation(explanation, null, sourceQuotes)

      assert.strictEqual(result.valid, true)
      assert.strictEqual(result.modalVerbViolations.length, 0)
    })

    it("fails when modal verbs NOT in sources", () => {
      const explanation = "Poduzetnik nikada ne smije propustiti prijavu."
      const result = validateExplanation(explanation, null, sourceQuotes)

      assert.strictEqual(result.valid, false)
      assert.ok(result.modalVerbViolations.includes("nikada"))
    })

    it("warns when numeric values NOT in sources", () => {
      const explanation = "Prag iznosi 50.000 EUR."
      const result = validateExplanation(explanation, null, sourceQuotes)

      // Values are warnings, not errors
      assert.ok(result.warnings.length > 0)
      assert.ok(result.valueViolations.includes("50.000"))
    })

    it("passes when extracted value is in explanation", () => {
      const explanation = "Prag iznosi 39.816,84 EUR godišnje."
      const result = validateExplanation(explanation, null, sourceQuotes, "39816.84")

      assert.strictEqual(result.valid, true)
    })

    it("determines evidence strength correctly", () => {
      const singleSource = ["Only one source."]
      const multiSource = ["First source.", "Second source."]

      const singleResult = validateExplanation("Test", null, singleSource)
      const multiResult = validateExplanation("Test", null, multiSource)

      assert.strictEqual(singleResult.evidenceStrength, "SINGLE_SOURCE")
      assert.strictEqual(multiResult.evidenceStrength, "MULTI_SOURCE")
    })
  })

  describe("createQuoteOnlyExplanation", () => {
    it("creates explanation from quote", () => {
      const quotes = ["Porez se prijavljuje godišnje do 31. siječnja."]
      const result = createQuoteOnlyExplanation(quotes)

      assert.ok(result.includes("Iz izvora:"))
      assert.ok(result.includes("Porez se prijavljuje"))
    })

    it("includes value when provided", () => {
      const quotes = ["Prag je 39.816,84 EUR."]
      const result = createQuoteOnlyExplanation(quotes, "39816.84")

      assert.ok(result.includes("Vrijednost: 39816.84"))
    })

    it("handles empty quotes", () => {
      const result = createQuoteOnlyExplanation([], "12345")

      assert.ok(result.includes("Vrijednost: 12345"))
    })

    it("handles no quotes and no value", () => {
      const result = createQuoteOnlyExplanation([])

      assert.ok(result.includes("Nema dostupnog objašnjenja"))
    })
  })

  describe("getEvidenceStrengthBadge", () => {
    it("returns correct HR badge for multi-source", () => {
      const badge = getEvidenceStrengthBadge("MULTI_SOURCE", "hr")

      assert.strictEqual(badge.text, "Višestruki izvori")
      assert.strictEqual(badge.level, "high")
    })

    it("returns correct HR badge for single-source", () => {
      const badge = getEvidenceStrengthBadge("SINGLE_SOURCE", "hr")

      assert.strictEqual(badge.text, "Jedan izvor")
      assert.strictEqual(badge.level, "medium")
    })

    it("returns correct EN badge for multi-source", () => {
      const badge = getEvidenceStrengthBadge("MULTI_SOURCE", "en")

      assert.strictEqual(badge.text, "Multiple sources")
      assert.strictEqual(badge.level, "high")
    })
  })
})
