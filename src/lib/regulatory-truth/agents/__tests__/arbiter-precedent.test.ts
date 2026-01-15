// src/lib/regulatory-truth/agents/__tests__/arbiter-precedent.test.ts
//
// Tests for precedent-based conflict resolution in arbiter.ts
// Task 2.3: RTL Autonomy - Precedent-Based Conflict Resolution
//
// Before escalating to human:
// 1. Query historical resolutions for same concept + conflict type
// 2. If 3+ precedents with 70%+ agreement, auto-apply precedent
// 3. System learns from human decisions
//
// Critical safeguards (Appendix A.3):
// - Tier Gating: Precedent resolution also respects T0/T1 gating
// - Minimum Precedents: Require 3+ matching precedents
// - Agreement Threshold: Require 70%+ agreement among precedents

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the db module before importing arbiter
vi.mock("@/lib/db", () => ({
  db: {},
  dbReg: {
    conflictResolutionAudit: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { findPrecedent, type PrecedentResult } from "../arbiter"
import { dbReg } from "@/lib/db"

// =============================================================================
// TEST FIXTURES
// =============================================================================

interface MockAudit {
  id: string
  conflictId: string
  ruleAId: string | null
  ruleBId: string | null
  resolution: string
  reason: string
  resolvedBy: string
  resolvedAt: Date
  metadata: {
    conceptSlug?: string
    conflictType?: string
    resolutionStrategy?: string
  } | null
}

function createMockAudit(overrides: Partial<MockAudit> = {}): MockAudit {
  return {
    id: `audit-${Math.random().toString(36).slice(2)}`,
    conflictId: "conflict-1",
    ruleAId: "rule-a",
    ruleBId: "rule-b",
    resolution: "RULE_A_PREVAILS",
    reason: "Authority hierarchy resolution",
    resolvedBy: "ARBITER_AGENT",
    resolvedAt: new Date(),
    metadata: {
      conceptSlug: "pausalni-revenue-threshold",
      conflictType: "TEMPORAL_CONFLICT",
      resolutionStrategy: "authority_higher",
    },
    ...overrides,
  }
}

// =============================================================================
// FIND MATCHING PRECEDENTS TESTS
// =============================================================================

describe("findPrecedent - finds matching precedents by concept + conflict type", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("finds precedents matching concept slug and conflict type", async () => {
    const mockAudits = [
      createMockAudit({
        metadata: {
          conceptSlug: "pausalni-revenue-threshold",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "pausalni-revenue-threshold",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "pausalni-revenue-threshold",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("pausalni-revenue-threshold", "TEMPORAL_CONFLICT", "T2")

    expect(result.found).toBe(true)
    expect(result.precedentCount).toBe(3)
    expect(result.winnerStrategy).toBe("temporal_newer")

    // Verify the query was made with correct filters
    expect(dbReg.conflictResolutionAudit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          metadata: expect.objectContaining({
            path: ["conceptSlug"],
            equals: "pausalni-revenue-threshold",
          }),
        }),
      })
    )
  })

  it("returns not found when no matching precedents exist", async () => {
    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue([])

    const result = await findPrecedent("new-concept-slug", "SCOPE_CONFLICT", "T2")

    expect(result.found).toBe(false)
    expect(result.canAutoApply).toBe(false)
    expect(result.precedentCount).toBe(0)
    expect(result.reason).toContain("no matching precedents")
  })

  it("ignores precedents with different conflict types", async () => {
    // Only return audits matching the conflict type filter
    const mockAudits = [
      createMockAudit({
        metadata: {
          conceptSlug: "pausalni-revenue-threshold",
          conflictType: "TEMPORAL_CONFLICT", // Only matching type
          resolutionStrategy: "temporal_newer",
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("pausalni-revenue-threshold", "TEMPORAL_CONFLICT", "T2")

    // Only 1 precedent, not enough
    expect(result.found).toBe(false)
    expect(result.precedentCount).toBe(1)
  })
})

// =============================================================================
// MINIMUM PRECEDENTS TESTS (3+ required)
// =============================================================================

describe("findPrecedent - requires 3+ precedents to apply", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns not found with only 1 precedent", async () => {
    const mockAudits = [
      createMockAudit({
        metadata: {
          conceptSlug: "vat-rate-standard",
          conflictType: "INTERPRETATION_CONFLICT",
          resolutionStrategy: "authority_higher",
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("vat-rate-standard", "INTERPRETATION_CONFLICT", "T2")

    expect(result.found).toBe(false)
    expect(result.canAutoApply).toBe(false)
    expect(result.precedentCount).toBe(1)
    expect(result.reason).toContain("insufficient precedents")
  })

  it("returns not found with only 2 precedents", async () => {
    const mockAudits = [
      createMockAudit({
        metadata: {
          conceptSlug: "vat-rate-standard",
          conflictType: "INTERPRETATION_CONFLICT",
          resolutionStrategy: "authority_higher",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "vat-rate-standard",
          conflictType: "INTERPRETATION_CONFLICT",
          resolutionStrategy: "authority_higher",
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("vat-rate-standard", "INTERPRETATION_CONFLICT", "T2")

    expect(result.found).toBe(false)
    expect(result.canAutoApply).toBe(false)
    expect(result.precedentCount).toBe(2)
    expect(result.reason).toContain("insufficient precedents")
  })

  it("returns found with exactly 3 precedents", async () => {
    const mockAudits = [
      createMockAudit({
        metadata: {
          conceptSlug: "vat-rate-standard",
          conflictType: "INTERPRETATION_CONFLICT",
          resolutionStrategy: "authority_higher",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "vat-rate-standard",
          conflictType: "INTERPRETATION_CONFLICT",
          resolutionStrategy: "authority_higher",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "vat-rate-standard",
          conflictType: "INTERPRETATION_CONFLICT",
          resolutionStrategy: "authority_higher",
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("vat-rate-standard", "INTERPRETATION_CONFLICT", "T2")

    expect(result.found).toBe(true)
    expect(result.precedentCount).toBe(3)
  })

  it("returns found with more than 3 precedents", async () => {
    const mockAudits = Array.from({ length: 5 }, () =>
      createMockAudit({
        metadata: {
          conceptSlug: "vat-rate-standard",
          conflictType: "INTERPRETATION_CONFLICT",
          resolutionStrategy: "authority_higher",
        },
      })
    )

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("vat-rate-standard", "INTERPRETATION_CONFLICT", "T2")

    expect(result.found).toBe(true)
    expect(result.precedentCount).toBe(5)
  })
})

// =============================================================================
// AGREEMENT THRESHOLD TESTS (70%+ required)
// =============================================================================

describe("findPrecedent - requires 70%+ agreement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns found with 100% agreement (3/3 same strategy)", async () => {
    const mockAudits = [
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("contribution-rate", "TEMPORAL_CONFLICT", "T2")

    expect(result.found).toBe(true)
    expect(result.agreementPercentage).toBe(100)
    expect(result.winnerStrategy).toBe("temporal_newer")
  })

  it("returns found with 75% agreement (3/4 same strategy)", async () => {
    const mockAudits = [
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "authority_higher", // Different strategy
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("contribution-rate", "TEMPORAL_CONFLICT", "T2")

    expect(result.found).toBe(true)
    expect(result.agreementPercentage).toBe(75)
    expect(result.winnerStrategy).toBe("temporal_newer")
  })

  it("returns found with exactly 70% agreement (7/10 same strategy)", async () => {
    const mockAudits = [
      ...Array.from({ length: 7 }, () =>
        createMockAudit({
          metadata: {
            conceptSlug: "contribution-rate",
            conflictType: "TEMPORAL_CONFLICT",
            resolutionStrategy: "temporal_newer",
          },
        })
      ),
      ...Array.from({ length: 3 }, () =>
        createMockAudit({
          metadata: {
            conceptSlug: "contribution-rate",
            conflictType: "TEMPORAL_CONFLICT",
            resolutionStrategy: "authority_higher",
          },
        })
      ),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("contribution-rate", "TEMPORAL_CONFLICT", "T2")

    expect(result.found).toBe(true)
    expect(result.agreementPercentage).toBe(70)
    expect(result.winnerStrategy).toBe("temporal_newer")
  })

  it("returns not found with 66% agreement (2/3 same strategy)", async () => {
    const mockAudits = [
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "authority_higher", // Different
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("contribution-rate", "TEMPORAL_CONFLICT", "T2")

    expect(result.found).toBe(false)
    expect(result.canAutoApply).toBe(false)
    expect(result.agreementPercentage).toBeCloseTo(66.67, 0)
    expect(result.reason).toContain("insufficient agreement")
  })

  it("returns not found with 50% agreement (2/4 same strategy)", async () => {
    const mockAudits = [
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "authority_higher",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "contribution-rate",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "source_higher",
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("contribution-rate", "TEMPORAL_CONFLICT", "T2")

    expect(result.found).toBe(false)
    expect(result.agreementPercentage).toBe(50)
    expect(result.reason).toContain("insufficient agreement")
  })
})

// =============================================================================
// TIER GATING TESTS - T0/T1 NEVER AUTO-APPLIED
// =============================================================================

describe("findPrecedent - respects T0/T1 tier gating", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("T0 rules get recommendation only (canAutoApply=false)", async () => {
    const mockAudits = Array.from({ length: 5 }, () =>
      createMockAudit({
        metadata: {
          conceptSlug: "constitutional-right",
          conflictType: "INTERPRETATION_CONFLICT",
          resolutionStrategy: "authority_higher",
        },
      })
    )

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent(
      "constitutional-right",
      "INTERPRETATION_CONFLICT",
      "T0" // High-risk tier
    )

    expect(result.found).toBe(true)
    expect(result.canAutoApply).toBe(false) // Cannot auto-apply for T0
    expect(result.winnerStrategy).toBe("authority_higher") // Still provides recommendation
    expect(result.reason).toContain("T0")
  })

  it("T1 rules get recommendation only (canAutoApply=false)", async () => {
    const mockAudits = Array.from({ length: 4 }, () =>
      createMockAudit({
        metadata: {
          conceptSlug: "primary-tax-obligation",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      })
    )

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent(
      "primary-tax-obligation",
      "TEMPORAL_CONFLICT",
      "T1" // High-risk tier
    )

    expect(result.found).toBe(true)
    expect(result.canAutoApply).toBe(false) // Cannot auto-apply for T1
    expect(result.winnerStrategy).toBe("temporal_newer")
    expect(result.reason).toContain("T1")
  })

  it("T2 rules can auto-apply precedent", async () => {
    const mockAudits = Array.from({ length: 3 }, () =>
      createMockAudit({
        metadata: {
          conceptSlug: "administrative-procedure",
          conflictType: "SCOPE_CONFLICT",
          resolutionStrategy: "source_higher",
        },
      })
    )

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("administrative-procedure", "SCOPE_CONFLICT", "T2")

    expect(result.found).toBe(true)
    expect(result.canAutoApply).toBe(true) // Can auto-apply for T2
    expect(result.winnerStrategy).toBe("source_higher")
  })

  it("T3 rules can auto-apply precedent", async () => {
    const mockAudits = Array.from({ length: 3 }, () =>
      createMockAudit({
        metadata: {
          conceptSlug: "internal-practice",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      })
    )

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("internal-practice", "TEMPORAL_CONFLICT", "T3")

    expect(result.found).toBe(true)
    expect(result.canAutoApply).toBe(true) // Can auto-apply for T3
  })
})

// =============================================================================
// AUDIT TRAIL TESTS
// =============================================================================

describe("findPrecedent - creates audit trail for precedent-based resolutions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("includes precedent count in result", async () => {
    const mockAudits = Array.from({ length: 7 }, () =>
      createMockAudit({
        metadata: {
          conceptSlug: "test-concept",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      })
    )

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("test-concept", "TEMPORAL_CONFLICT", "T2")

    expect(result.precedentCount).toBe(7)
  })

  it("includes agreement percentage in result", async () => {
    const mockAudits = [
      ...Array.from({ length: 4 }, () =>
        createMockAudit({
          metadata: {
            conceptSlug: "test-concept",
            conflictType: "TEMPORAL_CONFLICT",
            resolutionStrategy: "temporal_newer",
          },
        })
      ),
      createMockAudit({
        metadata: {
          conceptSlug: "test-concept",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "authority_higher",
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("test-concept", "TEMPORAL_CONFLICT", "T2")

    expect(result.agreementPercentage).toBe(80)
  })

  it("includes winning strategy in result", async () => {
    const mockAudits = Array.from({ length: 3 }, () =>
      createMockAudit({
        metadata: {
          conceptSlug: "test-concept",
          conflictType: "SCOPE_CONFLICT",
          resolutionStrategy: "source_higher",
        },
      })
    )

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("test-concept", "SCOPE_CONFLICT", "T2")

    expect(result.winnerStrategy).toBe("source_higher")
  })

  it("includes reason explaining the precedent lookup result", async () => {
    const mockAudits = Array.from({ length: 5 }, () =>
      createMockAudit({
        metadata: {
          conceptSlug: "test-concept",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      })
    )

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("test-concept", "TEMPORAL_CONFLICT", "T2")

    expect(result.reason).toBeDefined()
    expect(result.reason.length).toBeGreaterThan(0)
    // Should mention precedent-based resolution
    expect(result.reason.toLowerCase()).toMatch(/precedent|historical/)
  })

  it("result is complete and type-safe", async () => {
    const mockAudits = Array.from({ length: 3 }, () =>
      createMockAudit({
        metadata: {
          conceptSlug: "test-concept",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      })
    )

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result: PrecedentResult = await findPrecedent("test-concept", "TEMPORAL_CONFLICT", "T2")

    // Type-safe: all required fields present
    expect(typeof result.found).toBe("boolean")
    expect(typeof result.canAutoApply).toBe("boolean")
    expect(typeof result.reason).toBe("string")

    if (result.found) {
      expect(typeof result.winnerStrategy).toBe("string")
      expect(typeof result.precedentCount).toBe("number")
      expect(typeof result.agreementPercentage).toBe("number")
    }
  })
})

// =============================================================================
// EDGE CASES
// =============================================================================

describe("findPrecedent - edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("handles audits with missing metadata gracefully", async () => {
    const mockAudits = [
      createMockAudit({ metadata: null }),
      createMockAudit({
        metadata: {
          conceptSlug: "test-concept",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    // Should not throw
    const result = await findPrecedent("test-concept", "TEMPORAL_CONFLICT", "T2")

    expect(result).toBeDefined()
    expect(typeof result.found).toBe("boolean")
  })

  it("handles audits with missing resolutionStrategy gracefully", async () => {
    const mockAudits = [
      createMockAudit({
        metadata: {
          conceptSlug: "test-concept",
          conflictType: "TEMPORAL_CONFLICT",
          // Missing resolutionStrategy
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "test-concept",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    // Should not throw
    const result = await findPrecedent("test-concept", "TEMPORAL_CONFLICT", "T2")

    expect(result).toBeDefined()
  })

  it("handles database errors gracefully", async () => {
    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockRejectedValue(
      new Error("Database connection failed")
    )

    // Should not throw, should return not found with error reason
    const result = await findPrecedent("test-concept", "TEMPORAL_CONFLICT", "T2")

    expect(result.found).toBe(false)
    expect(result.canAutoApply).toBe(false)
    expect(result.reason).toContain("error")
  })

  it("handles empty concept slug", async () => {
    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue([])

    const result = await findPrecedent("", "TEMPORAL_CONFLICT", "T2")

    expect(result.found).toBe(false)
    expect(result.precedentCount).toBe(0)
  })

  it("treats resolution strategies case-insensitively when counting", async () => {
    // This tests that "TEMPORAL_NEWER" and "temporal_newer" are counted as the same
    const mockAudits = [
      createMockAudit({
        metadata: {
          conceptSlug: "test-concept",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "temporal_newer",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "test-concept",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "TEMPORAL_NEWER",
        },
      }),
      createMockAudit({
        metadata: {
          conceptSlug: "test-concept",
          conflictType: "TEMPORAL_CONFLICT",
          resolutionStrategy: "Temporal_Newer",
        },
      }),
    ]

    vi.mocked(dbReg.conflictResolutionAudit.findMany).mockResolvedValue(mockAudits)

    const result = await findPrecedent("test-concept", "TEMPORAL_CONFLICT", "T2")

    // All 3 should be counted as the same strategy
    expect(result.found).toBe(true)
    expect(result.agreementPercentage).toBe(100)
  })
})
