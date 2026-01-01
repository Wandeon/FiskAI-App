// src/lib/regulatory-truth/__tests__/conflict-detector.test.ts
import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { db } from "@/lib/db"
import { detectStructuralConflicts, seedConflicts } from "../utils/conflict-detector"

describe("conflict-detector", () => {
  let testConceptSlug: string
  let existingRuleId: string
  let newRuleId: string

  before(async () => {
    testConceptSlug = `test-concept-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Create an existing published rule (without concept FK for simplicity)
    const existingRule = await db.regulatoryRule.create({
      data: {
        conceptSlug: testConceptSlug,
        titleHr: "Existing Rule",
        titleEn: "Existing Rule",
        riskTier: "T2",
        authorityLevel: "GUIDANCE",
        appliesWhen: JSON.stringify({ op: "true" }),
        value: "25",
        valueType: "percentage",
        effectiveFrom: new Date("2024-01-01"),
        effectiveUntil: new Date("2024-12-31"),
        status: "PUBLISHED",
        confidence: 0.95,
      },
    })
    existingRuleId = existingRule.id

    // Create a new rule for testing
    const newRule = await db.regulatoryRule.create({
      data: {
        conceptSlug: testConceptSlug,
        titleHr: "New Rule",
        titleEn: "New Rule",
        riskTier: "T2",
        authorityLevel: "LAW",
        appliesWhen: JSON.stringify({ op: "true" }),
        value: "30",
        valueType: "percentage",
        effectiveFrom: new Date("2024-06-01"),
        effectiveUntil: new Date("2025-06-01"),
        status: "DRAFT",
        confidence: 0.9,
      },
    })
    newRuleId = newRule.id
  })

  after(async () => {
    // Cleanup: delete conflicts first (due to FK constraints)
    await db.regulatoryConflict.deleteMany({
      where: {
        OR: [{ itemAId: existingRuleId }, { itemBId: existingRuleId }],
      },
    })

    // Delete test rules
    await db.regulatoryRule.deleteMany({
      where: { conceptSlug: testConceptSlug },
    })
  })

  describe("detectStructuralConflicts", () => {
    it("detects VALUE_MISMATCH for same concept with different values and overlapping dates", async () => {
      const conflicts = await detectStructuralConflicts({
        id: newRuleId,
        conceptSlug: testConceptSlug,
        value: "30",
        effectiveFrom: new Date("2024-06-01"),
        effectiveUntil: new Date("2025-06-01"),
        authorityLevel: "LAW",
        articleNumber: null,
      })

      assert.ok(conflicts.length > 0, "Should detect at least one conflict")
      const valueMismatch = conflicts.find((c) => c.type === "VALUE_MISMATCH")
      assert.ok(valueMismatch, "Should detect VALUE_MISMATCH")
      assert.strictEqual(valueMismatch.existingRuleId, existingRuleId)
      assert.strictEqual(valueMismatch.newRuleId, newRuleId)
      assert.ok(valueMismatch.reason.includes("different values"))
    })

    it("detects AUTHORITY_SUPERSEDE when new rule has higher authority", async () => {
      const conflicts = await detectStructuralConflicts({
        id: newRuleId,
        conceptSlug: testConceptSlug,
        value: "30",
        effectiveFrom: new Date("2024-06-01"),
        effectiveUntil: new Date("2025-06-01"),
        authorityLevel: "LAW", // Higher authority than existing GUIDANCE
        articleNumber: null,
      })

      const authConflict = conflicts.find((c) => c.type === "AUTHORITY_SUPERSEDE")
      assert.ok(authConflict, "Should detect AUTHORITY_SUPERSEDE")
      assert.ok(authConflict.reason.includes("higher authority"))
    })

    it("does not detect conflict when dates do not overlap", async () => {
      // Create a rule with non-overlapping dates
      const futureRule = await db.regulatoryRule.create({
        data: {
          conceptSlug: testConceptSlug,
          titleHr: "Future Rule",
          titleEn: "Future Rule",
          riskTier: "T2",
          authorityLevel: "GUIDANCE",
          appliesWhen: JSON.stringify({ op: "true" }),
          value: "35",
          valueType: "percentage",
          effectiveFrom: new Date("2026-01-01"),
          effectiveUntil: new Date("2026-12-31"),
          status: "DRAFT",
          confidence: 0.9,
        },
      })

      const conflicts = await detectStructuralConflicts({
        id: futureRule.id,
        conceptSlug: testConceptSlug,
        value: "35",
        effectiveFrom: new Date("2026-01-01"),
        effectiveUntil: new Date("2026-12-31"),
        authorityLevel: "GUIDANCE",
        articleNumber: null,
      })

      // Should only detect authority conflicts, not value mismatches
      const valueMismatch = conflicts.find(
        (c) => c.type === "VALUE_MISMATCH" && c.existingRuleId === existingRuleId
      )
      assert.strictEqual(
        valueMismatch,
        undefined,
        "Should not detect VALUE_MISMATCH for non-overlapping dates"
      )

      // Cleanup
      await db.regulatoryRule.delete({ where: { id: futureRule.id } })
    })

    it("does not detect conflict when values are the same", async () => {
      const sameValueRule = await db.regulatoryRule.create({
        data: {
          conceptSlug: testConceptSlug,
          titleHr: "Same Value Rule",
          titleEn: "Same Value Rule",
          riskTier: "T2",
          authorityLevel: "GUIDANCE",
          appliesWhen: JSON.stringify({ op: "true" }),
          value: "25", // Same as existing rule
          valueType: "percentage",
          effectiveFrom: new Date("2024-06-01"),
          effectiveUntil: new Date("2024-12-31"),
          status: "DRAFT",
          confidence: 0.9,
        },
      })

      const conflicts = await detectStructuralConflicts({
        id: sameValueRule.id,
        conceptSlug: testConceptSlug,
        value: "25",
        effectiveFrom: new Date("2024-06-01"),
        effectiveUntil: new Date("2024-12-31"),
        authorityLevel: "GUIDANCE",
        articleNumber: null,
      })

      const valueMismatch = conflicts.find((c) => c.type === "VALUE_MISMATCH")
      assert.strictEqual(
        valueMismatch,
        undefined,
        "Should not detect VALUE_MISMATCH for same value"
      )

      // Cleanup
      await db.regulatoryRule.delete({ where: { id: sameValueRule.id } })
    })
  })

  describe("seedConflicts", () => {
    it("creates conflict records in database", async () => {
      const conflicts = [
        {
          type: "VALUE_MISMATCH" as const,
          existingRuleId,
          newRuleId,
          reason: "Test conflict",
        },
      ]

      const created = await seedConflicts(conflicts)
      assert.strictEqual(created, 1, "Should create 1 conflict")

      const dbConflict = await db.regulatoryConflict.findFirst({
        where: {
          itemAId: existingRuleId,
          itemBId: newRuleId,
        },
      })

      assert.ok(dbConflict, "Conflict should exist in database")
      assert.strictEqual(dbConflict.conflictType, "SOURCE_CONFLICT")
      assert.strictEqual(dbConflict.status, "OPEN")
      assert.ok(dbConflict.description.includes("Test conflict"))
    })

    it("does not create duplicate conflicts", async () => {
      const conflicts = [
        {
          type: "VALUE_MISMATCH" as const,
          existingRuleId,
          newRuleId,
          reason: "Test conflict",
        },
      ]

      // First seed
      await seedConflicts(conflicts)

      // Second seed should not create duplicates
      const created = await seedConflicts(conflicts)
      assert.strictEqual(created, 0, "Should not create duplicate conflict")

      // Count conflicts in database
      const count = await db.regulatoryConflict.count({
        where: {
          itemAId: existingRuleId,
          itemBId: newRuleId,
          status: "OPEN",
        },
      })

      assert.strictEqual(count, 1, "Should only have 1 conflict in database")
    })
  })
})
