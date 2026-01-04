// src/lib/regulatory-truth/__tests__/quote-in-evidence.test.ts
// Tests for provenance validation: quote-in-evidence matching

import { describe, it } from "node:test"
import assert from "node:assert"
import {
  normalizeForMatch,
  findQuoteInEvidence,
  validateQuoteInEvidence,
  isMatchTypeAcceptableForTier,
} from "../utils/quote-in-evidence"

describe("normalizeForMatch", () => {
  describe("basic normalization", () => {
    it("returns empty string for empty input", () => {
      assert.strictEqual(normalizeForMatch(""), "")
      assert.strictEqual(normalizeForMatch(null as unknown as string), "")
    })

    it("trims whitespace", () => {
      assert.strictEqual(normalizeForMatch("  hello  "), "hello")
    })

    it("collapses multiple spaces to single space", () => {
      assert.strictEqual(normalizeForMatch("hello   world"), "hello world")
    })

    it("collapses newlines and tabs to space", () => {
      assert.strictEqual(normalizeForMatch("hello\n\nworld"), "hello world")
      assert.strictEqual(normalizeForMatch("hello\t\tworld"), "hello world")
    })
  })

  describe("unicode normalization", () => {
    it("normalizes NBSP to regular space", () => {
      assert.strictEqual(normalizeForMatch("hello\u00A0world"), "hello world")
    })

    it("removes soft hyphens", () => {
      assert.strictEqual(normalizeForMatch("hel\u00ADlo"), "hello")
    })

    it("normalizes curly quotes to straight quotes", () => {
      assert.strictEqual(normalizeForMatch("\u201Chello\u201D"), '"hello"')
      assert.strictEqual(normalizeForMatch("\u201Ehello\u201C"), '"hello"')
    })

    it("normalizes curly apostrophes to straight apostrophe", () => {
      assert.strictEqual(normalizeForMatch("don\u2019t"), "don't")
      assert.strictEqual(normalizeForMatch("don\u2018t"), "don't")
    })

    it("normalizes guillemets to straight quotes", () => {
      assert.strictEqual(normalizeForMatch("\u00ABhello\u00BB"), '"hello"')
    })
  })

  describe("NFKC normalization", () => {
    it("normalizes ligatures", () => {
      // ﬁ -> fi
      assert.strictEqual(normalizeForMatch("\uFB01rst"), "first")
    })

    it("normalizes full-width characters", () => {
      // ＡＢＣ -> ABC
      assert.strictEqual(normalizeForMatch("\uFF21\uFF22\uFF23"), "ABC")
    })
  })

  describe("determinism", () => {
    it("produces identical output for same input", () => {
      const input = "Članak 123. stavak 1. točka a)"
      const result1 = normalizeForMatch(input)
      const result2 = normalizeForMatch(input)
      assert.strictEqual(result1, result2)
    })

    it("handles Croatian characters correctly", () => {
      const input = "Šćžčć ŠĆŽČĆ"
      const result = normalizeForMatch(input)
      assert.strictEqual(result, "Šćžčć ŠĆŽČĆ")
    })
  })
})

describe("findQuoteInEvidence", () => {
  describe("exact match", () => {
    it("finds exact match at start", () => {
      const result = findQuoteInEvidence("The quick brown fox", "The quick")
      assert.strictEqual(result.found, true)
      assert.strictEqual(result.matchType, "exact")
      assert.strictEqual(result.start, 0)
      assert.strictEqual(result.end, 9)
    })

    it("finds exact match in middle", () => {
      const result = findQuoteInEvidence("The quick brown fox", "quick brown")
      assert.strictEqual(result.found, true)
      assert.strictEqual(result.matchType, "exact")
      assert.strictEqual(result.start, 4)
      assert.strictEqual(result.end, 15)
    })

    it("finds exact match at end", () => {
      const result = findQuoteInEvidence("The quick brown fox", "brown fox")
      assert.strictEqual(result.found, true)
      assert.strictEqual(result.matchType, "exact")
      assert.strictEqual(result.start, 10)
      assert.strictEqual(result.end, 19)
    })

    it("returns first occurrence for multiple matches", () => {
      const result = findQuoteInEvidence("foo bar foo", "foo")
      assert.strictEqual(result.found, true)
      assert.strictEqual(result.matchType, "exact")
      assert.strictEqual(result.start, 0)
    })
  })

  describe("normalized match", () => {
    it("finds match with extra whitespace in evidence", () => {
      const evidence = "The  quick   brown fox" // extra spaces
      const quote = "quick brown"
      const result = findQuoteInEvidence(evidence, quote)
      assert.strictEqual(result.found, true)
      assert.strictEqual(result.matchType, "normalized")
    })

    it("finds match with NBSP in evidence", () => {
      const evidence = "The\u00A0quick brown fox"
      const quote = "The quick"
      const result = findQuoteInEvidence(evidence, quote)
      assert.strictEqual(result.found, true)
      assert.strictEqual(result.matchType, "normalized")
    })

    it("finds match with curly quotes", () => {
      const evidence = "\u201CHello world\u201D said he"
      const quote = '"Hello world"'
      const result = findQuoteInEvidence(evidence, quote)
      assert.strictEqual(result.found, true)
      assert.strictEqual(result.matchType, "normalized")
    })

    it("finds match with soft hyphen", () => {
      const evidence = "Porez\u00ADna uprava"
      const quote = "Porezna uprava"
      const result = findQuoteInEvidence(evidence, quote)
      assert.strictEqual(result.found, true)
      assert.strictEqual(result.matchType, "normalized")
    })
  })

  describe("not found", () => {
    it("returns not_found for missing quote", () => {
      const result = findQuoteInEvidence("The quick brown fox", "lazy dog")
      assert.strictEqual(result.found, false)
      assert.strictEqual(result.matchType, "not_found")
      assert.strictEqual(result.start, undefined)
    })

    it("returns not_found for partial match", () => {
      const result = findQuoteInEvidence("The quick brown fox", "quick red")
      assert.strictEqual(result.found, false)
      assert.strictEqual(result.matchType, "not_found")
    })

    it("returns not_found for empty inputs", () => {
      assert.strictEqual(findQuoteInEvidence("", "test").found, false)
      assert.strictEqual(findQuoteInEvidence("test", "").found, false)
    })
  })

  describe("debug info", () => {
    it("includes quote preview", () => {
      const quote = "a".repeat(100)
      const result = findQuoteInEvidence("test", quote)
      assert.strictEqual(result.debug?.quotePreview.length, 80)
    })

    it("includes evidence hash when provided", () => {
      const result = findQuoteInEvidence("test", "test", "abc123")
      assert.strictEqual(result.debug?.evidenceHash, "abc123")
    })
  })
})

describe("validateQuoteInEvidence", () => {
  it("returns valid for exact match", () => {
    const result = validateQuoteInEvidence("ptr-1", "ev-1", "quick brown", "The quick brown fox")
    assert.strictEqual(result.valid, true)
    assert.strictEqual(result.matchResult.matchType, "exact")
  })

  it("returns valid for normalized match", () => {
    const result = validateQuoteInEvidence(
      "ptr-1",
      "ev-1",
      "quick brown",
      "The  quick   brown fox" // extra spaces
    )
    assert.strictEqual(result.valid, true)
    assert.strictEqual(result.matchResult.matchType, "normalized")
  })

  it("returns invalid for not found", () => {
    const result = validateQuoteInEvidence("ptr-1", "ev-1", "lazy dog", "The quick brown fox")
    assert.strictEqual(result.valid, false)
    assert.ok(result.error?.includes("Quote not found"))
    assert.ok(result.error?.includes("ptr-1"))
    assert.ok(result.error?.includes("ev-1"))
  })
})

describe("isMatchTypeAcceptableForTier", () => {
  describe("T0/T1 (critical)", () => {
    it("accepts exact match", () => {
      assert.strictEqual(isMatchTypeAcceptableForTier("exact", "T0").acceptable, true)
      assert.strictEqual(isMatchTypeAcceptableForTier("exact", "T1").acceptable, true)
    })

    it("rejects normalized match", () => {
      const result = isMatchTypeAcceptableForTier("normalized", "T0")
      assert.strictEqual(result.acceptable, false)
      assert.ok(result.reason?.includes("exact quote match"))
    })

    it("rejects not_found", () => {
      assert.strictEqual(isMatchTypeAcceptableForTier("not_found", "T0").acceptable, false)
      assert.strictEqual(isMatchTypeAcceptableForTier("not_found", "T1").acceptable, false)
    })
  })

  describe("T2/T3 (low risk)", () => {
    it("accepts exact match", () => {
      assert.strictEqual(isMatchTypeAcceptableForTier("exact", "T2").acceptable, true)
      assert.strictEqual(isMatchTypeAcceptableForTier("exact", "T3").acceptable, true)
    })

    it("accepts normalized match", () => {
      const result = isMatchTypeAcceptableForTier("normalized", "T2")
      assert.strictEqual(result.acceptable, true)
      assert.ok(result.reason?.includes("logged for audit"))
    })

    it("rejects not_found", () => {
      assert.strictEqual(isMatchTypeAcceptableForTier("not_found", "T2").acceptable, false)
      assert.strictEqual(isMatchTypeAcceptableForTier("not_found", "T3").acceptable, false)
    })
  })
})

describe("Croatian regulatory content", () => {
  const sampleEvidence = `
    Članak 123.
    (1) Porezna osnovica za obračun PDV-a je naknada za isporučena dobra ili obavljene usluge.
    (2) Naknadom se smatra sve ono što je isporučitelj primio ili treba primiti od kupca.
  `

  it("finds exact Croatian quote", () => {
    const quote = "Porezna osnovica za obračun PDV-a"
    const result = findQuoteInEvidence(sampleEvidence, quote)
    assert.strictEqual(result.found, true)
    assert.strictEqual(result.matchType, "exact")
  })

  it("finds quote with article reference", () => {
    const quote = "Članak 123."
    const result = findQuoteInEvidence(sampleEvidence, quote)
    assert.strictEqual(result.found, true)
  })

  it("handles Croatian special characters", () => {
    const quote = "isporučitelj primio"
    const result = findQuoteInEvidence(sampleEvidence, quote)
    assert.strictEqual(result.found, true)
  })
})

describe("Edge cases for provenance validation", () => {
  it("handles very long quotes", () => {
    const evidence = "a".repeat(10000)
    const quote = "a".repeat(100)
    const result = findQuoteInEvidence(evidence, quote)
    assert.strictEqual(result.found, true)
  })

  it("handles quotes with only whitespace differences", () => {
    const evidence = "hello\nworld"
    const quote = "hello world"
    const result = findQuoteInEvidence(evidence, quote)
    assert.strictEqual(result.found, true)
    assert.strictEqual(result.matchType, "normalized")
  })

  it("case sensitive matching", () => {
    const evidence = "Hello World"
    const quote = "hello world"
    const result = findQuoteInEvidence(evidence, quote)
    // Should NOT find - we're case sensitive
    assert.strictEqual(result.found, false)
  })

  it("does not find substring that spans word boundaries incorrectly", () => {
    const evidence = "taxation is theft"
    const quote = "tax is"
    const result = findQuoteInEvidence(evidence, quote)
    // "tax is" should not be found because "taxation" contains "tax" but not "tax "
    assert.strictEqual(result.found, false)
  })
})
