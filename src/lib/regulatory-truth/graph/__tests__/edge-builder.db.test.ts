// src/lib/regulatory-truth/graph/__tests__/edge-builder.db.test.ts
/**
 * Edge Builder Tests (DB Integration)
 *
 * Tests for SRG edge computation including:
 * - SUPERSEDES edges (temporal ordering)
 * - OVERRIDES edges (from ClaimExceptions)
 * - DEPENDS_ON edges (from appliesWhen DSL)
 * - Edge trace building
 * - Rule selection with edge traversal
 */
import { describe, it, afterAll, expect } from "vitest"
import { db } from "@/lib/db"
import {
  rebuildEdgesForRule,
  buildEdgeTrace,
  findSupersedingRules,
  findSupersededRules,
} from "../edge-builder"
import { selectRuleFromDb } from "../../eval/rule-store"

describe("edge-builder", () => {
  const testPrefix = `test-edge-${Date.now()}`
  const ruleIds: string[] = []
  let ruleCounter = 0

  // Helper to create test rules with configurable properties
  async function createTestRule(options: {
    conceptSlug?: string
    effectiveFrom?: Date
    effectiveUntil?: Date | null
    status?: "DRAFT" | "APPROVED" | "PUBLISHED"
  }): Promise<string> {
    ruleCounter++
    const slug = options.conceptSlug ?? `${testPrefix}-rule-${ruleCounter}`
    const rule = await db.regulatoryRule.create({
      data: {
        conceptSlug: slug,
        titleHr: `Test Rule ${ruleCounter}`,
        titleEn: `Test Rule ${ruleCounter}`,
        riskTier: "T2",
        authorityLevel: "GUIDANCE",
        appliesWhen: JSON.stringify({ op: "true" }),
        value: "test",
        valueType: "text",
        effectiveFrom: options.effectiveFrom ?? new Date(2025, 0, 1),
        effectiveUntil: options.effectiveUntil ?? null,
        status: options.status ?? "PUBLISHED",
        confidence: 0.9,
      },
    })
    ruleIds.push(rule.id)
    return rule.id
  }

  // Clean up test data
  afterAll(async () => {
    // Delete edges first (both namespaces)
    await db.graphEdge.deleteMany({
      where: {
        OR: [{ fromRuleId: { in: ruleIds } }, { toRuleId: { in: ruleIds } }],
      },
    })

    // Delete rules
    await db.regulatoryRule.deleteMany({
      where: { conceptSlug: { startsWith: testPrefix } },
    })
  })

  describe("rebuildEdgesForRule - SUPERSEDES", () => {
    it("creates SUPERSEDES edge when newer rule has later effectiveFrom", async () => {
      const conceptSlug = `${testPrefix}-supersedes-test`

      // Create older rule (2024-01-01)
      const olderRuleId = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2024, 0, 1),
        status: "PUBLISHED",
      })

      // Create newer rule (2025-01-01)
      const newerRuleId = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2025, 0, 1),
        status: "PUBLISHED",
      })

      // Rebuild edges for the newer rule
      const result = await rebuildEdgesForRule(newerRuleId)

      expect(result.supersedes.created).toBeGreaterThanOrEqual(1)
      expect(result.supersedes.errors).toEqual([])

      // Verify edge exists: newerRule -> olderRule (newer supersedes older)
      const edge = await db.graphEdge.findFirst({
        where: {
          fromRuleId: newerRuleId,
          toRuleId: olderRuleId,
          relation: "SUPERSEDES",
          namespace: "SRG",
        },
      })

      expect(edge).toBeTruthy()
    })

    it("creates bidirectional supersession awareness", async () => {
      const conceptSlug = `${testPrefix}-bidir-test`

      // Create three rules with different effectiveFrom dates
      const rule2023 = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2023, 0, 1),
        status: "PUBLISHED",
      })

      const rule2024 = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2024, 0, 1),
        status: "PUBLISHED",
      })

      const rule2025 = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2025, 0, 1),
        status: "PUBLISHED",
      })

      // Rebuild edges for all rules
      await rebuildEdgesForRule(rule2023)
      await rebuildEdgesForRule(rule2024)
      await rebuildEdgesForRule(rule2025)

      // The chain should be: 2025 -> 2024 -> 2023
      const edge2025to2024 = await db.graphEdge.findFirst({
        where: {
          fromRuleId: rule2025,
          toRuleId: rule2024,
          relation: "SUPERSEDES",
          namespace: "SRG",
        },
      })

      const edge2024to2023 = await db.graphEdge.findFirst({
        where: {
          fromRuleId: rule2024,
          toRuleId: rule2023,
          relation: "SUPERSEDES",
          namespace: "SRG",
        },
      })

      expect(edge2025to2024).toBeTruthy()
      expect(edge2024to2023).toBeTruthy()
    })

    it("does not create edges for DRAFT rules", async () => {
      const conceptSlug = `${testPrefix}-draft-test`

      await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2024, 0, 1),
        status: "PUBLISHED",
      })

      const draftRule = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2025, 0, 1),
        status: "DRAFT",
      })

      const result = await rebuildEdgesForRule(draftRule)

      // DRAFT rules should not have edges created
      expect(result.supersedes.created).toBe(0)
      expect(result.totalEdges).toBe(0)
    })
  })

  describe("buildEdgeTrace", () => {
    it("builds trace with supersession chain", async () => {
      const conceptSlug = `${testPrefix}-trace-test`

      // Create chain: 2025 -> 2024 -> 2023
      await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2023, 0, 1),
        status: "PUBLISHED",
      })

      const rule2024 = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2024, 0, 1),
        status: "PUBLISHED",
      })

      const rule2025 = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2025, 0, 1),
        status: "PUBLISHED",
      })

      // Rebuild edges
      await rebuildEdgesForRule(rule2024)
      await rebuildEdgesForRule(rule2025)

      // Build trace for 2025 rule
      const trace = await buildEdgeTrace(rule2025)

      expect(trace.selectedRuleId).toBe(rule2025)
      expect(trace.supersessionChain.length).toBeGreaterThanOrEqual(1)
      expect(trace.supersessionChain).toContain(rule2024)

      // Check traversed edges
      const supersedesEdges = trace.traversedEdges.filter((e) => e.type === "SUPERSEDES")
      expect(supersedesEdges.length).toBeGreaterThanOrEqual(1)
    })

    it("returns empty trace for rule with no edges", async () => {
      const isolatedRule = await createTestRule({
        conceptSlug: `${testPrefix}-isolated`,
        effectiveFrom: new Date(2025, 0, 1),
        status: "PUBLISHED",
      })

      const trace = await buildEdgeTrace(isolatedRule)

      expect(trace.selectedRuleId).toBe(isolatedRule)
      expect(trace.supersessionChain).toEqual([])
      expect(trace.overriddenBy).toEqual([])
    })
  })

  describe("findSupersedingRules / findSupersededRules", () => {
    it("finds all rules that supersede a given rule (transitively)", async () => {
      const conceptSlug = `${testPrefix}-find-superseding`

      const ruleOld = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2022, 0, 1),
        status: "PUBLISHED",
      })

      const ruleMid = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2023, 0, 1),
        status: "PUBLISHED",
      })

      const ruleNew = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2024, 0, 1),
        status: "PUBLISHED",
      })

      // Build edges
      await rebuildEdgesForRule(ruleOld)
      await rebuildEdgesForRule(ruleMid)
      await rebuildEdgesForRule(ruleNew)

      // Find rules that supersede the oldest
      const superseding = await findSupersedingRules(ruleOld)

      expect(superseding).toContain(ruleMid)
      // ruleNew transitively supersedes ruleOld via ruleMid
      expect(superseding).toContain(ruleNew)
    })

    it("finds all rules superseded by a given rule (transitively)", async () => {
      const conceptSlug = `${testPrefix}-find-superseded`

      const rule2020 = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2020, 0, 1),
        status: "PUBLISHED",
      })

      const rule2021 = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2021, 0, 1),
        status: "PUBLISHED",
      })

      const rule2022 = await createTestRule({
        conceptSlug,
        effectiveFrom: new Date(2022, 0, 1),
        status: "PUBLISHED",
      })

      // Build edges
      await rebuildEdgesForRule(rule2020)
      await rebuildEdgesForRule(rule2021)
      await rebuildEdgesForRule(rule2022)

      // Find rules superseded by newest
      const superseded = await findSupersededRules(rule2022)

      expect(superseded).toContain(rule2021)
      // 2022 -> 2021 -> 2020 transitively
      expect(superseded).toContain(rule2020)
    })
  })

  describe("rebuildEdgesForRule - DEPENDS_ON", () => {
    it("creates DEPENDS_ON edges from appliesWhen DSL with concept_ref", async () => {
      // Create dependency rule
      const depRule = await createTestRule({
        conceptSlug: `${testPrefix}-dependency`,
        effectiveFrom: new Date(2024, 0, 1),
        status: "PUBLISHED",
      })

      // Create rule with appliesWhen referencing the dependency
      const mainRule = await db.regulatoryRule.create({
        data: {
          conceptSlug: `${testPrefix}-main-depends`,
          titleHr: "Main Rule",
          titleEn: "Main Rule",
          riskTier: "T2",
          authorityLevel: "GUIDANCE",
          appliesWhen: JSON.stringify({
            op: "and",
            conditions: [{ concept_ref: `${testPrefix}-dependency` }],
          }),
          value: "test",
          valueType: "text",
          effectiveFrom: new Date(2024, 0, 1),
          status: "PUBLISHED",
          confidence: 0.9,
        },
      })
      ruleIds.push(mainRule.id)

      // Rebuild edges
      const result = await rebuildEdgesForRule(mainRule.id)

      expect(result.dependsOn.created).toBeGreaterThanOrEqual(1)

      // Verify edge exists
      const edge = await db.graphEdge.findFirst({
        where: {
          fromRuleId: mainRule.id,
          toRuleId: depRule,
          relation: "DEPENDS_ON",
          namespace: "SRG",
        },
      })

      expect(edge).toBeTruthy()
    })
  })
})

describe("selectRuleFromDb with edges", () => {
  // Note: These tests require the TOPIC_TO_CONCEPT_SLUG mapping to include test slugs
  // For now, we test the edge traversal logic directly via the edge-builder functions

  const testPrefix = `test-select-${Date.now()}`
  const ruleIds: string[] = []

  afterAll(async () => {
    await db.graphEdge.deleteMany({
      where: {
        OR: [{ fromRuleId: { in: ruleIds } }, { toRuleId: { in: ruleIds } }],
      },
    })

    await db.regulatoryRule.deleteMany({
      where: { conceptSlug: { startsWith: testPrefix } },
    })
  })

  it("selectRuleFromDb returns NO_RULE_FOUND for unmapped topic", async () => {
    const result = await selectRuleFromDb("UNKNOWN/TOPIC/KEY", new Date())

    expect(result.success).toBe(false)
    expect(result.reason).toBe("NO_RULE_FOUND")
  })
})
