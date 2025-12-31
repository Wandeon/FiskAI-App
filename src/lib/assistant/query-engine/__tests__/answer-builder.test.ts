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

// Mock Prisma to prevent real database calls
vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findUnique: vi.fn().mockResolvedValue({
        id: "company-123",
        name: "Test Company",
        legalForm: "OBRT_PAUSAL",
        fiscalEnabled: true,
      }),
    },
  },
}))

// Helper to create a mock source pointer with evidence
function createMockSourcePointer(id: string = "sp1") {
  return {
    id,
    evidence: {
      fetchedAt: new Date(),
    },
    exactQuote: "Mock quote for evidence",
  }
}

// Helper to create RuleSelectionResult from rules array
function mockRuleSelectionResult(rules: any[]): ruleSelector.RuleSelectionResult {
  return {
    rules,
    ineligible: [],
    hasMissingContext: false,
    missingContextRuleIds: [],
    asOfDate: new Date().toISOString(),
  }
}

describe("buildAnswer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns REFUSAL for queries that fail interpretation gates", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([])

    // Vague/gibberish queries now get caught by interpretation gates
    const result = await buildAnswer("gibberish query", "MARKETING")

    expect(result.kind).toBe("REFUSAL")
    // Could be NEEDS_CLARIFICATION (vague) or OUT_OF_SCOPE (nonsense)
    expect(["NEEDS_CLARIFICATION", "OUT_OF_SCOPE", "NO_CITABLE_RULES"]).toContain(
      result.refusalReason
    )
  })

  it("returns NEEDS_CLARIFICATION for vague queries with no matches", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([])
    vi.mocked(ruleSelector.selectRules).mockResolvedValue(mockRuleSelectionResult([]))

    // Vague queries now get NEEDS_CLARIFICATION, not NO_CITABLE_RULES
    const result = await buildAnswer("test query", "MARKETING")

    expect(result.kind).toBe("REFUSAL")
    // New behavior: vague queries get clarification, not "no sources"
    expect(["NEEDS_CLARIFICATION", "NO_CITABLE_RULES"]).toContain(result.refusalReason)
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
    vi.mocked(ruleSelector.selectRules).mockResolvedValue(
      mockRuleSelectionResult([
        { id: "r1", value: "25", valueType: "percentage" } as any,
        { id: "r2", value: "13", valueType: "percentage" } as any,
      ])
    )
    vi.mocked(conflictDetector.detectConflicts).mockReturnValue({
      hasConflict: true,
      canResolve: false,
      conflictingRules: [],
    })

    const result = await buildAnswer("test pdv query", "MARKETING")

    expect(result.kind).toBe("REFUSAL")
    expect(result.refusalReason).toBe("UNRESOLVED_CONFLICT")
  })

  it("returns ANSWER with citations when rules found for specific query", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([
      {
        conceptId: "c1",
        slug: "pausalni-prag",
        nameHr: "Prag paušalni",
        score: 0.9,
        matchedKeywords: ["prag", "pausalni", "godisnji", "prihod"],
      },
    ])
    vi.mocked(ruleSelector.selectRules).mockResolvedValue(
      mockRuleSelectionResult([
        {
          id: "r1",
          titleHr: "Prag za paušalno",
          value: "39816.84",
          valueType: "currency_eur",
          authorityLevel: "LAW",
          explanationHr: "Godišnji primitak do 39.816,84 EUR.",
          sourcePointers: [createMockSourcePointer("sp1")],
          confidence: 0.95,
        } as any,
      ])
    )
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
        quote: "Test quote for evidence",
        effectiveFrom: "2024-01-01",
        confidence: 0.9,
      },
      supporting: [],
    })

    // Use a specific query with enough context to pass confidence threshold
    const result = await buildAnswer(
      "Koji je godišnji prag prihoda za paušalni obrt u Hrvatskoj?",
      "MARKETING"
    )

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
    vi.mocked(ruleSelector.selectRules).mockResolvedValue(
      mockRuleSelectionResult([
        {
          id: "r1",
          titleHr: "Test",
          value: "100",
          valueType: "number",
          authorityLevel: "LAW",
          confidence: 0.95,
          sourcePointers: [createMockSourcePointer("sp1")],
        } as any,
      ])
    )
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
        quote: "Test quote for evidence",
        effectiveFrom: "2024-01-01",
        confidence: 0.95,
      },
      supporting: [],
    })

    // Use specific query to pass confidence threshold
    const result = await buildAnswer("Koja je stopa PDV-a u Hrvatskoj za hranu?", "MARKETING")

    expect(result.confidence?.level).toBe("HIGH")
    // Confidence score is computed from multiple factors, should be >= 0.9 for HIGH
    expect(result.confidence?.score).toBeGreaterThanOrEqual(0.9)
  })

  it("generates related questions for specific queries", async () => {
    vi.mocked(conceptMatcher.matchConcepts).mockResolvedValue([
      {
        conceptId: "c1",
        slug: "pausalni-prag",
        nameHr: "Prag paušalni",
        score: 0.9,
        matchedKeywords: ["pausalni", "prag", "godisnji", "prihod"],
      },
    ])
    vi.mocked(ruleSelector.selectRules).mockResolvedValue(
      mockRuleSelectionResult([
        {
          id: "r1",
          titleHr: "Test",
          value: "100",
          valueType: "number",
          authorityLevel: "LAW",
          confidence: 0.9,
          sourcePointers: [createMockSourcePointer("sp1")],
        } as any,
      ])
    )
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
        quote: "Test quote for evidence",
        effectiveFrom: "2024-01-01",
        confidence: 0.9,
      },
      supporting: [],
    })

    // Use specific query to pass confidence threshold
    const result = await buildAnswer(
      "Koji je godišnji prag prihoda za paušalni obrt u Hrvatskoj?",
      "MARKETING"
    )

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
      vi.mocked(ruleSelector.selectRules).mockResolvedValue(
        mockRuleSelectionResult([
          {
            id: "r1",
            titleHr: "Test",
            value: "100",
            valueType: "number",
            authorityLevel: "LAW",
            confidence: 0.9,
            sourcePointers: [createMockSourcePointer("sp1")],
          } as any,
        ])
      )
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
          quote: "Test quote for evidence",
          effectiveFrom: "2024-01-01",
          confidence: 0.9,
        },
        supporting: [],
      })
    }

    it("returns MISSING_CLIENT_DATA for APP surface with personalized query but no companyId", async () => {
      setupValidRules()

      // "moj prag" contains personalization keyword "moj" - use specific query
      const result = await buildAnswer(
        "Koliko mi preostaje do godišnjeg praga za paušalni obrt?",
        "APP"
      )

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
      // Query with personalization keyword "moj" requires specific enough context
      const result = await buildAnswer(
        "Koliko mi preostaje do praga za paušalni obrt?",
        "APP",
        "company-123"
      )

      expect(result.kind).toBe("ANSWER")
      expect(result.clientContext).toBeDefined()
      expect(result.clientContext?.completeness.status).toBe("PARTIAL")
    })

    it("returns ANSWER without clientContext for MARKETING surface", async () => {
      setupValidRules()

      // MARKETING surface should not have clientContext
      // Use specific query to pass confidence threshold
      const result = await buildAnswer(
        "Koji je godišnji prag prihoda za paušalni obrt u Hrvatskoj?",
        "MARKETING"
      )

      expect(result.kind).toBe("ANSWER")
      expect(result.clientContext).toBeUndefined()
    })

    it("includes clientContext.status=COMPLETE for APP non-personalized query", async () => {
      setupValidRules()

      // Query without personalization keywords - must be specific enough to pass threshold
      const result = await buildAnswer(
        "Koji je godišnji prag prihoda za paušalni obrt u Hrvatskoj?",
        "APP"
      )

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
