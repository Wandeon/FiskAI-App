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
  validateAtomicClaim,
  type AtomicClaimInput,
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

  describe("validateValueInQuote - edge cases (INV-3 audit)", () => {
    it("handles space as thousand separator", () => {
      const result = validateValueInQuote("40000", "prag iznosi 40 000 EUR")
      assert.strictEqual(result.valid, true)
    })

    it("handles trailing period on date", () => {
      const result = validateValueInQuote("2025-01-15", "do 15.01.2025.")
      assert.strictEqual(result.valid, true)
    })

    it("handles short date format D.M.YYYY", () => {
      const result = validateValueInQuote("2025-01-05", "do 5.1.2025")
      assert.strictEqual(result.valid, true)
    })

    it("handles JSON exchange rate format", () => {
      const result = validateValueInQuote("7.53450", '"srednji_tecaj": "7.53450"')
      assert.strictEqual(result.valid, true)
    })

    it("handles IBAN as text match", () => {
      const result = validateValueInQuote("HR1210010051863000160", "IBAN: HR1210010051863000160")
      assert.strictEqual(result.valid, true)
    })

    it("rejects partial year match", () => {
      const result = validateValueInQuote("25", "Za 2025. godinu")
      assert.strictEqual(result.valid, false)
    })

    it("handles decimal with comma locale", () => {
      const result = validateValueInQuote("7.5345", "tecaj iznosi 7,5345")
      assert.strictEqual(result.valid, true)
    })

    // OCR diacritic corruption - now fixed with normalized patterns
    it("handles OCR diacritic corruption (HIGH-02 fixed)", () => {
      const result = validateValueInQuote("2025-01-15", "do 15. sijecnja 2025.")
      // Now passes - diacritics are normalized
      assert.strictEqual(result.valid, true)
    })
  })

  // =============================================================================
  // ATOMIC CLAIM VALIDATION TESTS
  // =============================================================================

  describe("validateAtomicClaim", () => {
    // Helper to create a valid claim for testing
    const createValidClaim = (overrides?: Partial<AtomicClaimInput>): AtomicClaimInput => ({
      subjectType: "TAXPAYER",
      assertionType: "OBLIGATION",
      logicExpr: "must_pay_vat = true",
      exactQuote: "Porezni obveznik mora platiti PDV u iznosu od 25%.",
      confidence: 0.9,
      ...overrides,
    })

    describe("required field validation", () => {
      it("accepts valid claim with all required fields", () => {
        const claim = createValidClaim()
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, true)
        assert.deepStrictEqual(result.errors, [])
      })

      it("rejects claim with empty subjectType", () => {
        const claim = createValidClaim({ subjectType: "" as any })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("subjectType")))
        // Empty string triggers "Missing required" first
        assert.strictEqual(result.rejectionType, "MISSING_REQUIRED_FIELD")
      })

      it("rejects claim with undefined subjectType", () => {
        const claim = createValidClaim()
        ;(claim as any).subjectType = undefined
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("subjectType")))
      })

      it("rejects claim missing assertionType", () => {
        const claim = createValidClaim({ assertionType: "" as any })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("assertionType")))
      })

      it("rejects claim missing logicExpr", () => {
        const claim = createValidClaim({ logicExpr: "" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("logicExpr")))
      })

      it("rejects claim with too short logicExpr", () => {
        const claim = createValidClaim({ logicExpr: "ab" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("at least 3 characters")))
      })

      it("rejects claim missing exactQuote", () => {
        const claim = createValidClaim({ exactQuote: "" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("exactQuote")))
      })

      it("rejects claim with too short exactQuote", () => {
        const claim = createValidClaim({ exactQuote: "Short" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("at least 10 characters")))
      })
    })

    describe("subjectType validation", () => {
      it("accepts all valid subject types", () => {
        const validTypes = ["TAXPAYER", "EMPLOYER", "COMPANY", "INDIVIDUAL", "ALL"]
        for (const subjectType of validTypes) {
          const claim = createValidClaim({ subjectType })
          const result = validateAtomicClaim(claim)
          assert.strictEqual(result.valid, true, `Should accept ${subjectType}`)
        }
      })

      it("rejects invalid subject type", () => {
        const claim = createValidClaim({ subjectType: "INVALID_TYPE" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("Invalid subjectType")))
        assert.strictEqual(result.rejectionType, "INVALID_SUBJECT_TYPE")
      })
    })

    describe("assertionType validation", () => {
      it("accepts all valid assertion types", () => {
        const validTypes = ["OBLIGATION", "PROHIBITION", "PERMISSION", "DEFINITION"]
        for (const assertionType of validTypes) {
          const claim = createValidClaim({ assertionType })
          const result = validateAtomicClaim(claim)
          assert.strictEqual(result.valid, true, `Should accept ${assertionType}`)
        }
      })

      it("rejects invalid assertion type", () => {
        const claim = createValidClaim({ assertionType: "SUGGESTION" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("Invalid assertionType")))
        assert.strictEqual(result.rejectionType, "INVALID_ASSERTION_TYPE")
      })
    })

    describe("valueType validation", () => {
      it("accepts all valid value types", () => {
        const validTypes = [
          "percentage",
          "currency",
          "currency_eur",
          "currency_hrk",
          "date",
          "count",
          "threshold",
          "text",
          "boolean",
          "rate",
          "duration",
          "formula",
        ]
        for (const valueType of validTypes) {
          const claim = createValidClaim({ valueType, value: "test" })
          const result = validateAtomicClaim(claim)
          // Only check that valueType itself is valid, value validation may fail
          const valueTypeErrors = result.errors.filter((e) => e.includes("Invalid valueType"))
          assert.strictEqual(valueTypeErrors.length, 0, `Should accept valueType ${valueType}`)
        }
      })

      it("rejects invalid value type", () => {
        const claim = createValidClaim({ valueType: "unknown_type", value: "100" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("Invalid valueType")))
        assert.strictEqual(result.rejectionType, "INVALID_VALUE_TYPE")
      })

      it("warns when value provided without valueType", () => {
        const claim = createValidClaim({ value: "100", valueType: undefined })
        const result = validateAtomicClaim(claim)
        assert.ok(result.warnings.some((w) => w.includes("without valueType")))
      })
    })

    describe("value validation by type", () => {
      it("validates percentage values", () => {
        const validClaim = createValidClaim({ valueType: "percentage", value: "25" })
        assert.strictEqual(validateAtomicClaim(validClaim).valid, true)

        const invalidClaim = createValidClaim({ valueType: "percentage", value: "150" })
        const result = validateAtomicClaim(invalidClaim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("exceed")))
      })

      it("validates currency values", () => {
        const validClaim = createValidClaim({ valueType: "currency_eur", value: "40000" })
        assert.strictEqual(validateAtomicClaim(validClaim).valid, true)

        const invalidClaim = createValidClaim({ valueType: "currency_eur", value: "-100" })
        const result = validateAtomicClaim(invalidClaim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("negative")))
      })

      it("validates date values", () => {
        const validClaim = createValidClaim({ valueType: "date", value: "2025-01-15" })
        assert.strictEqual(validateAtomicClaim(validClaim).valid, true)

        const invalidClaim = createValidClaim({ valueType: "date", value: "15/01/2025" })
        const result = validateAtomicClaim(invalidClaim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("ISO format")))
      })

      it("validates boolean values", () => {
        const validValues = ["true", "false", "1", "0", "yes", "no", "da", "ne"]
        for (const value of validValues) {
          const claim = createValidClaim({ valueType: "boolean", value })
          assert.strictEqual(
            validateAtomicClaim(claim).valid,
            true,
            `Should accept boolean value: ${value}`
          )
        }

        const invalidClaim = createValidClaim({ valueType: "boolean", value: "maybe" })
        const result = validateAtomicClaim(invalidClaim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("boolean")))
      })

      it("validates count values", () => {
        const validClaim = createValidClaim({ valueType: "count", value: "100" })
        assert.strictEqual(validateAtomicClaim(validClaim).valid, true)

        const invalidClaim = createValidClaim({ valueType: "count", value: "-5" })
        const result = validateAtomicClaim(invalidClaim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("negative")))
      })
    })

    describe("confidence validation", () => {
      it("accepts valid confidence 0-1", () => {
        const claims = [
          createValidClaim({ confidence: 0 }),
          createValidClaim({ confidence: 0.5 }),
          createValidClaim({ confidence: 1 }),
        ]
        for (const claim of claims) {
          assert.strictEqual(
            validateAtomicClaim(claim).valid,
            true,
            `Should accept confidence ${claim.confidence}`
          )
        }
      })

      it("rejects confidence outside 0-1 range", () => {
        const invalidClaims = [
          createValidClaim({ confidence: -0.1 }),
          createValidClaim({ confidence: 1.1 }),
          createValidClaim({ confidence: 100 }),
        ]
        for (const claim of invalidClaims) {
          const result = validateAtomicClaim(claim)
          assert.strictEqual(result.valid, false, `Should reject confidence ${claim.confidence}`)
          assert.ok(result.errors.some((e) => e.includes("between 0 and 1")))
        }
      })

      it("warns on low confidence", () => {
        const claim = createValidClaim({ confidence: 0.3 })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, true)
        assert.ok(result.warnings.some((w) => w.includes("Very low confidence")))
      })

      it("rejects non-numeric confidence", () => {
        const claim = createValidClaim({ confidence: NaN })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("must be a number")))
        assert.strictEqual(result.rejectionType, "INVALID_CONFIDENCE")
      })
    })

    describe("jurisdiction validation", () => {
      it("accepts known jurisdictions without warnings", () => {
        const validJurisdictions = ["HR", "EU", "GLOBAL"]
        for (const jurisdiction of validJurisdictions) {
          const claim = createValidClaim({ jurisdiction })
          const result = validateAtomicClaim(claim)
          assert.strictEqual(result.valid, true)
          assert.strictEqual(
            result.warnings.filter((w) => w.includes("jurisdiction")).length,
            0,
            `Should not warn for jurisdiction ${jurisdiction}`
          )
        }
      })

      it("warns on unknown jurisdiction", () => {
        const claim = createValidClaim({ jurisdiction: "US" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, true) // Still valid, just a warning
        assert.ok(result.warnings.some((w) => w.includes("Unknown jurisdiction")))
      })
    })

    describe("evidence anchoring validation", () => {
      it("validates quote exists in evidence content", () => {
        const claim = createValidClaim({
          exactQuote: "PDV stopa iznosi 25%",
        })
        const evidenceContent = "Prema zakonu, PDV stopa iznosi 25% za standardne proizvode."
        const result = validateAtomicClaim(claim, evidenceContent)
        assert.strictEqual(result.valid, true)
      })

      it("rejects quote not found in evidence", () => {
        const claim = createValidClaim({
          exactQuote: "Completely unrelated quote that does not exist",
        })
        const evidenceContent = "This is the actual evidence content about tax rates."
        const result = validateAtomicClaim(claim, evidenceContent)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("not found in evidence")))
        assert.strictEqual(result.rejectionType, "INVALID_QUOTE")
      })

      it("uses fuzzy matching for diacritic differences", () => {
        const claim = createValidClaim({
          exactQuote: "Porezna stopa za drustva",
        })
        const evidenceContent = "Porezna stopa za društva iznosi 18%."
        const result = validateAtomicClaim(claim, evidenceContent)
        assert.strictEqual(result.valid, true)
      })
    })

    describe("exception validation", () => {
      it("accepts valid exceptions", () => {
        const claim = createValidClaim({
          exceptions: [
            {
              condition: "IF alcohol_content > 0",
              overridesTo: "vat-reduced-rate",
              sourceArticle: "Art 38(4)",
            },
          ],
        })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, true)
      })

      it("rejects exception with missing condition", () => {
        const claim = createValidClaim({
          exceptions: [
            {
              condition: "",
              overridesTo: "vat-reduced-rate",
              sourceArticle: "Art 38(4)",
            },
          ],
        })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("Exception 1") && e.includes("condition")))
      })

      it("rejects exception with missing overridesTo", () => {
        const claim = createValidClaim({
          exceptions: [
            {
              condition: "IF alcohol_content > 0",
              overridesTo: "",
              sourceArticle: "Art 38(4)",
            },
          ],
        })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("Exception 1") && e.includes("overridesTo")))
      })

      it("rejects exception with missing sourceArticle", () => {
        const claim = createValidClaim({
          exceptions: [
            {
              condition: "IF alcohol_content > 0",
              overridesTo: "vat-reduced-rate",
              sourceArticle: "",
            },
          ],
        })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(
          result.errors.some((e) => e.includes("Exception 1") && e.includes("sourceArticle"))
        )
      })

      it("validates multiple exceptions", () => {
        const claim = createValidClaim({
          exceptions: [
            {
              condition: "IF alcohol_content > 0",
              overridesTo: "vat-reduced-rate",
              sourceArticle: "Art 38(4)",
            },
            {
              condition: "", // Invalid
              overridesTo: "vat-zero-rate",
              sourceArticle: "Art 38(5)",
            },
          ],
        })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.valid, false)
        assert.ok(result.errors.some((e) => e.includes("Exception 2")))
      })
    })

    describe("rejection type classification", () => {
      it("classifies INVALID_SUBJECT_TYPE correctly", () => {
        const claim = createValidClaim({ subjectType: "INVALID" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.rejectionType, "INVALID_SUBJECT_TYPE")
      })

      it("classifies INVALID_ASSERTION_TYPE correctly", () => {
        const claim = createValidClaim({ subjectType: "TAXPAYER", assertionType: "INVALID" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.rejectionType, "INVALID_ASSERTION_TYPE")
      })

      it("classifies INVALID_VALUE_TYPE correctly", () => {
        const claim = createValidClaim({ valueType: "invalid", value: "100" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.rejectionType, "INVALID_VALUE_TYPE")
      })

      it("classifies MISSING_REQUIRED_FIELD correctly", () => {
        const claim = createValidClaim({ logicExpr: "" })
        const result = validateAtomicClaim(claim)
        assert.strictEqual(result.rejectionType, "MISSING_REQUIRED_FIELD")
      })
    })
  })
})
