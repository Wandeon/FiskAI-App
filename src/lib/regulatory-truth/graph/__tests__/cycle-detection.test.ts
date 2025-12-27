// src/lib/regulatory-truth/graph/__tests__/cycle-detection.test.ts
import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { db } from "@/lib/db"
import {
  wouldCreateCycle,
  createEdgeWithCycleCheck,
  validateGraphAcyclicity,
  findPath,
  CycleDetectedError,
} from "../cycle-detection"

describe("cycle-detection", () => {
  const testPrefix = `test-cycle-${Date.now()}`
  const ruleIds: string[] = []
  let ruleCounter = 0

  // Helper to create test rules with unique conceptSlug+effectiveFrom combinations
  async function createTestRule(slug: string): Promise<string> {
    ruleCounter++
    // Use unique effectiveFrom to avoid unique constraint (conceptSlug, effectiveFrom, status)
    const effectiveFrom = new Date(2020, 0, 1 + ruleCounter) // Different date for each rule
    const rule = await db.regulatoryRule.create({
      data: {
        conceptSlug: `${testPrefix}-${slug}-${ruleCounter}`,
        titleHr: `Test Rule ${slug}`,
        titleEn: `Test Rule ${slug}`,
        riskTier: "T2",
        authorityLevel: "GUIDANCE",
        appliesWhen: JSON.stringify({ op: "true" }),
        value: "test",
        valueType: "text",
        effectiveFrom,
        status: "DRAFT",
        confidence: 0.9,
      },
    })
    ruleIds.push(rule.id)
    return rule.id
  }

  // Clean up test data
  after(async () => {
    // Delete edges first
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

  describe("wouldCreateCycle", () => {
    it("returns true for self-loops", async () => {
      const ruleA = await createTestRule("self-loop")
      const result = await wouldCreateCycle(ruleA, ruleA)
      assert.strictEqual(result, true, "Self-loop should be detected as a cycle")
    })

    it("returns false for simple edge with no existing path", async () => {
      const ruleA = await createTestRule("simple-a")
      const ruleB = await createTestRule("simple-b")

      const result = await wouldCreateCycle(ruleA, ruleB)
      assert.strictEqual(result, false, "Should not detect cycle for simple new edge")
    })

    it("returns true when edge would create a 2-node cycle", async () => {
      const ruleA = await createTestRule("two-node-a")
      const ruleB = await createTestRule("two-node-b")

      // Create edge A -> B
      await db.graphEdge.create({
        data: {
          fromRuleId: ruleA,
          toRuleId: ruleB,
          relation: "SUPERSEDES",
          validFrom: new Date(),
        },
      })

      // Check if B -> A would create a cycle
      const result = await wouldCreateCycle(ruleB, ruleA)
      assert.strictEqual(result, true, "Should detect cycle when B -> A already has A -> B")
    })

    it("returns true for longer cycle paths (A -> B -> C, checking C -> A)", async () => {
      const ruleA = await createTestRule("three-node-a")
      const ruleB = await createTestRule("three-node-b")
      const ruleC = await createTestRule("three-node-c")

      // Create A -> B -> C
      await db.graphEdge.create({
        data: {
          fromRuleId: ruleA,
          toRuleId: ruleB,
          relation: "SUPERSEDES",
          validFrom: new Date(),
        },
      })
      await db.graphEdge.create({
        data: {
          fromRuleId: ruleB,
          toRuleId: ruleC,
          relation: "SUPERSEDES",
          validFrom: new Date(),
        },
      })

      // Check if C -> A would create a cycle
      const result = await wouldCreateCycle(ruleC, ruleA)
      assert.strictEqual(result, true, "Should detect 3-node cycle")
    })

    it("returns false for parallel edges (no cycle)", async () => {
      const ruleA = await createTestRule("parallel-a")
      const ruleB = await createTestRule("parallel-b")
      const ruleC = await createTestRule("parallel-c")

      // Create A -> B and A -> C (parallel from A)
      await db.graphEdge.create({
        data: {
          fromRuleId: ruleA,
          toRuleId: ruleB,
          relation: "SUPERSEDES",
          validFrom: new Date(),
        },
      })
      await db.graphEdge.create({
        data: {
          fromRuleId: ruleA,
          toRuleId: ruleC,
          relation: "SUPERSEDES",
          validFrom: new Date(),
        },
      })

      // B -> C should not create a cycle
      const result = await wouldCreateCycle(ruleB, ruleC)
      assert.strictEqual(result, false, "Parallel paths should not be detected as cycles")
    })

    it("respects edge type filtering", async () => {
      const ruleA = await createTestRule("typed-a")
      const ruleB = await createTestRule("typed-b")

      // Create A -> B with SUPERSEDES
      await db.graphEdge.create({
        data: {
          fromRuleId: ruleA,
          toRuleId: ruleB,
          relation: "SUPERSEDES",
          validFrom: new Date(),
        },
      })

      // Check B -> A with INTERPRETS (different type) - should not detect cycle
      // because INTERPRETS is not in the PRECEDENCE_EDGE_TYPES
      const result = await wouldCreateCycle(ruleB, ruleA, "INTERPRETS")
      assert.strictEqual(result, false, "Different edge types should not cross-detect cycles")

      // Check B -> A with SUPERSEDES - should detect cycle
      const resultSameType = await wouldCreateCycle(ruleB, ruleA, "SUPERSEDES")
      assert.strictEqual(resultSameType, true, "Same edge type should detect cycle")
    })
  })

  describe("createEdgeWithCycleCheck", () => {
    it("creates edge when no cycle exists", async () => {
      const ruleA = await createTestRule("create-safe-a")
      const ruleB = await createTestRule("create-safe-b")

      const edge = await createEdgeWithCycleCheck({
        fromRuleId: ruleA,
        toRuleId: ruleB,
        relation: "SUPERSEDES",
        validFrom: new Date(),
        notes: "Test edge",
      })

      assert.ok(edge.id, "Should create edge and return ID")

      // Verify edge exists
      const dbEdge = await db.graphEdge.findUnique({ where: { id: edge.id } })
      assert.ok(dbEdge, "Edge should exist in database")
      assert.strictEqual(dbEdge?.fromRuleId, ruleA)
      assert.strictEqual(dbEdge?.toRuleId, ruleB)
    })

    it("throws CycleDetectedError when cycle would be created", async () => {
      const ruleA = await createTestRule("create-cycle-a")
      const ruleB = await createTestRule("create-cycle-b")

      // Create A -> B first
      await createEdgeWithCycleCheck({
        fromRuleId: ruleA,
        toRuleId: ruleB,
        relation: "DEPENDS_ON",
        validFrom: new Date(),
      })

      // Try to create B -> A (would create cycle)
      try {
        await createEdgeWithCycleCheck({
          fromRuleId: ruleB,
          toRuleId: ruleA,
          relation: "DEPENDS_ON",
          validFrom: new Date(),
        })
        assert.fail("Should have thrown CycleDetectedError")
      } catch (error) {
        assert.ok(error instanceof CycleDetectedError, "Should throw CycleDetectedError")
        assert.strictEqual(error.fromId, ruleB)
        assert.strictEqual(error.toId, ruleA)
        assert.strictEqual(error.edgeType, "DEPENDS_ON")
      }

      // Verify edge was NOT created
      const badEdge = await db.graphEdge.findFirst({
        where: {
          fromRuleId: ruleB,
          toRuleId: ruleA,
          relation: "DEPENDS_ON",
        },
      })
      assert.strictEqual(badEdge, null, "Cyclic edge should not be created")
    })

    it("allows INTERPRETS edges (non-precedence) even with reverse path", async () => {
      const ruleA = await createTestRule("non-prec-a")
      const ruleB = await createTestRule("non-prec-b")

      // Create A -> B with SUPERSEDES (precedence type)
      await createEdgeWithCycleCheck({
        fromRuleId: ruleA,
        toRuleId: ruleB,
        relation: "SUPERSEDES",
        validFrom: new Date(),
      })

      // Create B -> A with INTERPRETS (non-precedence type) - should work
      const edge = await createEdgeWithCycleCheck({
        fromRuleId: ruleB,
        toRuleId: ruleA,
        relation: "INTERPRETS",
        validFrom: new Date(),
      })

      assert.ok(edge.id, "INTERPRETS edge should be created despite reverse precedence path")
    })
  })

  describe("validateGraphAcyclicity", () => {
    it("returns isValid=true for empty graph", async () => {
      // Use a unique prefix to ensure no edges
      const result = await validateGraphAcyclicity(["EXEMPTS"]) // Use unused edge type
      assert.strictEqual(result.isValid, true)
    })

    it("returns isValid=true for acyclic graph", async () => {
      const ruleA = await createTestRule("acyclic-a")
      const ruleB = await createTestRule("acyclic-b")
      const ruleC = await createTestRule("acyclic-c")

      // Create A -> B -> C (linear, no cycles)
      await db.graphEdge.create({
        data: {
          fromRuleId: ruleA,
          toRuleId: ruleB,
          relation: "REQUIRES",
          validFrom: new Date(),
        },
      })
      await db.graphEdge.create({
        data: {
          fromRuleId: ruleB,
          toRuleId: ruleC,
          relation: "REQUIRES",
          validFrom: new Date(),
        },
      })

      // Validate just REQUIRES edges for this test
      const result = await validateGraphAcyclicity(["REQUIRES"])
      assert.strictEqual(result.isValid, true, "Linear graph should be acyclic")
      assert.ok(result.nodeCount >= 3, "Should have at least 3 nodes")
      assert.ok(result.edgeCount >= 2, "Should have at least 2 edges")
    })
  })

  describe("findPath", () => {
    it("returns null when no path exists", async () => {
      const ruleA = await createTestRule("path-no-a")
      const ruleB = await createTestRule("path-no-b")

      const path = await findPath(ruleA, ruleB)
      assert.strictEqual(path, null, "Should return null when no path exists")
    })

    it("returns path when one exists", async () => {
      const ruleA = await createTestRule("path-yes-a")
      const ruleB = await createTestRule("path-yes-b")
      const ruleC = await createTestRule("path-yes-c")

      // Create A -> B -> C
      await db.graphEdge.create({
        data: {
          fromRuleId: ruleA,
          toRuleId: ruleB,
          relation: "OVERRIDES",
          validFrom: new Date(),
        },
      })
      await db.graphEdge.create({
        data: {
          fromRuleId: ruleB,
          toRuleId: ruleC,
          relation: "OVERRIDES",
          validFrom: new Date(),
        },
      })

      const path = await findPath(ruleA, ruleC, ["OVERRIDES"])
      assert.ok(path, "Should find a path")
      assert.strictEqual(path.length, 3, "Path should have 3 nodes")
      assert.strictEqual(path[0], ruleA, "Path should start at A")
      assert.strictEqual(path[1], ruleB, "Path should go through B")
      assert.strictEqual(path[2], ruleC, "Path should end at C")
    })

    it("returns self for same start and end", async () => {
      const ruleA = await createTestRule("path-self")

      const path = await findPath(ruleA, ruleA)
      assert.deepStrictEqual(path, [ruleA], "Path to self should return [self]")
    })
  })
})
