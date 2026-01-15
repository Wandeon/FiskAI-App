// src/lib/regulatory-truth/agents/__tests__/arbiter-deterministic.test.ts
//
// Tests for deterministic conflict pre-resolution in arbiter.ts
// Task 1.3: RTL Autonomy - Deterministic Conflict Pre-Resolution
//
// Resolution hierarchy:
// 1. Authority hierarchy (LAW > GUIDANCE > PROCEDURE > PRACTICE)
// 2. Source hierarchy (Constitution > Law > Regulation > Guidance)
// 3. Temporal (newer effective date wins if dates differ)
//
// Critical safeguards:
// - T0/T1 rules NEVER auto-resolved (recommendation only)
// - Only T2/T3 rules can be auto-resolved
// - Audit trail for all resolutions

import { describe, it, expect, vi } from "vitest"

// Mock the db module before importing arbiter (which transitively imports db)
vi.mock("@/lib/db", () => ({
  db: {},
  dbReg: {},
}))

import {
  tryDeterministicResolution,
  type DeterministicResolution,
  type RuleForResolution,
} from "../arbiter"

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTestRule(overrides: Partial<RuleForResolution> = {}): RuleForResolution {
  return {
    id: "rule-default",
    riskTier: "T2",
    authorityLevel: "GUIDANCE",
    effectiveFrom: new Date("2024-01-01"),
    sourceHierarchy: 5, // Default: Uputa (Instruction)
    ...overrides,
  }
}

// =============================================================================
// AUTHORITY HIERARCHY TESTS
// =============================================================================

describe("tryDeterministicResolution - authority hierarchy", () => {
  it("resolves by authority hierarchy (LAW beats GUIDANCE)", () => {
    const ruleA = createTestRule({
      id: "rule-law",
      riskTier: "T2",
      authorityLevel: "LAW",
    })
    const ruleB = createTestRule({
      id: "rule-guidance",
      riskTier: "T2",
      authorityLevel: "GUIDANCE",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.winner).toBe("rule-law")
    expect(result.loser).toBe("rule-guidance")
    expect(result.recommendationOnly).toBe(false)
    expect(result.reason).toContain("authority")
  })

  it("resolves by authority hierarchy (GUIDANCE beats PROCEDURE)", () => {
    const ruleA = createTestRule({
      id: "rule-guidance",
      riskTier: "T3",
      authorityLevel: "GUIDANCE",
    })
    const ruleB = createTestRule({
      id: "rule-procedure",
      riskTier: "T3",
      authorityLevel: "PROCEDURE",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.winner).toBe("rule-guidance")
    expect(result.loser).toBe("rule-procedure")
    expect(result.recommendationOnly).toBe(false)
  })

  it("resolves by authority hierarchy (PROCEDURE beats PRACTICE)", () => {
    const ruleA = createTestRule({
      id: "rule-practice",
      riskTier: "T2",
      authorityLevel: "PRACTICE",
    })
    const ruleB = createTestRule({
      id: "rule-procedure",
      riskTier: "T2",
      authorityLevel: "PROCEDURE",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.winner).toBe("rule-procedure")
    expect(result.loser).toBe("rule-practice")
    expect(result.recommendationOnly).toBe(false)
  })

  it("resolves correctly regardless of argument order", () => {
    const ruleA = createTestRule({
      id: "rule-guidance",
      riskTier: "T2",
      authorityLevel: "GUIDANCE",
    })
    const ruleB = createTestRule({
      id: "rule-law",
      riskTier: "T2",
      authorityLevel: "LAW",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.winner).toBe("rule-law")
    expect(result.loser).toBe("rule-guidance")
  })
})

// =============================================================================
// SOURCE HIERARCHY TESTS
// =============================================================================

describe("tryDeterministicResolution - source hierarchy", () => {
  it("resolves by source hierarchy (Constitution beats Regulation)", () => {
    // When authority levels are equal, fall back to source hierarchy
    const ruleA = createTestRule({
      id: "rule-constitution",
      riskTier: "T2",
      authorityLevel: "LAW",
      sourceHierarchy: 1, // Ustav (Constitution)
    })
    const ruleB = createTestRule({
      id: "rule-regulation",
      riskTier: "T2",
      authorityLevel: "LAW",
      sourceHierarchy: 3, // Podzakonski akt (Regulation)
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.winner).toBe("rule-constitution")
    expect(result.loser).toBe("rule-regulation")
    expect(result.reason).toContain("source")
  })

  it("resolves by source hierarchy (Law beats Ordinance)", () => {
    const ruleA = createTestRule({
      id: "rule-zakon",
      riskTier: "T3",
      authorityLevel: "LAW",
      sourceHierarchy: 2, // Zakon (Law)
    })
    const ruleB = createTestRule({
      id: "rule-pravilnik",
      riskTier: "T3",
      authorityLevel: "LAW",
      sourceHierarchy: 4, // Pravilnik (Ordinance)
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.winner).toBe("rule-zakon")
    expect(result.loser).toBe("rule-pravilnik")
  })

  it("resolves by source hierarchy (Instruction beats Opinion)", () => {
    const ruleA = createTestRule({
      id: "rule-uputa",
      riskTier: "T2",
      authorityLevel: "GUIDANCE",
      sourceHierarchy: 5, // Uputa (Instruction)
    })
    const ruleB = createTestRule({
      id: "rule-misljenje",
      riskTier: "T2",
      authorityLevel: "GUIDANCE",
      sourceHierarchy: 6, // Misljenje (Opinion)
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.winner).toBe("rule-uputa")
    expect(result.loser).toBe("rule-misljenje")
  })
})

// =============================================================================
// TEMPORAL RESOLUTION TESTS
// =============================================================================

describe("tryDeterministicResolution - temporal (lex posterior)", () => {
  it("resolves by temporal (newer beats older) when authority and source are equal", () => {
    const ruleA = createTestRule({
      id: "rule-old",
      riskTier: "T2",
      authorityLevel: "GUIDANCE",
      sourceHierarchy: 5,
      effectiveFrom: new Date("2023-01-01"),
    })
    const ruleB = createTestRule({
      id: "rule-new",
      riskTier: "T2",
      authorityLevel: "GUIDANCE",
      sourceHierarchy: 5,
      effectiveFrom: new Date("2024-06-15"),
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.winner).toBe("rule-new")
    expect(result.loser).toBe("rule-old")
    expect(result.reason).toContain("temporal")
  })

  it("returns unresolved when all criteria are equal", () => {
    const ruleA = createTestRule({
      id: "rule-a",
      riskTier: "T2",
      authorityLevel: "GUIDANCE",
      sourceHierarchy: 5,
      effectiveFrom: new Date("2024-01-01"),
    })
    const ruleB = createTestRule({
      id: "rule-b",
      riskTier: "T2",
      authorityLevel: "GUIDANCE",
      sourceHierarchy: 5,
      effectiveFrom: new Date("2024-01-01"),
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(false)
    expect(result.winner).toBeUndefined()
    expect(result.loser).toBeUndefined()
    expect(result.reason).toContain("unresolved")
  })
})

// =============================================================================
// TIER GATING TESTS - T0/T1 NEVER AUTO-RESOLVED
// =============================================================================

describe("tryDeterministicResolution - tier gating (T0/T1 protection)", () => {
  it("T0 rules NEVER auto-resolved - produces recommendation only", () => {
    const ruleA = createTestRule({
      id: "rule-t0-law",
      riskTier: "T0", // Constitutional/fundamental rights
      authorityLevel: "LAW",
    })
    const ruleB = createTestRule({
      id: "rule-t0-guidance",
      riskTier: "T0",
      authorityLevel: "GUIDANCE",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    // Can still determine a winner, but MUST be recommendation only
    expect(result.recommendationOnly).toBe(true)
    expect(result.reason).toContain("T0")

    // Should still provide winner/loser for human to approve
    if (result.resolved) {
      expect(result.winner).toBe("rule-t0-law")
      expect(result.loser).toBe("rule-t0-guidance")
    }
  })

  it("T1 rules NEVER auto-resolved - produces recommendation only", () => {
    const ruleA = createTestRule({
      id: "rule-t1-law",
      riskTier: "T1", // Primary tax law
      authorityLevel: "LAW",
      sourceHierarchy: 2,
    })
    const ruleB = createTestRule({
      id: "rule-t1-guidance",
      riskTier: "T1",
      authorityLevel: "GUIDANCE",
      sourceHierarchy: 5,
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.recommendationOnly).toBe(true)
    expect(result.reason).toContain("T1")
  })

  it("T0 vs T1 conflict - produces recommendation only (highest tier wins)", () => {
    const ruleA = createTestRule({
      id: "rule-t0",
      riskTier: "T0",
      authorityLevel: "GUIDANCE",
    })
    const ruleB = createTestRule({
      id: "rule-t1",
      riskTier: "T1",
      authorityLevel: "LAW",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    // Either T0 or T1 present = recommendation only
    expect(result.recommendationOnly).toBe(true)
  })

  it("T0 vs T2 conflict - produces recommendation only (T0 protection)", () => {
    const ruleA = createTestRule({
      id: "rule-t0",
      riskTier: "T0",
      authorityLevel: "LAW",
    })
    const ruleB = createTestRule({
      id: "rule-t2",
      riskTier: "T2",
      authorityLevel: "PRACTICE",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.recommendationOnly).toBe(true)
  })

  it("T1 vs T3 conflict - produces recommendation only (T1 protection)", () => {
    const ruleA = createTestRule({
      id: "rule-t1",
      riskTier: "T1",
      authorityLevel: "LAW",
    })
    const ruleB = createTestRule({
      id: "rule-t3",
      riskTier: "T3",
      authorityLevel: "PRACTICE",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.recommendationOnly).toBe(true)
  })
})

// =============================================================================
// AUTO-RESOLUTION TESTS - T2/T3 CAN BE AUTO-RESOLVED
// =============================================================================

describe("tryDeterministicResolution - T2/T3 auto-resolution", () => {
  it("T2 vs T2 rules can be auto-resolved", () => {
    const ruleA = createTestRule({
      id: "rule-t2-law",
      riskTier: "T2",
      authorityLevel: "LAW",
    })
    const ruleB = createTestRule({
      id: "rule-t2-practice",
      riskTier: "T2",
      authorityLevel: "PRACTICE",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.recommendationOnly).toBe(false)
    expect(result.winner).toBe("rule-t2-law")
  })

  it("T3 vs T3 rules can be auto-resolved", () => {
    const ruleA = createTestRule({
      id: "rule-t3-guidance",
      riskTier: "T3",
      authorityLevel: "GUIDANCE",
    })
    const ruleB = createTestRule({
      id: "rule-t3-procedure",
      riskTier: "T3",
      authorityLevel: "PROCEDURE",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.recommendationOnly).toBe(false)
    expect(result.winner).toBe("rule-t3-guidance")
  })

  it("T2 vs T3 rules can be auto-resolved", () => {
    const ruleA = createTestRule({
      id: "rule-t2",
      riskTier: "T2",
      authorityLevel: "GUIDANCE",
    })
    const ruleB = createTestRule({
      id: "rule-t3",
      riskTier: "T3",
      authorityLevel: "GUIDANCE",
      effectiveFrom: new Date("2024-06-01"),
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    // Both are low-risk, so auto-resolution is allowed
    expect(result.recommendationOnly).toBe(false)
  })
})

// =============================================================================
// AUDIT TRAIL TESTS
// =============================================================================

describe("tryDeterministicResolution - audit trail", () => {
  it("includes reason string explaining resolution", () => {
    const ruleA = createTestRule({
      id: "rule-law",
      riskTier: "T2",
      authorityLevel: "LAW",
    })
    const ruleB = createTestRule({
      id: "rule-practice",
      riskTier: "T2",
      authorityLevel: "PRACTICE",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.reason).toBeDefined()
    expect(result.reason.length).toBeGreaterThan(10)
    // Should explain WHY the resolution was made
    expect(result.reason).toMatch(/authority|LAW|PRACTICE/i)
  })

  it("includes reason for recommendation-only resolutions", () => {
    const ruleA = createTestRule({
      id: "rule-t0-a",
      riskTier: "T0",
      authorityLevel: "LAW",
    })
    const ruleB = createTestRule({
      id: "rule-t0-b",
      riskTier: "T0",
      authorityLevel: "GUIDANCE",
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.reason).toBeDefined()
    expect(result.reason).toContain("T0")
    expect(result.reason).toContain("recommendation")
  })

  it("includes reason for unresolved conflicts", () => {
    const ruleA = createTestRule({
      id: "rule-a",
      riskTier: "T2",
      authorityLevel: "GUIDANCE",
      sourceHierarchy: 5,
      effectiveFrom: new Date("2024-01-01"),
    })
    const ruleB = createTestRule({
      id: "rule-b",
      riskTier: "T2",
      authorityLevel: "GUIDANCE",
      sourceHierarchy: 5,
      effectiveFrom: new Date("2024-01-01"),
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(false)
    expect(result.reason).toBeDefined()
    expect(result.reason).toContain("unresolved")
  })

  it("resolution result is complete and type-safe", () => {
    const ruleA = createTestRule({
      id: "rule-a",
      riskTier: "T2",
      authorityLevel: "LAW",
    })
    const ruleB = createTestRule({
      id: "rule-b",
      riskTier: "T2",
      authorityLevel: "PRACTICE",
    })

    const result: DeterministicResolution = tryDeterministicResolution(ruleA, ruleB)

    // Type-safe: all required fields present
    expect(typeof result.resolved).toBe("boolean")
    expect(typeof result.reason).toBe("string")
    expect(typeof result.recommendationOnly).toBe("boolean")

    if (result.resolved) {
      expect(typeof result.winner).toBe("string")
      expect(typeof result.loser).toBe("string")
    }
  })
})

// =============================================================================
// EDGE CASES
// =============================================================================

describe("tryDeterministicResolution - edge cases", () => {
  it("handles null/undefined sourceHierarchy gracefully", () => {
    const ruleA = createTestRule({
      id: "rule-a",
      riskTier: "T2",
      authorityLevel: "LAW",
      sourceHierarchy: undefined as unknown as number,
    })
    const ruleB = createTestRule({
      id: "rule-b",
      riskTier: "T2",
      authorityLevel: "LAW",
      sourceHierarchy: 3,
    })

    // Should not throw, should handle gracefully
    const result = tryDeterministicResolution(ruleA, ruleB)
    expect(result).toBeDefined()
    expect(typeof result.resolved).toBe("boolean")
  })

  it("handles same rule IDs (edge case)", () => {
    const rule = createTestRule({
      id: "same-rule",
      riskTier: "T2",
      authorityLevel: "LAW",
    })

    const result = tryDeterministicResolution(rule, rule)

    // Same rule cannot conflict with itself meaningfully
    expect(result.resolved).toBe(false)
    expect(result.reason).toContain("same")
  })

  it("authority resolution takes precedence over source hierarchy", () => {
    // Even if source hierarchy favors ruleB, authority level should win
    const ruleA = createTestRule({
      id: "rule-law-low-source",
      riskTier: "T2",
      authorityLevel: "LAW",
      sourceHierarchy: 7, // Low source hierarchy (Practice)
    })
    const ruleB = createTestRule({
      id: "rule-practice-high-source",
      riskTier: "T2",
      authorityLevel: "PRACTICE",
      sourceHierarchy: 1, // High source hierarchy (Constitution)
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.winner).toBe("rule-law-low-source")
    expect(result.reason).toContain("authority")
  })

  it("source hierarchy resolution takes precedence over temporal", () => {
    // Even if temporal favors ruleA, source hierarchy should win
    const ruleA = createTestRule({
      id: "rule-new-low-source",
      riskTier: "T2",
      authorityLevel: "LAW",
      sourceHierarchy: 6, // Lower source hierarchy
      effectiveFrom: new Date("2025-01-01"), // Newer
    })
    const ruleB = createTestRule({
      id: "rule-old-high-source",
      riskTier: "T2",
      authorityLevel: "LAW",
      sourceHierarchy: 2, // Higher source hierarchy
      effectiveFrom: new Date("2020-01-01"), // Older
    })

    const result = tryDeterministicResolution(ruleA, ruleB)

    expect(result.resolved).toBe(true)
    expect(result.winner).toBe("rule-old-high-source")
    expect(result.reason).toContain("source")
  })
})
