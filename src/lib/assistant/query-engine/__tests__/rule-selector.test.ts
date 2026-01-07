// src/lib/assistant/query-engine/__tests__/rule-selector.test.ts
// PHASE-C CUTOVER: Updated to mock dbReg.ruleFact instead of prisma.regulatoryRule
/* eslint-disable @typescript-eslint/no-explicit-any -- Test file uses partial mocks */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { selectRules } from "../rule-selector"

vi.mock("@/lib/db/regulatory", () => ({
  dbReg: {
    ruleFact: {
      findMany: vi.fn(),
    },
    evidence: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

import { dbReg } from "@/lib/db/regulatory"

const today = new Date()
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
const lastYear = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)

// PHASE-C: Mock data now uses RuleFact format instead of RegulatoryRule
const mockRuleFacts = [
  {
    id: "r1",
    conceptSlug: "pausalni-prag",
    conceptId: "c1",
    subjectType: "ALL",
    subjectDescription: "Prag za paušalno oporezivanje",
    objectType: "PRAG_PRIHODA",
    objectDescription: "Godišnji prag za paušalni obrt",
    conditions: { always: true },
    value: "39816.84",
    valueType: "CURRENCY_EUR",
    displayValue: "39.816,84 EUR",
    effectiveFrom: lastYear,
    effectiveUntil: null,
    authority: "LAW",
    legalReference: { raw: "Zakon o porezu na dohodak" },
    groundingQuotes: [
      {
        text: "Quote 1",
        evidenceId: "e1",
        articleNumber: "38",
        lawReference: "Zakon o porezu na dohodak",
      },
    ],
    riskTier: "T1",
    confidence: 0.95,
    status: "PUBLISHED",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "r2",
    conceptSlug: "pausalni-prag",
    conceptId: "c1",
    subjectType: "ALL",
    subjectDescription: "Stari prag",
    objectType: "PRAG_PRIHODA",
    objectDescription: "Stari godišnji prag",
    conditions: { always: true },
    value: "35000",
    valueType: "CURRENCY_EUR",
    displayValue: "35.000 EUR",
    effectiveFrom: lastYear,
    effectiveUntil: yesterday, // Expired
    authority: "GUIDANCE",
    legalReference: null,
    groundingQuotes: [],
    riskTier: "T2",
    confidence: 0.9,
    status: "PUBLISHED",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "r3",
    conceptSlug: "pausalni-prag",
    conceptId: "c1",
    subjectType: "ALL",
    subjectDescription: "Draft rule",
    objectType: "PRAG_PRIHODA",
    objectDescription: "Draft godišnji prag",
    conditions: { always: true },
    value: "40000",
    valueType: "CURRENCY_EUR",
    displayValue: "40.000 EUR",
    effectiveFrom: lastYear,
    effectiveUntil: null,
    authority: "LAW",
    legalReference: null,
    groundingQuotes: [],
    riskTier: "T1",
    confidence: 0.85,
    status: "DRAFT", // Not published
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "r4",
    conceptSlug: "pausalni-prag",
    conceptId: "c1",
    subjectType: "ALL",
    subjectDescription: "Future rule",
    objectType: "PRAG_PRIHODA",
    objectDescription: "Future godišnji prag",
    conditions: { always: true },
    value: "45000",
    valueType: "CURRENCY_EUR",
    displayValue: "45.000 EUR",
    effectiveFrom: tomorrow, // Not yet effective
    effectiveUntil: null,
    authority: "LAW",
    legalReference: null,
    groundingQuotes: [],
    riskTier: "T1",
    confidence: 0.95,
    status: "PUBLISHED",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

describe("selectRules", () => {
  beforeEach(() => {
    // Mock dbReg.evidence.findMany to return evidence for source pointer tests
    vi.mocked(dbReg.evidence.findMany).mockResolvedValue([
      {
        id: "e1",
        url: "https://example.com",
        fetchedAt: new Date(),
        source: { id: "s1", name: "Test Source", url: "https://example.com" },
      } as any,
    ])

    // PHASE-C: Mock dbReg.ruleFact.findMany instead of prisma.regulatoryRule.findMany
    // The mock filters by status (PUBLISHED only) - eligibility gate handles temporal filtering
    vi.mocked(dbReg.ruleFact.findMany).mockImplementation((async (args: any) => {
      return mockRuleFacts.filter((rf) => {
        // Filter by conceptSlug
        const whereAny = args?.where as Record<string, unknown> | undefined
        if (whereAny?.conceptSlug) {
          const slugFilter = whereAny.conceptSlug as { in?: string[] }
          if (slugFilter.in && !slugFilter.in.includes(rf.conceptSlug)) {
            return false
          }
        }

        // Filter by status
        if (whereAny?.status && rf.status !== whereAny.status) {
          return false
        }

        return true
      })
    }) as any)
  })

  it("returns only PUBLISHED rules", async () => {
    const result = await selectRules(["pausalni-prag"])

    expect(result.rules.every((r) => r.status === "PUBLISHED")).toBe(true)
    expect(result.rules.map((r) => r.id)).not.toContain("r3")
  })

  it("filters out expired rules via eligibility gate", async () => {
    const result = await selectRules(["pausalni-prag"])

    // r2 is expired, should be in ineligible list
    expect(result.rules.map((r) => r.id)).not.toContain("r2")
    expect(result.ineligible.find((i) => i.ruleId === "r2")?.reason).toBe("EXPIRED")
  })

  it("filters out future rules via eligibility gate", async () => {
    const result = await selectRules(["pausalni-prag"])

    // r4 is future, should be in ineligible list
    expect(result.rules.map((r) => r.id)).not.toContain("r4")
    expect(result.ineligible.find((i) => i.ruleId === "r4")?.reason).toBe("FUTURE")
  })

  it("sorts by authority level then confidence", async () => {
    const result = await selectRules(["pausalni-prag"])

    // r1 should be first (LAW > GUIDANCE)
    expect(result.rules[0]?.id).toBe("r1")
  })

  it("returns empty result for unknown concepts", async () => {
    const result = await selectRules(["nepostojeci-koncept"])

    expect(result.rules).toEqual([])
    expect(result.ineligible).toEqual([])
  })

  it("includes source pointers in result", async () => {
    const result = await selectRules(["pausalni-prag"])

    const r1 = result.rules.find((r) => r.id === "r1")
    expect(r1?.sourcePointers).toHaveLength(1)
  })

  it("returns asOfDate in result", async () => {
    const result = await selectRules(["pausalni-prag"])

    expect(result.asOfDate).toBeDefined()
    expect(new Date(result.asOfDate).getTime()).toBeCloseTo(Date.now(), -3)
  })

  it("respects custom asOfDate for temporal filtering", async () => {
    // Use a date in the past when r2 was still valid
    const pastDate = new Date(lastYear.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days after lastYear
    const result = await selectRules(["pausalni-prag"], { asOfDate: pastDate })

    // r2 should now be eligible (it hadn't expired yet)
    expect(result.rules.map((r) => r.id)).toContain("r2")
    // r4 should still be future
    expect(result.ineligible.find((i) => i.ruleId === "r4")?.reason).toBe("FUTURE")
  })
})
