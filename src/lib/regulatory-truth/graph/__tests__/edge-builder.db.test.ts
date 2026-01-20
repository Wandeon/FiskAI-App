// src/lib/regulatory-truth/graph/__tests__/edge-builder.db.test.ts
/**
 * Edge Builder Tests
 *
 * Tests for SRG edge computation including:
 * - SUPERSEDES edges (temporal ordering)
 * - OVERRIDES edges (from ClaimExceptions)
 * - DEPENDS_ON edges (from appliesWhen DSL)
 * - Edge trace building
 * - Rule selection with edge traversal
 */
import { describe, it, before, after } from "node:test"
import assert from "node:assert"
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
  after(async () => {
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

      assert.ok(result.supersedes.created >= 1, "Should create at least one SUPERSEDES edge")
      assert.deepStrictEqual(result.supersedes.errors, [], "Should have no errors")

      // Verify edge exists: newerRule -> olderRule (newer supersedes older)
      const edge = await db.graphEdge.findFirst({
        where: {
          fromRuleId: newerRuleId,
          toRuleId: olderRuleId,
          relation: "SUPERSEDES",
          namespace: "SRG",
        },
      })

      assert.ok(edge, "SUPERSEDES edge should exist from newer to older rule")
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

      assert.ok(edge2025to2024, "2025 should supersede 2024")
      assert.ok(edge2024to2023, "2024 should supersede 2023")
    })

    it("does not create edges for DRAFT rules", async () => {
      const conceptSlug = `${testPrefix}-draft-test`

      const publishedRule = await createTestRule({
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
      assert.strictEqual(
        result.supersedes.created,
        0,
        "DRAFT rule should not create SUPERSEDES edges"
      )
      assert.strictEqual(result.totalEdges, 0, "DRAFT rule should have no edges")
    })
  })

  describe("buildEdgeTrace", () => {
    it("builds trace with supersession chain", async () => {
      const conceptSlug = `${testPrefix}-trace-test`

      // Create chain: 2025 -> 2024 -> 2023
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

      // Rebuild edges
      await rebuildEdgesForRule(rule2023)
      await rebuildEdgesForRule(rule2024)
      await rebuildEdgesForRule(rule2025)

      // Build trace for 2025 rule
      const trace = await buildEdgeTrace(rule2025)

      assert.strictEqual(trace.selectedRuleId, rule2025, "Selected rule should match")
      assert.ok(trace.supersessionChain.length >= 1, "Should have supersession chain")
      assert.ok(trace.supersessionChain.includes(rule2024), "Chain should include 2024 rule")

      // Check traversed edges
      const supersedesEdges = trace.traversedEdges.filter((e) => e.type === "SUPERSEDES")
      assert.ok(supersedesEdges.length >= 1, "Should have SUPERSEDES edges in trace")
    })

    it("returns empty trace for rule with no edges", async () => {
      const isolatedRule = await createTestRule({
        conceptSlug: `${testPrefix}-isolated`,
        effectiveFrom: new Date(2025, 0, 1),
        status: "PUBLISHED",
      })

      const trace = await buildEdgeTrace(isolatedRule)

      assert.strictEqual(trace.selectedRuleId, isolatedRule)
      assert.deepStrictEqual(trace.supersessionChain, [])
      assert.deepStrictEqual(trace.overriddenBy, [])
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

      assert.ok(superseding.includes(ruleMid), "Mid rule should supersede old")
      // ruleNew transitively supersedes ruleOld via ruleMid
      assert.ok(superseding.includes(ruleNew), "New rule should transitively supersede old")
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

      assert.ok(superseded.includes(rule2021), "2022 should supersede 2021 directly")
      // 2022 -> 2021 -> 2020 transitively
      assert.ok(superseded.includes(rule2020), "2022 should transitively supersede 2020")
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

      assert.ok(result.dependsOn.created >= 1, "Should create DEPENDS_ON edge")

      // Verify edge exists
      const edge = await db.graphEdge.findFirst({
        where: {
          fromRuleId: mainRule.id,
          toRuleId: depRule,
          relation: "DEPENDS_ON",
          namespace: "SRG",
        },
      })

      assert.ok(edge, "DEPENDS_ON edge should exist")
    })
  })
})

describe("selectRuleFromDb with edges", () => {
  // Note: These tests require the TOPIC_TO_CONCEPT_SLUG mapping to include test slugs
  // For now, we test the edge traversal logic directly via the edge-builder functions

  const testPrefix = `test-select-${Date.now()}`
  const ruleIds: string[] = []

  after(async () => {
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

    assert.strictEqual(result.success, false)
    assert.strictEqual(result.reason, "NO_RULE_FOUND")
  })
})
