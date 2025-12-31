// src/lib/assistant/query-engine/__tests__/concept-matcher.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { matchConcepts, type ConceptMatch } from "../concept-matcher"

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    concept: {
      findMany: vi.fn(),
    },
  },
}))

// Mock semantic-search to use keyword-only mode
vi.mock("../semantic-search", () => ({
  hybridSearch: vi.fn().mockResolvedValue([]),
  semanticSearch: vi.fn().mockResolvedValue([]),
}))

import { prisma } from "@/lib/prisma"

const mockConcepts = [
  {
    id: "c1",
    slug: "pausalni-obrt",
    nameHr: "Paušalni obrt",
    aliases: ["pausalni", "pausalno", "pausalno oporezivanje"],
  },
  {
    id: "c2",
    slug: "pdv-stopa",
    nameHr: "Stopa PDV-a",
    aliases: ["pdv", "porez dodanu vrijednost", "vat"],
  },
  {
    id: "c3",
    slug: "pausalni-prag",
    nameHr: "Prag za paušalno",
    aliases: ["prag", "limit", "threshold"],
  },
  {
    id: "c4",
    slug: "fiskalizacija-obveza",
    nameHr: "Obveza fiskalizacije",
    aliases: ["fiskalizacija", "fiskal", "blagajna"],
  },
]

describe("matchConcepts", () => {
  beforeEach(() => {
    vi.mocked(prisma.concept.findMany).mockResolvedValue(mockConcepts as any)
  })

  describe("valid queries", () => {
    it("matches concepts by exact slug keywords", async () => {
      const matches = await matchConcepts(["pausalni", "obrt"], { mode: "keyword" })

      expect(matches).toContainEqual(
        expect.objectContaining({ conceptId: "c1", score: expect.any(Number) })
      )
    })

    it("matches concepts by aliases", async () => {
      const matches = await matchConcepts(["pdv"], { mode: "keyword" })

      expect(matches).toContainEqual(expect.objectContaining({ conceptId: "c2" }))
    })

    it("matches 'pdv prag' to pdv-stopa and pausalni-prag concepts", async () => {
      const matches = await matchConcepts(["pdv", "prag"], { mode: "keyword" })

      // Should match pdv-stopa (has 'pdv' alias)
      expect(matches).toContainEqual(expect.objectContaining({ conceptId: "c2" }))
      // Should also match pausalni-prag (has 'prag' alias)
      expect(matches).toContainEqual(expect.objectContaining({ conceptId: "c3" }))
    })

    it("matches 'fiskalizacija' query", async () => {
      const matches = await matchConcepts(["fiskalizacija"], { mode: "keyword" })

      expect(matches).toContainEqual(expect.objectContaining({ conceptId: "c4" }))
    })

    it("normalizes diacritics before matching", async () => {
      const matches = await matchConcepts(["paušalni"], { mode: "keyword" }) // with diacritic

      expect(matches).toContainEqual(expect.objectContaining({ conceptId: "c1" }))
    })
  })

  describe("FAIL-CLOSED: gibberish queries must return NO matches", () => {
    it("returns empty array for 'xyz123 asdfghjkl'", async () => {
      const matches = await matchConcepts(["xyz123", "asdfghjkl"], { mode: "keyword" })

      expect(matches).toEqual([])
    })

    it("returns empty array for 'random text about nothing'", async () => {
      const matches = await matchConcepts(["random", "text", "about", "nothing"], {
        mode: "keyword",
      })

      expect(matches).toEqual([])
    })

    it("returns empty array for short tokens only", async () => {
      const matches = await matchConcepts(["ab", "cd", "xy"], { mode: "keyword" })

      expect(matches).toEqual([])
    })

    it("returns empty array for stopwords only", async () => {
      const matches = await matchConcepts(["the", "and", "or", "is"], { mode: "keyword" })

      expect(matches).toEqual([])
    })

    it("returns empty array for numbers only", async () => {
      const matches = await matchConcepts(["123", "456", "789"], { mode: "keyword" })

      expect(matches).toEqual([])
    })

    it("returns empty array for mixed gibberish", async () => {
      const matches = await matchConcepts(["qwerty", "asdfgh", "zxcvbn"], { mode: "keyword" })

      expect(matches).toEqual([])
    })
  })

  describe("scoring and threshold", () => {
    it("returns higher score for more keyword matches", async () => {
      const matches = await matchConcepts(["pausalni", "prag"], { mode: "keyword" })

      const pragMatch = matches.find((m) => m.conceptId === "c3")
      const obrtMatch = matches.find((m) => m.conceptId === "c1")

      // c3 has both 'pausalni' (from slug) and 'prag', c1 has 'pausalni' (from slug/aliases)
      expect(pragMatch).toBeDefined()
      expect(obrtMatch).toBeDefined()
    })

    it("filters out low-score matches", async () => {
      // Query with many tokens, only one matches
      const matches = await matchConcepts(
        ["pdv", "nepostoji", "random", "gibberish", "more", "tokens"],
        { mode: "keyword" }
      )

      // Score would be 1/6 = 0.16, below threshold of 0.25
      expect(matches).toEqual([])
    })

    it("includes matches above threshold", async () => {
      // Query with 2 tokens, one matches - score = 0.5 > 0.25
      const matches = await matchConcepts(["pdv", "stopa"], { mode: "keyword" })

      expect(matches.length).toBeGreaterThan(0)
    })
  })

  describe("edge cases", () => {
    it("returns empty array for empty keywords", async () => {
      const matches = await matchConcepts([], { mode: "keyword" })

      expect(matches).toEqual([])
    })

    it("handles concepts with no aliases", async () => {
      // Use concept that won't match "test" query
      vi.mocked(prisma.concept.findMany).mockResolvedValue([
        { id: "c5", slug: "unrelated-concept", nameHr: "Nepoznat koncept", aliases: null },
      ] as any)

      const matches = await matchConcepts(["test"], { mode: "keyword" })

      // "test" doesn't match "unrelated", "concept", or "nepoznat" - should be empty
      expect(matches).toEqual([])
    })
  })
})
