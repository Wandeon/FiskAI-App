// src/lib/assistant/query-engine/__tests__/citation-builder.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- Test file uses partial mocks */
import { describe, it, expect } from "vitest"
import { buildCitations } from "../citation-builder"
import type { RuleCandidate } from "../rule-selector"
import type { CitationBlock } from "@/lib/assistant/types"

const mockSourcePointer = {
  id: "sp1",
  evidenceId: "e1",
  exactQuote: "Godišnji primitak od 39.816,84 eura",
  contextBefore: "Članak 82.",
  contextAfter: null,
  articleNumber: "82",
  lawReference: "Zakon o porezu na dohodak (NN 115/16)",
  evidence: {
    id: "ev_123",
    url: "https://narodne-novine.nn.hr/clanci/sluzbeni/2016_12_115_2519.html",
    fetchedAt: new Date("2024-01-15T10:00:00Z"),
    source: {
      name: "Narodne novine",
      url: "https://narodne-novine.nn.hr",
    },
  },
}

const mockRule: Partial<RuleCandidate> = {
  id: "r1",
  titleHr: "Prag za paušalno oporezivanje",
  authorityLevel: "LAW",
  effectiveFrom: new Date("2024-01-01"),
  confidence: 0.95,
  sourcePointers: [mockSourcePointer as any],
}

describe("buildCitations", () => {
  it("returns null for empty rules", () => {
    const result = buildCitations([])
    expect(result).toBeNull()
  })

  it("builds primary citation from first rule", () => {
    const result = buildCitations([mockRule as RuleCandidate])

    expect(result?.primary).toBeDefined()
    expect(result?.primary.title).toBe("Prag za paušalno oporezivanje")
    expect(result?.primary.authority).toBe("LAW")
  })

  it("includes quote from source pointer", () => {
    const result = buildCitations([mockRule as RuleCandidate])

    expect(result?.primary.quote).toBe("Godišnji primitak od 39.816,84 eura")
  })

  it("includes URL from evidence", () => {
    const result = buildCitations([mockRule as RuleCandidate])

    expect(result?.primary.url).toBe(
      "https://narodne-novine.nn.hr/clanci/sluzbeni/2016_12_115_2519.html"
    )
  })

  it("includes evidenceId for fail-closed validation", () => {
    const result = buildCitations([mockRule as RuleCandidate])

    expect(result?.primary.evidenceId).toBe("ev_123")
  })

  it("includes fetchedAt for fail-closed validation", () => {
    const result = buildCitations([mockRule as RuleCandidate])

    expect(result?.primary.fetchedAt).toBe("2024-01-15T10:00:00.000Z")
  })

  it("builds supporting citations from remaining rules", () => {
    const secondRule = {
      ...mockRule,
      id: "r2",
      titleHr: "Uputa Porezne uprave",
      authorityLevel: "GUIDANCE",
    } as RuleCandidate

    const result = buildCitations([mockRule as RuleCandidate, secondRule])

    expect(result?.supporting).toHaveLength(1)
    expect(result?.supporting[0].title).toBe("Uputa Porezne uprave")
  })

  it("limits supporting citations to 3", () => {
    const manyRules = Array(5)
      .fill(null)
      .map((_, i) => ({
        ...mockRule,
        id: `r${i}`,
        titleHr: `Rule ${i}`,
      })) as RuleCandidate[]

    const result = buildCitations(manyRules)

    expect(result?.supporting.length).toBeLessThanOrEqual(3)
  })

  it("skips rules without source pointers", () => {
    const ruleWithoutPointers = {
      ...mockRule,
      id: "r2",
      sourcePointers: [],
    } as RuleCandidate

    const result = buildCitations([mockRule as RuleCandidate, ruleWithoutPointers])

    expect(result?.supporting).toHaveLength(0)
  })
})
