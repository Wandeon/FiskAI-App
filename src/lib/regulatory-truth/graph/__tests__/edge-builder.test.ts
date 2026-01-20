// src/lib/regulatory-truth/graph/__tests__/edge-builder.test.ts
/**
 * Edge Builder Unit Tests (Mocked DB)
 *
 * Tests for SRG edge computation logic with mocked database.
 * These tests verify the algorithm without requiring a real database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the database before importing modules that use it
vi.mock("@/lib/db", () => ({
  db: {
    regulatoryRule: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    graphEdge: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    atomicClaim: {
      findMany: vi.fn(),
    },
  },
}))

// Mock cycle-detection
vi.mock("../cycle-detection", () => ({
  createEdgeWithCycleCheck: vi.fn(),
  CycleDetectedError: class CycleDetectedError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "CycleDetectedError"
    }
  },
}))

import { db } from "@/lib/db"
import { createEdgeWithCycleCheck } from "../cycle-detection"

describe("edge-builder logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("rebuildEdgesForRule - SUPERSEDES logic", () => {
    it("creates SUPERSEDES edge to immediately preceding rule", async () => {
      // Import after mocks are set up
      const { rebuildEdgesForRule } = await import("../edge-builder")

      const newerRule = {
        id: "rule-2025",
        conceptSlug: "pdv-prag",
        effectiveFrom: new Date("2025-01-01"),
        effectiveUntil: null,
        status: "PUBLISHED",
        revokedAt: null,
        atomicClaims: [],
        appliesWhen: JSON.stringify({ op: "true" }),
      }

      const olderRule = {
        id: "rule-2024",
        conceptSlug: "pdv-prag",
        effectiveFrom: new Date("2024-01-01"),
        effectiveUntil: null,
        status: "PUBLISHED",
        revokedAt: null,
      }

      vi.mocked(db.regulatoryRule.findUnique).mockResolvedValue(newerRule as any)
      vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([olderRule] as any)
      vi.mocked(db.graphEdge.deleteMany).mockResolvedValue({ count: 0 })
      vi.mocked(db.graphEdge.findFirst).mockResolvedValue(null)
      vi.mocked(db.graphEdge.count).mockResolvedValue(1)
      vi.mocked(createEdgeWithCycleCheck).mockResolvedValue({ id: "edge-1" } as any)

      const result = await rebuildEdgesForRule("rule-2025")

      expect(result.ruleId).toBe("rule-2025")
      expect(result.supersedes.created).toBe(1)
      expect(result.supersedes.errors).toEqual([])

      // Verify createEdgeWithCycleCheck was called with correct args
      expect(createEdgeWithCycleCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          fromRuleId: "rule-2025",
          toRuleId: "rule-2024",
          relation: "SUPERSEDES",
        })
      )
    })

    it("does not create edges for DRAFT rules", async () => {
      const { rebuildEdgesForRule } = await import("../edge-builder")

      const draftRule = {
        id: "rule-draft",
        conceptSlug: "pdv-prag",
        effectiveFrom: new Date("2025-01-01"),
        status: "DRAFT",
        atomicClaims: [],
        appliesWhen: JSON.stringify({ op: "true" }),
      }

      vi.mocked(db.regulatoryRule.findUnique).mockResolvedValue(draftRule as any)

      const result = await rebuildEdgesForRule("rule-draft")

      expect(result.supersedes.created).toBe(0)
      expect(result.overrides.created).toBe(0)
      expect(result.dependsOn.created).toBe(0)
      expect(createEdgeWithCycleCheck).not.toHaveBeenCalled()
    })

    it("returns error when rule not found", async () => {
      const { rebuildEdgesForRule } = await import("../edge-builder")

      vi.mocked(db.regulatoryRule.findUnique).mockResolvedValue(null)

      const result = await rebuildEdgesForRule("nonexistent")

      expect(result.supersedes.errors).toContain("Rule not found: nonexistent")
    })
  })

  describe("rebuildEdgesForRule - DEPENDS_ON logic", () => {
    it("extracts dependencies from appliesWhen with concept_ref", async () => {
      const { rebuildEdgesForRule } = await import("../edge-builder")

      const mainRule = {
        id: "rule-main",
        conceptSlug: "main-rule",
        effectiveFrom: new Date("2025-01-01"),
        status: "PUBLISHED",
        revokedAt: null,
        atomicClaims: [],
        appliesWhen: JSON.stringify({
          op: "and",
          conditions: [{ concept_ref: "dependency-slug" }],
        }),
      }

      const depRule = {
        id: "rule-dep",
        conceptSlug: "dependency-slug",
        effectiveFrom: new Date("2024-01-01"),
        status: "PUBLISHED",
      }

      vi.mocked(db.regulatoryRule.findUnique).mockResolvedValue(mainRule as any)
      // First call for SUPERSEDES (same conceptSlug), second for DEPENDS_ON
      vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([])
      vi.mocked(db.regulatoryRule.findFirst).mockResolvedValue(depRule as any)
      vi.mocked(db.graphEdge.deleteMany).mockResolvedValue({ count: 0 })
      vi.mocked(db.graphEdge.count).mockResolvedValue(1)
      vi.mocked(createEdgeWithCycleCheck).mockResolvedValue({ id: "edge-1" } as any)

      const result = await rebuildEdgesForRule("rule-main")

      expect(result.dependsOn.created).toBe(1)
      expect(createEdgeWithCycleCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          fromRuleId: "rule-main",
          toRuleId: "rule-dep",
          relation: "DEPENDS_ON",
        })
      )
    })

    it("extracts dependencies from depends_on array", async () => {
      const { rebuildEdgesForRule } = await import("../edge-builder")

      const mainRule = {
        id: "rule-main",
        conceptSlug: "main-rule",
        effectiveFrom: new Date("2025-01-01"),
        status: "PUBLISHED",
        revokedAt: null,
        atomicClaims: [],
        appliesWhen: JSON.stringify({
          depends_on: ["dep-1", "dep-2"],
        }),
      }

      vi.mocked(db.regulatoryRule.findUnique).mockResolvedValue(mainRule as any)
      vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([])
      vi.mocked(db.regulatoryRule.findFirst)
        .mockResolvedValueOnce({ id: "rule-dep-1", conceptSlug: "dep-1" } as any)
        .mockResolvedValueOnce({ id: "rule-dep-2", conceptSlug: "dep-2" } as any)
      vi.mocked(db.graphEdge.deleteMany).mockResolvedValue({ count: 0 })
      vi.mocked(db.graphEdge.count).mockResolvedValue(2)
      vi.mocked(createEdgeWithCycleCheck).mockResolvedValue({ id: "edge" } as any)

      const result = await rebuildEdgesForRule("rule-main")

      expect(result.dependsOn.created).toBe(2)
    })
  })
})

describe("buildEdgeTrace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("builds trace with supersession chain", async () => {
    const { buildEdgeTrace } = await import("../edge-builder")

    // Rule 2025 supersedes Rule 2024 supersedes Rule 2023
    vi.mocked(db.graphEdge.findFirst)
      .mockResolvedValueOnce({
        // First call: 2025 -> 2024
        fromRuleId: "rule-2025",
        toRuleId: "rule-2024",
        relation: "SUPERSEDES",
      } as any)
      .mockResolvedValueOnce({
        // Second call: 2024 -> 2023
        fromRuleId: "rule-2024",
        toRuleId: "rule-2023",
        relation: "SUPERSEDES",
      } as any)
      .mockResolvedValueOnce(null) // No more supersession

    vi.mocked(db.graphEdge.findMany).mockResolvedValue([]) // No OVERRIDES edges

    const trace = await buildEdgeTrace("rule-2025")

    expect(trace.selectedRuleId).toBe("rule-2025")
    expect(trace.supersessionChain).toContain("rule-2024")
    expect(trace.supersessionChain).toContain("rule-2023")
    expect(trace.traversedEdges.length).toBe(2)
    expect(trace.traversedEdges[0]).toEqual({
      from: "rule-2025",
      to: "rule-2024",
      type: "SUPERSEDES",
      direction: "outgoing",
    })
  })

  it("includes overriding rules in trace", async () => {
    const { buildEdgeTrace } = await import("../edge-builder")

    vi.mocked(db.graphEdge.findFirst).mockResolvedValue(null) // No supersession
    vi.mocked(db.graphEdge.findMany).mockResolvedValue([
      {
        fromRuleId: "override-rule",
        toRuleId: "rule-2025",
        relation: "OVERRIDES",
      },
    ] as any)

    const trace = await buildEdgeTrace("rule-2025")

    expect(trace.overriddenBy).toContain("override-rule")
    expect(trace.traversedEdges).toContainEqual({
      from: "override-rule",
      to: "rule-2025",
      type: "OVERRIDES",
      direction: "incoming",
    })
  })
})

describe("findSupersedingRules", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("finds all rules that supersede a given rule transitively", async () => {
    const { findSupersedingRules } = await import("../edge-builder")

    // rule-old is superseded by rule-mid, which is superseded by rule-new
    vi.mocked(db.graphEdge.findMany)
      .mockResolvedValueOnce([{ fromRuleId: "rule-mid" }] as any) // First query for rule-old
      .mockResolvedValueOnce([{ fromRuleId: "rule-new" }] as any) // Second query for rule-mid
      .mockResolvedValueOnce([]) // Third query for rule-new (no more)

    const result = await findSupersedingRules("rule-old")

    expect(result).toContain("rule-mid")
    expect(result).toContain("rule-new")
    expect(result.length).toBe(2)
  })

  it("handles cycles gracefully (visited set)", async () => {
    const { findSupersedingRules } = await import("../edge-builder")

    // Simulate a cycle: A <- B <- A (shouldn't happen with cycle detection, but test defensive code)
    vi.mocked(db.graphEdge.findMany)
      .mockResolvedValueOnce([{ fromRuleId: "rule-b" }] as any)
      .mockResolvedValueOnce([{ fromRuleId: "rule-a" }] as any) // Would point back to A
      .mockResolvedValueOnce([]) // When checking A again, return nothing (already visited)

    const result = await findSupersedingRules("rule-a")

    // Should not infinite loop
    expect(result).toContain("rule-b")
    // The visited set should prevent re-adding rule-a
    expect(result.filter((r) => r === "rule-a").length).toBeLessThanOrEqual(1)
  })
})

// Note: findSupersededRules is tested via integration with the DB
// The mocking complexity makes unit testing difficult
// See edge-builder.db.test.ts for full integration tests

describe("selectRuleFromDb edge integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns NO_RULE_FOUND for unmapped topic", async () => {
    const { selectRuleFromDb } = await import("../../eval/rule-store")

    const result = await selectRuleFromDb("UNKNOWN/TOPIC/KEY", new Date())

    expect(result.success).toBe(false)
    expect(result.reason).toBe("NO_RULE_FOUND")
  })

  it("selects authoritative rule when multiple effective rules exist with supersession", async () => {
    // Reset module cache for fresh import
    vi.resetModules()

    // Two rules: newer supersedes older
    const newerRule = {
      id: "rule-2025",
      conceptSlug: "pdv-prag-obveznog-upisa",
      effectiveFrom: new Date("2025-01-01"),
      effectiveUntil: null,
      status: "PUBLISHED",
      revokedAt: null,
    }

    const olderRule = {
      id: "rule-2024",
      conceptSlug: "pdv-prag-obveznog-upisa",
      effectiveFrom: new Date("2024-01-01"),
      effectiveUntil: null,
      status: "PUBLISHED",
      revokedAt: null,
    }

    // Setup mocks
    vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([newerRule, olderRule] as any)

    // Mock edge queries based on query structure
    vi.mocked(db.graphEdge.findMany).mockImplementation(async (args: any) => {
      const where = args?.where
      // findSupersedingRules queries WHERE toRuleId = X
      if (where?.toRuleId === "rule-2024" && where?.relation === "SUPERSEDES") {
        return [{ fromRuleId: "rule-2025" }] as any
      }
      if (where?.toRuleId === "rule-2025" && where?.relation === "SUPERSEDES") {
        return [] // Nothing supersedes the newest rule
      }
      // OVERRIDES queries
      if (where?.toRuleId && where?.relation === "OVERRIDES") {
        return []
      }
      return []
    })

    vi.mocked(db.graphEdge.findFirst).mockImplementation(async (args: any) => {
      const where = args?.where
      // buildEdgeTrace SUPERSEDES traversal
      if (where?.fromRuleId === "rule-2025" && where?.relation === "SUPERSEDES") {
        return {
          fromRuleId: "rule-2025",
          toRuleId: "rule-2024",
          relation: "SUPERSEDES",
        } as any
      }
      return null
    })

    const { selectRuleFromDb } = await import("../../eval/rule-store")

    // Query date where both rules are effective
    const result = await selectRuleFromDb("TAX/VAT/REGISTRATION", new Date("2025-06-15"))

    expect(result.success).toBe(true)
    expect(result.rule?.id).toBe("rule-2025") // Newer rule is authoritative
    expect(result.reason).toBe("EFFECTIVE")
  })

  it("returns CONFLICT_MULTIPLE_EFFECTIVE when multiple authoritative rules exist", async () => {
    const { selectRuleFromDb } = await import("../../eval/rule-store")

    // Two rules with same effectiveFrom, no supersession
    const ruleA = {
      id: "rule-a",
      conceptSlug: "pdv-prag-obveznog-upisa",
      effectiveFrom: new Date("2025-01-01"),
      effectiveUntil: null,
      status: "PUBLISHED",
      revokedAt: null,
    }

    const ruleB = {
      id: "rule-b",
      conceptSlug: "pdv-prag-obveznog-upisa",
      effectiveFrom: new Date("2025-01-01"),
      effectiveUntil: null,
      status: "PUBLISHED",
      revokedAt: null,
    }

    vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([ruleA, ruleB] as any)

    // No supersession edges between them
    vi.mocked(db.graphEdge.findMany).mockResolvedValue([])

    const result = await selectRuleFromDb("TAX/VAT/REGISTRATION", new Date("2025-06-15"))

    expect(result.success).toBe(false)
    expect(result.reason).toBe("CONFLICT_MULTIPLE_EFFECTIVE")
    expect(result.conflictingRuleIds).toContain("rule-a")
    expect(result.conflictingRuleIds).toContain("rule-b")
  })

  it("returns NO_COVERAGE when query date is before all rules", async () => {
    const { selectRuleFromDb } = await import("../../eval/rule-store")

    const rule = {
      id: "rule-2025",
      conceptSlug: "pdv-prag-obveznog-upisa",
      effectiveFrom: new Date("2025-01-01"),
      effectiveUntil: null,
      status: "PUBLISHED",
      revokedAt: null,
    }

    vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([rule] as any)

    // Query date before rule is effective
    const result = await selectRuleFromDb("TAX/VAT/REGISTRATION", new Date("2024-06-15"))

    expect(result.success).toBe(false)
    expect(result.reason).toBe("NO_COVERAGE")
    expect(result.earliestCoverageDate).toBe("2025-01-01")
  })
})
