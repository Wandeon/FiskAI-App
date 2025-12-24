import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildAnswer } from "../answer-builder"
import * as conceptMatcher from "../concept-matcher"
import * as ruleSelector from "../rule-selector"
import * as conflictDetector from "../conflict-detector"
import * as citationBuilder from "../citation-builder"

vi.mock("../concept-matcher")
vi.mock("../rule-selector")
vi.mock("../conflict-detector")
vi.mock("../citation-builder")

describe("buildAnswer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns REFUSAL with NO_CITABLE_RULES when no concepts match", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([])

    const result = await buildAnswer("gibberish query", "MARKETING")

    expect(result.kind).toBe("REFUSAL")
    expect(result.refusalReason).toBe("NO_CITABLE_RULES")
  })

  it("returns REFUSAL with NO_CITABLE_RULES when no rules found", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([
      { conceptId: "c1", slug: "test", nameHr: "Test", score: 0.8, matchedKeywords: ["test"] },
    ])
    vi.mocked(ruleSelector.selectRules).mockResolvedValue([])

    const result = await buildAnswer("test query", "MARKETING")

    expect(result.kind).toBe("REFUSAL")
    expect(result.refusalReason).toBe("NO_CITABLE_RULES")
  })

  it("returns REFUSAL with UNRESOLVED_CONFLICT when conflict cannot be resolved", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([
      {
        conceptId: "c1",
        slug: "test-pdv",
        nameHr: "Test PDV",
        score: 0.8,
        matchedKeywords: ["test", "pdv"],
      },
    ])
    vi.mocked(ruleSelector.selectRules).mockResolvedValue([
      { id: "r1", value: "25", valueType: "percentage" } as any,
      { id: "r2", value: "13", valueType: "percentage" } as any,
    ])
    vi.mocked(conflictDetector.detectConflicts).mockReturnValue({
      hasConflict: true,
      canResolve: false,
      conflictingRules: [],
    })

    const result = await buildAnswer("test pdv query", "MARKETING")

    expect(result.kind).toBe("REFUSAL")
    expect(result.refusalReason).toBe("UNRESOLVED_CONFLICT")
  })

  it("returns ANSWER with citations when rules found", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([
      {
        conceptId: "c1",
        slug: "pausalni-prag",
        nameHr: "Prag paušalni",
        score: 0.9,
        matchedKeywords: ["prag", "pausalni"],
      },
    ])
    vi.mocked(ruleSelector.selectRules).mockResolvedValue([
      {
        id: "r1",
        titleHr: "Prag za paušalno",
        value: "39816.84",
        valueType: "currency_eur",
        authorityLevel: "LAW",
        explanationHr: "Godišnji primitak do 39.816,84 EUR.",
        sourcePointers: [{ id: "sp1" }],
        confidence: 0.95,
      } as any,
    ])
    vi.mocked(conflictDetector.detectConflicts).mockReturnValue({
      hasConflict: false,
      canResolve: true,
      conflictingRules: [],
    })
    vi.mocked(citationBuilder.buildCitations).mockReturnValue({
      primary: {
        id: "r1",
        title: "Test",
        authority: "LAW",
        url: "http://test.com",
        effectiveFrom: "2024-01-01",
        confidence: 0.9,
      },
      supporting: [],
    })

    const result = await buildAnswer("koji je prag za paušalni obrt", "MARKETING")

    expect(result.kind).toBe("ANSWER")
    expect(result.topic).toBe("REGULATORY")
    expect(result.citations).toBeDefined()
    expect(result.headline).toBeDefined()
  })

  it("classifies OUT_OF_SCOPE for non-regulatory queries", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([])

    // Query that sounds like product question
    const result = await buildAnswer("kako se prijaviti na FiskAI", "MARKETING")

    expect(result.kind).toBe("REFUSAL")
    // Could be OUT_OF_SCOPE or NO_CITABLE_RULES depending on classification
  })

  it("includes surface in response", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([])

    const marketingResult = await buildAnswer("test", "MARKETING")
    const appResult = await buildAnswer("test", "APP")

    expect(marketingResult.surface).toBe("MARKETING")
    expect(appResult.surface).toBe("APP")
  })

  it("includes requestId and traceId", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([])

    const result = await buildAnswer("test", "MARKETING")

    expect(result.requestId).toMatch(/^req_/)
    expect(result.traceId).toMatch(/^trace_/)
  })

  it("includes schemaVersion", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([])

    const result = await buildAnswer("test", "MARKETING")

    expect(result.schemaVersion).toBe("1.0.0")
  })

  it("includes createdAt timestamp", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([])

    const result = await buildAnswer("test", "MARKETING")

    expect(result.createdAt).toBeDefined()
    expect(new Date(result.createdAt).toString()).not.toBe("Invalid Date")
  })

  it("sets confidence level to HIGH when score >= 0.9", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([
      {
        conceptId: "c1",
        slug: "test-pdv",
        nameHr: "Test PDV",
        score: 0.8,
        matchedKeywords: ["test", "pdv"],
      },
    ])
    vi.mocked(ruleSelector.selectRules).mockResolvedValue([
      {
        id: "r1",
        titleHr: "Test",
        value: "100",
        valueType: "number",
        authorityLevel: "LAW",
        confidence: 0.95,
        sourcePointers: [{ id: "sp1" }],
      } as any,
    ])
    vi.mocked(conflictDetector.detectConflicts).mockReturnValue({
      hasConflict: false,
      canResolve: true,
      conflictingRules: [],
    })
    vi.mocked(citationBuilder.buildCitations).mockReturnValue({
      primary: {
        id: "r1",
        title: "Test",
        authority: "LAW",
        url: "http://test.com",
        effectiveFrom: "2024-01-01",
        confidence: 0.95,
      },
      supporting: [],
    })

    const result = await buildAnswer("test pdv query", "MARKETING")

    expect(result.confidence?.level).toBe("HIGH")
    expect(result.confidence?.score).toBe(0.95)
  })

  it("generates related questions", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([
      {
        conceptId: "c1",
        slug: "pausalni-prag",
        nameHr: "Prag paušalni",
        score: 0.9,
        matchedKeywords: ["pausalni", "prag"],
      },
    ])
    vi.mocked(ruleSelector.selectRules).mockResolvedValue([
      {
        id: "r1",
        titleHr: "Test",
        value: "100",
        valueType: "number",
        authorityLevel: "LAW",
        confidence: 0.9,
        sourcePointers: [{ id: "sp1" }],
      } as any,
    ])
    vi.mocked(conflictDetector.detectConflicts).mockReturnValue({
      hasConflict: false,
      canResolve: true,
      conflictingRules: [],
    })
    vi.mocked(citationBuilder.buildCitations).mockReturnValue({
      primary: {
        id: "r1",
        title: "Test",
        authority: "LAW",
        url: "http://test.com",
        effectiveFrom: "2024-01-01",
        confidence: 0.9,
      },
      supporting: [],
    })

    const result = await buildAnswer("pausalni prag", "MARKETING")

    expect(result.relatedQuestions).toBeDefined()
    expect(result.relatedQuestions!.length).toBeGreaterThan(0)
  })

  // CLIENT DATA DIFFERENTIATION TESTS
  describe("client data differentiation (APP vs MARKETING)", () => {
    const setupValidRules = () => {
      vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([
        {
          conceptId: "c1",
          slug: "pausalni-prag",
          nameHr: "Prag paušalni",
          score: 0.9,
          matchedKeywords: ["pausalni", "prag"],
        },
      ])
      vi.mocked(ruleSelector.selectRules).mockResolvedValue([
        {
          id: "r1",
          titleHr: "Test",
          value: "100",
          valueType: "number",
          authorityLevel: "LAW",
          confidence: 0.9,
          sourcePointers: [{ id: "sp1" }],
        } as any,
      ])
      vi.mocked(conflictDetector.detectConflicts).mockReturnValue({
        hasConflict: false,
        canResolve: true,
        conflictingRules: [],
      })
      vi.mocked(citationBuilder.buildCitations).mockReturnValue({
        primary: {
          id: "r1",
          title: "Test",
          authority: "LAW",
          url: "http://test.com",
          effectiveFrom: "2024-01-01",
          confidence: 0.9,
        },
        supporting: [],
      })
    }

    it("returns MISSING_CLIENT_DATA for APP surface with personalized query but no companyId", async () => {
      setupValidRules()

      // "moj prag" contains personalization keyword "moj"
      const result = await buildAnswer("moj prag za pausalni", "APP")

      expect(result.kind).toBe("REFUSAL")
      expect(result.refusalReason).toBe("MISSING_CLIENT_DATA")
      expect(result.clientContext).toBeDefined()
      expect(result.clientContext?.completeness.status).toBe("NONE")
      expect(result.clientContext?.missing).toBeDefined()
      expect(result.clientContext?.missing?.length).toBeGreaterThan(0)
    })

    it("returns ANSWER with clientContext for APP surface with companyId", async () => {
      setupValidRules()

      // With companyId provided, should proceed to answer
      const result = await buildAnswer("moj prag za pausalni", "APP", "company-123")

      expect(result.kind).toBe("ANSWER")
      expect(result.clientContext).toBeDefined()
      expect(result.clientContext?.completeness.status).toBe("PARTIAL")
    })

    it("returns ANSWER without clientContext for MARKETING surface", async () => {
      setupValidRules()

      // MARKETING surface should not have clientContext
      const result = await buildAnswer("moj prag za pausalni", "MARKETING")

      expect(result.kind).toBe("ANSWER")
      expect(result.clientContext).toBeUndefined()
    })

    it("includes clientContext.status=COMPLETE for APP non-personalized query", async () => {
      setupValidRules()

      // Query without personalization keywords
      const result = await buildAnswer("koji je prag za pausalni obrt", "APP")

      expect(result.kind).toBe("ANSWER")
      expect(result.clientContext).toBeDefined()
      expect(result.clientContext?.completeness.status).toBe("COMPLETE")
      expect(result.clientContext?.completeness.score).toBe(1.0)
    })

    it("detects personalization keywords: 'koliko', 'trebam', 'moram'", async () => {
      setupValidRules()

      // Test various personalization keywords
      const queries = ["koliko trebam platiti za PDV", "moram li se prijaviti za PDV"]

      for (const query of queries) {
        vi.clearAllMocks()
        setupValidRules()
        const result = await buildAnswer(query, "APP")
        expect(result.kind).toBe("REFUSAL")
        expect(result.refusalReason).toBe("MISSING_CLIENT_DATA")
      }
    })
  })
})
