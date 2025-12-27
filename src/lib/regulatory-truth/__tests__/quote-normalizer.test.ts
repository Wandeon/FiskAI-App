// src/lib/regulatory-truth/__tests__/quote-normalizer.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import {
  normalizeQuotes,
  hasUnicodeQuotes,
  findUnicodeQuotes,
  normalizeForComparison,
} from "../utils/quote-normalizer"

describe("quote-normalizer", () => {
  describe("normalizeQuotes", () => {
    describe("double quote variants", () => {
      it("converts left double quotation mark to straight quote", () => {
        const input = "\u201CHello\u201D"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, '"Hello"')
      })

      it("converts right double quotation mark to straight quote", () => {
        const input = "test\u201Dvalue"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, 'test"value')
      })

      it("converts double low-9 quotation mark (Croatian/German style)", () => {
        const input = "\u201EHello\u201C"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, '"Hello"')
      })

      it("converts double prime", () => {
        const input = "5\u2033 height"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, '5" height')
      })

      it("converts left-pointing double angle quotation mark (guillemet)", () => {
        const input = "\u00ABquote\u00BB"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, '"quote"')
      })

      it("converts fullwidth quotation mark", () => {
        const input = "\uFF02fullwidth\uFF02"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, '"fullwidth"')
      })
    })

    describe("single quote variants", () => {
      it("converts left single quotation mark to straight quote", () => {
        const input = "\u2018Hello\u2019"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "'Hello'")
      })

      it("converts right single quotation mark (apostrophe) to straight quote", () => {
        const input = "It\u2019s working"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "It's working")
      })

      it("converts single low-9 quotation mark", () => {
        const input = "\u201AHello\u2018"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "'Hello'")
      })

      it("converts prime to straight quote", () => {
        const input = "5\u2032 long"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "5' long")
      })

      it("converts single angle quotation marks", () => {
        const input = "\u2039quote\u203A"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "'quote'")
      })

      it("converts grave accent to straight quote", () => {
        const input = "\u0060code\u0060"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "'code'")
      })

      it("converts acute accent to straight quote", () => {
        const input = "word\u00B4s"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "word's")
      })
    })

    describe("apostrophe variants", () => {
      it("converts modifier letter apostrophe", () => {
        const input = "it\u02BCs"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "it's")
      })

      it("converts modifier letter turned comma", () => {
        const input = "test\u02BBvalue"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "test'value")
      })
    })

    describe("mixed content", () => {
      it("handles mixed smart quotes in same string", () => {
        const input = "\u201CHe said, \u2018Hello!\u2019\u201D"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "\"He said, 'Hello!'\"")
      })

      it("handles regulatory document text with smart quotes", () => {
        const input = "Prema \u010Dlanku 15. stavak 2. \u201EPauzalni porez iznosi 25%\u201D"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, 'Prema \u010Dlanku 15. stavak 2. "Pauzalni porez iznosi 25%"')
      })

      it("handles JSON content with escaped quotes", () => {
        const input = '{"key": \u201Cvalue\u201D}'
        const result = normalizeQuotes(input)
        assert.strictEqual(result, '{"key": "value"}')
      })

      it("preserves ASCII quotes unchanged", () => {
        const input = "\"Hello\" and 'World'"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "\"Hello\" and 'World'")
      })

      it("handles empty string", () => {
        assert.strictEqual(normalizeQuotes(""), "")
      })

      it("handles null-like values", () => {
        assert.strictEqual(normalizeQuotes(null as any), null)
        assert.strictEqual(normalizeQuotes(undefined as any), undefined)
      })
    })

    describe("real-world Croatian regulatory examples", () => {
      it("normalizes quoted law references", () => {
        const input = "Zakon o PDV-u (\u201ENarodne novine\u201C, br. 73/13)"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, 'Zakon o PDV-u ("Narodne novine", br. 73/13)')
      })

      it("normalizes quoted percentages", () => {
        const input = "Stopa iznosi \u201E25%\u201C prema zakonu"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, 'Stopa iznosi "25%" prema zakonu')
      })

      it("normalizes apostrophe in Croatian possessives", () => {
        const input = "poreznog obveznika\u2019s obveza"
        const result = normalizeQuotes(input)
        assert.strictEqual(result, "poreznog obveznika's obveza")
      })
    })
  })

  describe("hasUnicodeQuotes", () => {
    it("returns true for smart double quotes", () => {
      assert.strictEqual(hasUnicodeQuotes("\u201CHello\u201D"), true)
    })

    it("returns true for smart single quotes", () => {
      assert.strictEqual(hasUnicodeQuotes("It\u2019s"), true)
    })

    it("returns true for guillemets", () => {
      assert.strictEqual(hasUnicodeQuotes("\u00ABquote\u00BB"), true)
    })

    it("returns false for ASCII quotes only", () => {
      assert.strictEqual(hasUnicodeQuotes("\"Hello\" and 'World'"), false)
    })

    it("returns false for empty string", () => {
      assert.strictEqual(hasUnicodeQuotes(""), false)
    })

    it("returns false for text without any quotes", () => {
      assert.strictEqual(hasUnicodeQuotes("Hello World"), false)
    })
  })

  describe("findUnicodeQuotes", () => {
    it("finds left double quotation mark with position", () => {
      const result = findUnicodeQuotes("\u201CHello")
      assert.strictEqual(result.length, 1)
      assert.strictEqual(result[0].char, "\u201C")
      assert.strictEqual(result[0].codePoint, "U+201C")
      assert.strictEqual(result[0].position, 0)
      assert.strictEqual(result[0].name, "LEFT DOUBLE QUOTATION MARK")
    })

    it("finds multiple quote types", () => {
      const result = findUnicodeQuotes("\u201CHe said, \u2018Hi\u2019\u201D")
      assert.strictEqual(result.length, 4)

      const names = result.map((r) => r.name)
      assert.ok(names.includes("LEFT DOUBLE QUOTATION MARK"))
      assert.ok(names.includes("RIGHT DOUBLE QUOTATION MARK"))
      assert.ok(names.includes("LEFT SINGLE QUOTATION MARK"))
      assert.ok(names.includes("RIGHT SINGLE QUOTATION MARK"))
    })

    it("returns empty array for ASCII-only text", () => {
      const result = findUnicodeQuotes('"Hello" World')
      assert.strictEqual(result.length, 0)
    })

    it("returns empty array for empty string", () => {
      const result = findUnicodeQuotes("")
      assert.strictEqual(result.length, 0)
    })

    it("tracks correct positions for Unicode quotes", () => {
      const result = findUnicodeQuotes("abc\u201Ddef\u2019ghi")
      assert.strictEqual(result.length, 2)
      assert.strictEqual(result[0].position, 3)
      assert.strictEqual(result[1].position, 7)
    })
  })

  describe("normalizeForComparison", () => {
    it("normalizes both texts for comparison", () => {
      const result = normalizeForComparison("\u201CHello\u201D", '"Hello"')
      assert.strictEqual(result.a, '"Hello"')
      assert.strictEqual(result.b, '"Hello"')
      assert.strictEqual(result.hadUnicodeQuotes, true)
    })

    it("indicates when Unicode quotes were present", () => {
      const result = normalizeForComparison('"ASCII"', '"Also ASCII"')
      assert.strictEqual(result.hadUnicodeQuotes, false)
    })

    it("allows direct comparison after normalization", () => {
      const smartQuotes = "\u201CHello World\u201D"
      const straightQuotes = '"Hello World"'
      const result = normalizeForComparison(smartQuotes, straightQuotes)
      assert.strictEqual(result.a, result.b)
    })
  })

  describe("integration with Croatian text scenarios", () => {
    it("handles Croatian regulatory text with mixed quotes", () => {
      const sourceContent = 'Prema \u010Dlanku 15. "Pauzalni porez iznosi 25%"'
      const extractedQuote = "Prema \u010Dlanku 15. \u201EPauzalni porez iznosi 25%\u201C"

      const normalizedSource = normalizeQuotes(sourceContent)
      const normalizedQuote = normalizeQuotes(extractedQuote)

      // Both should now have straight quotes
      assert.ok(normalizedSource.includes('"Pauzalni porez iznosi 25%"'))
      assert.ok(normalizedQuote.includes('"Pauzalni porez iznosi 25%"'))
    })

    it("enables quote verification after normalization", () => {
      const evidenceContent = 'Zakon o PDV-u propisuje stopu od "25%" za standardne usluge.'
      const extractedQuote = "stopu od \u201C25%\u201D za standardne"

      const normalizedContent = normalizeQuotes(evidenceContent)
      const normalizedQuote = normalizeQuotes(extractedQuote)

      // After normalization, the quote should be findable in content
      assert.ok(normalizedContent.includes(normalizedQuote))
    })

    it("handles HNB API JSON with quotes", () => {
      const jsonResponse = '{"srednji_tecaj": "7.53450", "datum": "2025-01-15"}'
      const withSmartQuotes =
        "{\u201Csrednji_tecaj\u201D: \u201C7.53450\u201D, \u201Cdatum\u201D: \u201C2025-01-15\u201D}"

      const normalizedRegular = normalizeQuotes(jsonResponse)
      const normalizedSmart = normalizeQuotes(withSmartQuotes)

      assert.strictEqual(normalizedRegular, normalizedSmart)
    })
  })

  describe("edge cases", () => {
    it("handles consecutive quote characters", () => {
      const input = "\u201C\u201C\u201D\u201D"
      const result = normalizeQuotes(input)
      assert.strictEqual(result, '""""')
    })

    it("handles quotes at string boundaries", () => {
      const input = "\u201Cstart and end\u201D"
      const result = normalizeQuotes(input)
      assert.strictEqual(result, '"start and end"')
    })

    it("handles very long strings efficiently", () => {
      const longString = "\u201C" + "a".repeat(10000) + "\u201D"
      const result = normalizeQuotes(longString)
      assert.strictEqual(result.length, 10002) // 10000 + 2 quotes
      assert.strictEqual(result[0], '"')
      assert.strictEqual(result[result.length - 1], '"')
    })

    it("handles all quote types in single string", () => {
      const allQuotes =
        "\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A"
      const result = normalizeQuotes(allQuotes)

      // All should become either double or single straight quotes
      for (const char of result) {
        assert.ok(
          char === '"' || char === "'",
          `Expected " or ' but got ${char} (U+${char.charCodeAt(0).toString(16).toUpperCase()})`
        )
      }
    })
  })
})
