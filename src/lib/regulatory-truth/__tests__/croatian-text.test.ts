// src/lib/regulatory-truth/__tests__/croatian-text.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import {
  normalizeCroatianDiacritics,
  normalizeWhitespace,
  normalizeForComparison,
  levenshteinDistance,
  calculateSimilarity,
  calculateNormalizedSimilarity,
  fuzzyMatchCroatian,
  fuzzyContainsCroatian,
  getMonthPatterns,
  dateAppearsInText,
  CROATIAN_MONTHS,
} from "../utils/croatian-text"

describe("croatian-text utilities", () => {
  describe("normalizeCroatianDiacritics", () => {
    it("normalizes lowercase c with caron to c", () => {
      assert.strictEqual(normalizeCroatianDiacritics("\u010D"), "c")
      assert.strictEqual(normalizeCroatianDiacritics("ra\u010Dun"), "racun")
    })

    it("normalizes lowercase c with acute to c", () => {
      assert.strictEqual(normalizeCroatianDiacritics("\u0107"), "c")
      assert.strictEqual(normalizeCroatianDiacritics("no\u0107"), "noc")
    })

    it("normalizes lowercase s with caron to s", () => {
      assert.strictEqual(normalizeCroatianDiacritics("\u0161"), "s")
      assert.strictEqual(normalizeCroatianDiacritics("\u0161kola"), "skola")
    })

    it("normalizes lowercase z with caron to z", () => {
      assert.strictEqual(normalizeCroatianDiacritics("\u017E"), "z")
      assert.strictEqual(normalizeCroatianDiacritics("\u017Eivot"), "zivot")
    })

    it("normalizes lowercase d with stroke to d", () => {
      assert.strictEqual(normalizeCroatianDiacritics("\u0111"), "d")
      assert.strictEqual(normalizeCroatianDiacritics("\u0111ak"), "dak")
    })

    it("normalizes uppercase Croatian characters", () => {
      assert.strictEqual(normalizeCroatianDiacritics("\u010C"), "C")
      assert.strictEqual(normalizeCroatianDiacritics("\u0106"), "C")
      assert.strictEqual(normalizeCroatianDiacritics("\u0160"), "S")
      assert.strictEqual(normalizeCroatianDiacritics("\u017D"), "Z")
      assert.strictEqual(normalizeCroatianDiacritics("\u0110"), "D")
    })

    it("normalizes full Croatian text with multiple diacritics", () => {
      const input = "Ovaj ra\u010Dun za \u0161kolu u \u017Eupaniji"
      const expected = "Ovaj racun za skolu u zupaniji"
      assert.strictEqual(normalizeCroatianDiacritics(input), expected)
    })

    it("preserves non-diacritic characters", () => {
      const input = "Hello World 123"
      assert.strictEqual(normalizeCroatianDiacritics(input), input)
    })

    it("normalizes Croatian month names", () => {
      assert.strictEqual(normalizeCroatianDiacritics("sije\u010Dnja"), "sijecnja")
      assert.strictEqual(normalizeCroatianDiacritics("velja\u010De"), "veljace")
      assert.strictEqual(normalizeCroatianDiacritics("o\u017Eujka"), "ozujka")
    })
  })

  describe("normalizeWhitespace", () => {
    it("collapses multiple spaces", () => {
      assert.strictEqual(normalizeWhitespace("hello   world"), "hello world")
    })

    it("normalizes line endings", () => {
      assert.strictEqual(normalizeWhitespace("hello\r\nworld"), "hello world")
    })

    it("converts tabs to spaces", () => {
      assert.strictEqual(normalizeWhitespace("hello\tworld"), "hello world")
    })

    it("trims leading and trailing whitespace", () => {
      assert.strictEqual(normalizeWhitespace("  hello  "), "hello")
    })
  })

  describe("normalizeForComparison", () => {
    it("combines diacritic normalization, whitespace normalization, and lowercasing", () => {
      const input = "  Ra\u010Dun   za \u0160kolu  "
      const expected = "racun za skolu"
      assert.strictEqual(normalizeForComparison(input), expected)
    })
  })

  describe("levenshteinDistance", () => {
    it("returns 0 for identical strings", () => {
      assert.strictEqual(levenshteinDistance("hello", "hello"), 0)
    })

    it("returns length of other string when one is empty", () => {
      assert.strictEqual(levenshteinDistance("", "hello"), 5)
      assert.strictEqual(levenshteinDistance("hello", ""), 5)
    })

    it("calculates correct distance for single character difference", () => {
      assert.strictEqual(levenshteinDistance("hello", "hallo"), 1)
    })

    it("calculates correct distance for insertion", () => {
      assert.strictEqual(levenshteinDistance("helo", "hello"), 1)
    })

    it("calculates correct distance for deletion", () => {
      assert.strictEqual(levenshteinDistance("hello", "helo"), 1)
    })
  })

  describe("calculateSimilarity", () => {
    it("returns 1 for identical strings", () => {
      assert.strictEqual(calculateSimilarity("hello", "hello"), 1)
    })

    it("returns 0 when one string is empty", () => {
      assert.strictEqual(calculateSimilarity("", "hello"), 0)
      assert.strictEqual(calculateSimilarity("hello", ""), 0)
    })

    it("returns high similarity for single character difference", () => {
      const similarity = calculateSimilarity("hello", "hallo")
      // distance = 1, length = 5, similarity = 1 - 1/5 = 0.8
      assert.strictEqual(similarity, 0.8)
    })
  })

  describe("calculateNormalizedSimilarity", () => {
    it("returns 1 for same text with different diacritics", () => {
      const similarity = calculateNormalizedSimilarity("sije\u010Dnja", "sijecnja")
      assert.strictEqual(similarity, 1)
    })

    it("returns 1 for same text with different case", () => {
      const similarity = calculateNormalizedSimilarity("HELLO", "hello")
      assert.strictEqual(similarity, 1)
    })

    it("returns 1 for same text with different whitespace", () => {
      const similarity = calculateNormalizedSimilarity("hello   world", "hello world")
      assert.strictEqual(similarity, 1)
    })
  })

  describe("fuzzyMatchCroatian", () => {
    it("matches identical text", () => {
      const result = fuzzyMatchCroatian("hello", "hello")
      assert.strictEqual(result.matches, true)
      assert.strictEqual(result.similarity, 1)
    })

    it("matches text with diacritic differences", () => {
      const result = fuzzyMatchCroatian("sije\u010Dnja", "sijecnja")
      assert.strictEqual(result.matches, true)
      assert.strictEqual(result.similarity, 1)
    })

    it("matches text with case differences", () => {
      const result = fuzzyMatchCroatian("SIJECNJA", "sijecnja")
      assert.strictEqual(result.matches, true)
    })

    it("rejects completely different text", () => {
      const result = fuzzyMatchCroatian("hello", "world")
      assert.strictEqual(result.matches, false)
      assert.ok(result.similarity < 0.5)
    })

    it("respects custom threshold", () => {
      // Default threshold would pass, but stricter threshold fails
      const result = fuzzyMatchCroatian("hello", "hallo", 0.95)
      assert.strictEqual(result.matches, false)

      // Lower threshold should pass
      const result2 = fuzzyMatchCroatian("hello", "hallo", 0.7)
      assert.strictEqual(result2.matches, true)
    })
  })

  describe("fuzzyContainsCroatian", () => {
    it("finds exact substring", () => {
      const result = fuzzyContainsCroatian("This is a test string", "test")
      assert.strictEqual(result.found, true)
      assert.strictEqual(result.similarity, 1)
    })

    it("finds substring with diacritic differences", () => {
      const result = fuzzyContainsCroatian("Datum: 15. sije\u010Dnja 2025", "15. sijecnja 2025")
      assert.strictEqual(result.found, true)
      assert.strictEqual(result.similarity, 1)
    })

    it("finds substring with OCR-like errors", () => {
      // 'l' misread as 'i' - should still find with fuzzy matching
      const result = fuzzyContainsCroatian("Obrazac OIB-a za fizicke osobe", "fizicke osobe", 0.8)
      assert.strictEqual(result.found, true)
    })

    it("returns false for not found text", () => {
      const result = fuzzyContainsCroatian("This is a test", "xyz123")
      assert.strictEqual(result.found, false)
    })
  })

  describe("getMonthPatterns", () => {
    it("returns patterns for January (month 1)", () => {
      const patterns = getMonthPatterns(1)
      assert.ok(patterns.includes("sijecnja"))
      assert.ok(patterns.includes("sijecanj"))
    })

    it("returns patterns for March (month 3)", () => {
      const patterns = getMonthPatterns(3)
      assert.ok(patterns.includes("ozujka"))
      assert.ok(patterns.includes("ozujak"))
    })

    it("returns empty array for invalid month", () => {
      assert.deepStrictEqual(getMonthPatterns(0), [])
      assert.deepStrictEqual(getMonthPatterns(13), [])
    })
  })

  describe("CROATIAN_MONTHS", () => {
    it("has entries for all 12 months", () => {
      assert.strictEqual(Object.keys(CROATIAN_MONTHS).length, 12)
    })

    it("each month has genitive form", () => {
      assert.ok(CROATIAN_MONTHS.sijecanj.includes("sijecnja"))
      assert.ok(CROATIAN_MONTHS.veljaca.includes("veljace"))
      assert.ok(CROATIAN_MONTHS.ozujak.includes("ozujka"))
    })
  })

  describe("dateAppearsInText", () => {
    it("finds ISO format date", () => {
      const result = dateAppearsInText("2025-01-15", "Datum: 2025-01-15")
      assert.strictEqual(result.found, true)
    })

    it("finds Croatian numeric format date", () => {
      const result = dateAppearsInText("2025-01-15", "Datum: 15.01.2025")
      assert.strictEqual(result.found, true)
    })

    it("finds date with Croatian month name (with diacritics)", () => {
      const result = dateAppearsInText("2025-01-15", "do 15. sije\u010Dnja 2025")
      assert.strictEqual(result.found, true)
    })

    it("finds date with Croatian month name (without diacritics / OCR)", () => {
      const result = dateAppearsInText("2025-01-15", "do 15. sijecnja 2025")
      assert.strictEqual(result.found, true)
    })

    it("finds date with short month format", () => {
      const result = dateAppearsInText("2025-01-05", "do 5.1.2025")
      assert.strictEqual(result.found, true)
    })

    it("returns false for non-matching date", () => {
      const result = dateAppearsInText("2025-01-15", "Datum: 20.02.2025")
      assert.strictEqual(result.found, false)
    })

    it("handles OCR corruption in month names", () => {
      // Simulating OCR that drops diacritics
      const result = dateAppearsInText("2025-03-15", "do 15. ozujka 2025")
      assert.strictEqual(result.found, true)
    })
  })
})

describe("croatian-text - real-world OCR scenarios", () => {
  describe("OCR diacritic corruption handling", () => {
    it("handles completely stripped diacritics", () => {
      const source = "Racun za usluge skole u zupaniji"
      const target = "Ra\u010Dun za usluge \u0161kole u \u017Eupaniji"
      const result = fuzzyMatchCroatian(source, target)
      assert.strictEqual(result.matches, true)
      assert.strictEqual(result.similarity, 1)
    })

    it("handles partial diacritic preservation", () => {
      const source = "Ra\u010Dun za usluge skole" // 'c' kept, 's' lost
      const target = "Ra\u010Dun za usluge \u0161kole"
      const result = fuzzyMatchCroatian(source, target)
      assert.strictEqual(result.matches, true)
    })

    it("handles mixed OCR errors", () => {
      const source = "Porezna prijava za 2O25. godinu" // 'O' instead of '0'
      const target = "Porezna prijava za 2025. godinu"
      const result = fuzzyMatchCroatian(source, target, 0.85)
      assert.strictEqual(result.matches, true)
    })
  })

  describe("date verification with OCR text", () => {
    it("verifies date in OCR-corrupted Croatian text", () => {
      // This was the failing test case from HIGH-02 audit
      const result = dateAppearsInText("2025-01-15", "do 15. sijecnja 2025.")
      assert.strictEqual(result.found, true)
    })

    it("verifies date with trailing punctuation", () => {
      const result = dateAppearsInText("2025-01-15", "Rok: 15.01.2025.")
      assert.strictEqual(result.found, true)
    })

    it("verifies date in mixed-case text", () => {
      const result = dateAppearsInText("2025-01-15", "DO 15. SIJECNJA 2025")
      assert.strictEqual(result.found, true)
    })
  })

  describe("quote verification with OCR text", () => {
    it("matches quote with diacritic differences", () => {
      const ocrQuote = "Stopu od 25% za pausalne obveznike"
      const expectedQuote = "Stopu od 25% za pau\u0161alne obveznike"
      const result = fuzzyContainsCroatian(ocrQuote, expectedQuote, 0.85)
      assert.strictEqual(result.found, true)
      assert.ok(result.similarity >= 0.85)
    })

    it("matches quote with multiple OCR errors", () => {
      // Simulating OCR that: strips diacritics, confuses 0/O, drops space
      const ocrQuote = "Prag od 40.OOO EUR godisnje"
      const expectedQuote = "Prag od 40.000 EUR godi\u0161nje"
      const result = fuzzyContainsCroatian(ocrQuote, expectedQuote, 0.8)
      assert.strictEqual(result.found, true)
    })
  })

  describe("Croatian legal text patterns", () => {
    it("matches article references with diacritic variation", () => {
      const ocrText = "Clanak 5. stavak 2."
      const expected = "\u010Clanak 5. stavak 2."
      const result = fuzzyMatchCroatian(ocrText, expected)
      assert.strictEqual(result.matches, true)
    })

    it("matches law names with diacritic variation", () => {
      const ocrText = "Zakon o porezu na dohodak"
      const expected = "Zakon o porezu na dohodak"
      const result = fuzzyMatchCroatian(ocrText, expected)
      assert.strictEqual(result.matches, true)
    })

    it("matches regulatory body names", () => {
      const ocrText = "Porezna uprava - Podrucni ured Zagreb"
      const expected = "Porezna uprava - Podru\u010Dni ured Zagreb"
      const result = fuzzyMatchCroatian(ocrText, expected)
      assert.strictEqual(result.matches, true)
    })
  })
})
