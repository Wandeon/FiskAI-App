// src/lib/regulatory-truth/__tests__/quote-in-evidence.test.ts
// Tests for provenance validation: quote-in-evidence matching

import { describe, it, expect } from "vitest"
import {
  normalizeForMatch,
  findQuoteInEvidence,
  validateQuoteInEvidence,
  isMatchTypeAcceptableForTier,
} from "../utils/quote-in-evidence"

describe("normalizeForMatch", () => {
  describe("basic normalization", () => {
    it("returns empty string for empty input", () => {
      expect(normalizeForMatch("")).toBe("")
      expect(normalizeForMatch(null as unknown as string)).toBe("")
    })

    it("trims whitespace", () => {
      expect(normalizeForMatch("  hello  ")).toBe("hello")
    })

    it("collapses multiple spaces to single space", () => {
      expect(normalizeForMatch("hello   world")).toBe("hello world")
    })

    it("collapses newlines and tabs to space", () => {
      expect(normalizeForMatch("hello\n\nworld")).toBe("hello world")
      expect(normalizeForMatch("hello\t\tworld")).toBe("hello world")
    })
  })

  describe("unicode normalization", () => {
    it("normalizes NBSP to regular space", () => {
      expect(normalizeForMatch("hello\u00A0world")).toBe("hello world")
    })

    it("removes soft hyphens", () => {
      expect(normalizeForMatch("hel\u00ADlo")).toBe("hello")
    })

    it("normalizes curly quotes to straight quotes", () => {
      expect(normalizeForMatch("\u201Chello\u201D")).toBe('"hello"')
      expect(normalizeForMatch("\u201Ehello\u201C")).toBe('"hello"')
    })

    it("normalizes curly apostrophes to straight apostrophe", () => {
      expect(normalizeForMatch("don\u2019t")).toBe("don't")
      expect(normalizeForMatch("don\u2018t")).toBe("don't")
    })

    it("normalizes guillemets to straight quotes", () => {
      expect(normalizeForMatch("\u00ABhello\u00BB")).toBe('"hello"')
    })
  })

  describe("NFKC normalization", () => {
    it("normalizes ligatures", () => {
      // ﬁ -> fi
      expect(normalizeForMatch("\uFB01rst")).toBe("first")
    })

    it("normalizes full-width characters", () => {
      // ＡＢＣ -> ABC
      expect(normalizeForMatch("\uFF21\uFF22\uFF23")).toBe("ABC")
    })
  })

  describe("determinism", () => {
    it("produces identical output for same input", () => {
      const input = "Članak 123. stavak 1. točka a)"
      const result1 = normalizeForMatch(input)
      const result2 = normalizeForMatch(input)
      expect(result1).toBe(result2)
    })

    it("handles Croatian characters correctly", () => {
      const input = "Šćžčć ŠĆŽČĆ"
      const result = normalizeForMatch(input)
      expect(result).toBe("Šćžčć ŠĆŽČĆ")
    })
  })
})

describe("findQuoteInEvidence", () => {
  describe("exact match", () => {
    it("finds exact match at start", () => {
      const result = findQuoteInEvidence("The quick brown fox", "The quick")
      expect(result.found).toBe(true)
      expect(result.matchType).toBe("exact")
      expect(result.start).toBe(0)
      expect(result.end).toBe(9)
    })

    it("finds exact match in middle", () => {
      const result = findQuoteInEvidence("The quick brown fox", "quick brown")
      expect(result.found).toBe(true)
      expect(result.matchType).toBe("exact")
      expect(result.start).toBe(4)
      expect(result.end).toBe(15)
    })

    it("finds exact match at end", () => {
      const result = findQuoteInEvidence("The quick brown fox", "brown fox")
      expect(result.found).toBe(true)
      expect(result.matchType).toBe("exact")
      expect(result.start).toBe(10)
      expect(result.end).toBe(19)
    })

    it("returns first occurrence for multiple matches", () => {
      const result = findQuoteInEvidence("foo bar foo", "foo")
      expect(result.found).toBe(true)
      expect(result.matchType).toBe("exact")
      expect(result.start).toBe(0)
    })
  })

  describe("normalized match", () => {
    it("finds match with extra whitespace in evidence", () => {
      const evidence = "The  quick   brown fox" // extra spaces
      const quote = "quick brown"
      const result = findQuoteInEvidence(evidence, quote)
      expect(result.found).toBe(true)
      expect(result.matchType).toBe("normalized")
    })

    it("finds match with NBSP in evidence", () => {
      const evidence = "The\u00A0quick brown fox"
      const quote = "The quick"
      const result = findQuoteInEvidence(evidence, quote)
      expect(result.found).toBe(true)
      expect(result.matchType).toBe("normalized")
    })

    it("finds match with curly quotes", () => {
      const evidence = "\u201CHello world\u201D said he"
      const quote = '"Hello world"'
      const result = findQuoteInEvidence(evidence, quote)
      expect(result.found).toBe(true)
      expect(result.matchType).toBe("normalized")
    })

    it("finds match with soft hyphen", () => {
      const evidence = "Porez\u00ADna uprava"
      const quote = "Porezna uprava"
      const result = findQuoteInEvidence(evidence, quote)
      expect(result.found).toBe(true)
      expect(result.matchType).toBe("normalized")
    })
  })

  describe("not found", () => {
    it("returns not_found for missing quote", () => {
      const result = findQuoteInEvidence("The quick brown fox", "lazy dog")
      expect(result.found).toBe(false)
      expect(result.matchType).toBe("not_found")
      expect(result.start).toBeUndefined()
    })

    it("returns not_found for partial match", () => {
      const result = findQuoteInEvidence("The quick brown fox", "quick red")
      expect(result.found).toBe(false)
      expect(result.matchType).toBe("not_found")
    })

    it("returns not_found for empty inputs", () => {
      expect(findQuoteInEvidence("", "test").found).toBe(false)
      expect(findQuoteInEvidence("test", "").found).toBe(false)
    })
  })

  describe("debug info", () => {
    it("includes quote preview", () => {
      const quote = "a".repeat(100)
      const result = findQuoteInEvidence("test", quote)
      expect(result.debug?.quotePreview.length).toBe(80)
    })

    it("includes evidence hash when provided", () => {
      const result = findQuoteInEvidence("test", "test", "abc123")
      expect(result.debug?.evidenceHash).toBe("abc123")
    })
  })
})

describe("validateQuoteInEvidence", () => {
  it("returns valid for exact match", () => {
    const result = validateQuoteInEvidence("ptr-1", "ev-1", "quick brown", "The quick brown fox")
    expect(result.valid).toBe(true)
    expect(result.matchResult.matchType).toBe("exact")
  })

  it("returns valid for normalized match", () => {
    const result = validateQuoteInEvidence(
      "ptr-1",
      "ev-1",
      "quick brown",
      "The  quick   brown fox" // extra spaces
    )
    expect(result.valid).toBe(true)
    expect(result.matchResult.matchType).toBe("normalized")
  })

  it("returns invalid for not found", () => {
    const result = validateQuoteInEvidence("ptr-1", "ev-1", "lazy dog", "The quick brown fox")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("Quote not found")
    expect(result.error).toContain("ptr-1")
    expect(result.error).toContain("ev-1")
  })
})

describe("isMatchTypeAcceptableForTier", () => {
  describe("T0/T1 (critical)", () => {
    it("accepts exact match", () => {
      expect(isMatchTypeAcceptableForTier("exact", "T0").acceptable).toBe(true)
      expect(isMatchTypeAcceptableForTier("exact", "T1").acceptable).toBe(true)
    })

    it("rejects normalized match", () => {
      const result = isMatchTypeAcceptableForTier("normalized", "T0")
      expect(result.acceptable).toBe(false)
      expect(result.reason).toContain("exact quote match")
    })

    it("rejects not_found", () => {
      expect(isMatchTypeAcceptableForTier("not_found", "T0").acceptable).toBe(false)
      expect(isMatchTypeAcceptableForTier("not_found", "T1").acceptable).toBe(false)
    })
  })

  describe("T2/T3 (low risk)", () => {
    it("accepts exact match", () => {
      expect(isMatchTypeAcceptableForTier("exact", "T2").acceptable).toBe(true)
      expect(isMatchTypeAcceptableForTier("exact", "T3").acceptable).toBe(true)
    })

    it("accepts normalized match", () => {
      const result = isMatchTypeAcceptableForTier("normalized", "T2")
      expect(result.acceptable).toBe(true)
      expect(result.reason).toContain("logged for audit")
    })

    it("rejects not_found", () => {
      expect(isMatchTypeAcceptableForTier("not_found", "T2").acceptable).toBe(false)
      expect(isMatchTypeAcceptableForTier("not_found", "T3").acceptable).toBe(false)
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
    expect(result.found).toBe(true)
    expect(result.matchType).toBe("exact")
  })

  it("finds quote with article reference", () => {
    const quote = "Članak 123."
    const result = findQuoteInEvidence(sampleEvidence, quote)
    expect(result.found).toBe(true)
  })

  it("handles Croatian special characters", () => {
    const quote = "isporučitelj primio"
    const result = findQuoteInEvidence(sampleEvidence, quote)
    expect(result.found).toBe(true)
  })
})

describe("Edge cases for provenance validation", () => {
  it("handles very long quotes", () => {
    const evidence = "a".repeat(10000)
    const quote = "a".repeat(100)
    const result = findQuoteInEvidence(evidence, quote)
    expect(result.found).toBe(true)
  })

  it("handles quotes with only whitespace differences", () => {
    const evidence = "hello\nworld"
    const quote = "hello world"
    const result = findQuoteInEvidence(evidence, quote)
    expect(result.found).toBe(true)
    expect(result.matchType).toBe("normalized")
  })

  it("case sensitive matching", () => {
    const evidence = "Hello World"
    const quote = "hello world"
    const result = findQuoteInEvidence(evidence, quote)
    // Should NOT find - we're case sensitive
    expect(result.found).toBe(false)
  })

  it("does not find substring that spans word boundaries incorrectly", () => {
    const evidence = "taxation is theft"
    const quote = "tax is"
    const result = findQuoteInEvidence(evidence, quote)
    // "tax is" should not be found because "taxation" contains "tax" but not "tax "
    expect(result.found).toBe(false)
  })
})
