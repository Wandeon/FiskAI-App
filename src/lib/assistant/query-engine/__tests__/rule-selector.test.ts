// src/lib/assistant/query-engine/__tests__/rule-selector.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- Test file uses partial mocks */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { selectRules, type RuleCandidate, type RuleSelectionResult } from "../rule-selector"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    regulatoryRule: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"

const today = new Date()
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
const lastYear = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)

const mockRules = [
  {
    id: "r1",
    conceptSlug: "pausalni-prag",
    titleHr: "Prag za paušalno oporezivanje",
    authorityLevel: "LAW",
    status: "PUBLISHED",
    effectiveFrom: lastYear,
    effectiveUntil: null,
    confidence: 0.95,
    value: "39816.84",
    valueType: "currency_eur",
    appliesWhen: JSON.stringify({ op: "true" }),
    sourcePointers: [
      {
        id: "sp1",
        evidenceId: "e1",
        exactQuote: "Quote 1",
        contextBefore: null,
        contextAfter: null,
        articleNumber: null,
        lawReference: null,
        evidence: {
          id: "e1",
          url: "https://example.com",
          fetchedAt: new Date(),
          source: { name: "Test Source", url: "https://example.com" },
        },
      },
    ],
  },
  {
    id: "r2",
    conceptSlug: "pausalni-prag",
    titleHr: "Stari prag",
    authorityLevel: "GUIDANCE",
    status: "PUBLISHED",
    effectiveFrom: lastYear,
    effectiveUntil: yesterday, // Expired
    confidence: 0.9,
    value: "35000",
    valueType: "currency_eur",
    appliesWhen: null,
    sourcePointers: [],
  },
  {
    id: "r3",
    conceptSlug: "pausalni-prag",
    titleHr: "Draft rule",
    authorityLevel: "LAW",
    status: "DRAFT", // Not published
    effectiveFrom: lastYear,
    effectiveUntil: null,
    confidence: 0.85,
    value: "40000",
    valueType: "currency_eur",
    appliesWhen: null,
    sourcePointers: [],
  },
  {
    id: "r4",
    conceptSlug: "pausalni-prag",
    titleHr: "Future rule",
    authorityLevel: "LAW",
    status: "PUBLISHED",
    effectiveFrom: tomorrow, // Not yet effective
    effectiveUntil: null,
    confidence: 0.95,
    value: "45000",
    valueType: "currency_eur",
    appliesWhen: null,
    sourcePointers: [],
  },
]

describe("selectRules", () => {
  beforeEach(() => {
    // Mock implementation that only filters by status (PUBLISHED)
    // The eligibility gate handles temporal filtering in-memory
    vi.mocked(prisma.regulatoryRule.findMany).mockImplementation((async (args: any) => {
      return mockRules.filter((rule) => {
        // Filter by conceptSlug
        const whereAny = args?.where as Record<string, unknown> | undefined
        if (whereAny?.conceptSlug) {
          const slugFilter = whereAny.conceptSlug as { in?: string[] }
          if (slugFilter.in && !slugFilter.in.includes(rule.conceptSlug)) {
            return false
          }
        }

        // Filter by status
        if (whereAny?.status && rule.status !== whereAny.status) {
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
