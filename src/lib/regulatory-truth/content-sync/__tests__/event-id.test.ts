// src/lib/regulatory-truth/content-sync/__tests__/event-id.test.ts
import { describe, it, expect } from "vitest"
import {
  generateEventId,
  hashSourcePointerIds,
  determineSeverity,
  buildEventSignature,
} from "../event-id"
import type { ContentSyncEventSignature } from "../types"
import type { RiskTier } from "../../schemas/common"
import type { ChangeType } from "../types"

describe("hashSourcePointerIds", () => {
  it("should produce deterministic hash for same IDs", () => {
    const ids = ["ptr-1", "ptr-2", "ptr-3"]
    const hash1 = hashSourcePointerIds(ids)
    const hash2 = hashSourcePointerIds(ids)

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // sha256 produces 64 hex chars
  })

  it("should be order-independent", () => {
    const ids1 = ["ptr-1", "ptr-2", "ptr-3"]
    const ids2 = ["ptr-3", "ptr-1", "ptr-2"]
    const ids3 = ["ptr-2", "ptr-3", "ptr-1"]

    const hash1 = hashSourcePointerIds(ids1)
    const hash2 = hashSourcePointerIds(ids2)
    const hash3 = hashSourcePointerIds(ids3)

    expect(hash1).toBe(hash2)
    expect(hash2).toBe(hash3)
  })

  it("should produce different hashes for different IDs", () => {
    const hash1 = hashSourcePointerIds(["ptr-1", "ptr-2"])
    const hash2 = hashSourcePointerIds(["ptr-1", "ptr-3"])
    const hash3 = hashSourcePointerIds(["ptr-1"])

    expect(hash1).not.toBe(hash2)
    expect(hash1).not.toBe(hash3)
    expect(hash2).not.toBe(hash3)
  })

  it("should handle empty array", () => {
    const hash = hashSourcePointerIds([])
    expect(hash).toHaveLength(64)
  })

  it("should handle single ID", () => {
    const hash = hashSourcePointerIds(["single-ptr"])
    expect(hash).toHaveLength(64)
  })

  it("should not mutate original array", () => {
    const ids = ["ptr-3", "ptr-1", "ptr-2"]
    const original = [...ids]
    hashSourcePointerIds(ids)
    expect(ids).toEqual(original)
  })
})

describe("generateEventId", () => {
  const baseSignature: ContentSyncEventSignature = {
    ruleId: "rule-123",
    conceptId: "pdv-threshold",
    type: "RULE_RELEASED",
    effectiveFrom: "2024-01-01",
    sourcePointerIdsHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
  }

  it("should produce deterministic ID for same signature", () => {
    const id1 = generateEventId(baseSignature)
    const id2 = generateEventId(baseSignature)

    expect(id1).toBe(id2)
    expect(id1).toHaveLength(64)
  })

  it("should produce different IDs for different ruleIds", () => {
    const sig1 = { ...baseSignature, ruleId: "rule-123" }
    const sig2 = { ...baseSignature, ruleId: "rule-456" }

    expect(generateEventId(sig1)).not.toBe(generateEventId(sig2))
  })

  it("should produce different IDs for different conceptIds", () => {
    const sig1 = { ...baseSignature, conceptId: "pdv-threshold" }
    const sig2 = { ...baseSignature, conceptId: "pausalni-limit" }

    expect(generateEventId(sig1)).not.toBe(generateEventId(sig2))
  })

  it("should produce different IDs for different types", () => {
    const sig1: ContentSyncEventSignature = {
      ...baseSignature,
      type: "RULE_RELEASED",
    }
    const sig2: ContentSyncEventSignature = {
      ...baseSignature,
      type: "RULE_SUPERSEDED",
    }

    expect(generateEventId(sig1)).not.toBe(generateEventId(sig2))
  })

  it("should produce different IDs for different effectiveFrom dates", () => {
    const sig1 = { ...baseSignature, effectiveFrom: "2024-01-01" }
    const sig2 = { ...baseSignature, effectiveFrom: "2024-07-01" }

    expect(generateEventId(sig1)).not.toBe(generateEventId(sig2))
  })

  it("should produce different IDs for different sourcePointerIdsHash", () => {
    const sig1 = {
      ...baseSignature,
      sourcePointerIdsHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
    }
    const sig2 = {
      ...baseSignature,
      sourcePointerIdsHash: "xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyz789xyz7",
    }

    expect(generateEventId(sig1)).not.toBe(generateEventId(sig2))
  })

  it("should produce different IDs when newValue is present vs absent", () => {
    const sig1 = { ...baseSignature }
    const sig2 = { ...baseSignature, newValue: "10000 EUR" }

    expect(generateEventId(sig1)).not.toBe(generateEventId(sig2))
  })

  it("should produce different IDs for different newValue values", () => {
    const sig1 = { ...baseSignature, newValue: "10000 EUR" }
    const sig2 = { ...baseSignature, newValue: "15000 EUR" }

    expect(generateEventId(sig1)).not.toBe(generateEventId(sig2))
  })

  it("should handle all event types", () => {
    const types = [
      "RULE_RELEASED",
      "RULE_SUPERSEDED",
      "RULE_EFFECTIVE",
      "SOURCE_CHANGED",
      "POINTERS_CHANGED",
      "CONFIDENCE_DROPPED",
    ] as const

    const ids = types.map((type) => generateEventId({ ...baseSignature, type }))

    // All IDs should be unique
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(types.length)
  })
})

describe("determineSeverity", () => {
  describe("repeal change type", () => {
    it("should return breaking for T0 repeal", () => {
      expect(determineSeverity("T0", "repeal")).toBe("breaking")
    })

    it("should return breaking for T1 repeal", () => {
      expect(determineSeverity("T1", "repeal")).toBe("breaking")
    })

    it("should return breaking for T2 repeal", () => {
      expect(determineSeverity("T2", "repeal")).toBe("breaking")
    })

    it("should return breaking for T3 repeal", () => {
      expect(determineSeverity("T3", "repeal")).toBe("breaking")
    })
  })

  describe("T0 tier", () => {
    it("should return breaking for T0 create", () => {
      expect(determineSeverity("T0", "create")).toBe("breaking")
    })

    it("should return breaking for T0 update", () => {
      expect(determineSeverity("T0", "update")).toBe("breaking")
    })
  })

  describe("T1 tier", () => {
    it("should return major for T1 create", () => {
      expect(determineSeverity("T1", "create")).toBe("major")
    })

    it("should return major for T1 update", () => {
      expect(determineSeverity("T1", "update")).toBe("major")
    })
  })

  describe("T2 tier", () => {
    it("should return minor for T2 create", () => {
      expect(determineSeverity("T2", "create")).toBe("minor")
    })

    it("should return minor for T2 update", () => {
      expect(determineSeverity("T2", "update")).toBe("minor")
    })
  })

  describe("T3 tier", () => {
    it("should return info for T3 create", () => {
      expect(determineSeverity("T3", "create")).toBe("info")
    })

    it("should return info for T3 update", () => {
      expect(determineSeverity("T3", "update")).toBe("info")
    })
  })

  describe("all combinations", () => {
    it("should cover all tier/changeType combinations", () => {
      const tiers: RiskTier[] = ["T0", "T1", "T2", "T3"]
      const changeTypes: ChangeType[] = ["create", "update", "repeal"]

      const expectedResults: Record<RiskTier, Record<ChangeType, string>> = {
        T0: { create: "breaking", update: "breaking", repeal: "breaking" },
        T1: { create: "major", update: "major", repeal: "breaking" },
        T2: { create: "minor", update: "minor", repeal: "breaking" },
        T3: { create: "info", update: "info", repeal: "breaking" },
      }

      for (const tier of tiers) {
        for (const changeType of changeTypes) {
          expect(determineSeverity(tier, changeType)).toBe(expectedResults[tier][changeType])
        }
      }
    })
  })
})

describe("buildEventSignature", () => {
  it("should build a complete signature from parameters", () => {
    const signature = buildEventSignature({
      ruleId: "rule-123",
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED",
      effectiveFrom: "2024-01-01",
      sourcePointerIds: ["ptr-1", "ptr-2"],
    })

    expect(signature.ruleId).toBe("rule-123")
    expect(signature.conceptId).toBe("pdv-threshold")
    expect(signature.type).toBe("RULE_RELEASED")
    expect(signature.effectiveFrom).toBe("2024-01-01")
    expect(signature.sourcePointerIdsHash).toHaveLength(64)
    expect(signature.newValue).toBeUndefined()
  })

  it("should include newValue when provided", () => {
    const signature = buildEventSignature({
      ruleId: "rule-123",
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED",
      effectiveFrom: "2024-01-01",
      sourcePointerIds: ["ptr-1"],
      newValue: "10000 EUR",
    })

    expect(signature.newValue).toBe("10000 EUR")
  })

  it("should compute sourcePointerIdsHash from provided IDs", () => {
    const signature1 = buildEventSignature({
      ruleId: "rule-123",
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED",
      effectiveFrom: "2024-01-01",
      sourcePointerIds: ["ptr-1", "ptr-2", "ptr-3"],
    })

    const signature2 = buildEventSignature({
      ruleId: "rule-123",
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED",
      effectiveFrom: "2024-01-01",
      sourcePointerIds: ["ptr-3", "ptr-1", "ptr-2"], // Different order
    })

    // Should produce same hash due to sorting
    expect(signature1.sourcePointerIdsHash).toBe(signature2.sourcePointerIdsHash)
  })

  it("should produce deterministic signatures", () => {
    const params = {
      ruleId: "rule-123",
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED" as const,
      effectiveFrom: "2024-01-01",
      sourcePointerIds: ["ptr-1", "ptr-2"],
      newValue: "10000 EUR",
    }

    const sig1 = buildEventSignature(params)
    const sig2 = buildEventSignature(params)

    expect(generateEventId(sig1)).toBe(generateEventId(sig2))
  })
})

describe("end-to-end determinism", () => {
  it("should produce same event ID from same input data", () => {
    const sourcePointerIds = ["ptr-a", "ptr-b", "ptr-c"]

    // Simulate building event twice with same data
    const signature1 = buildEventSignature({
      ruleId: "rule-pdv-2024",
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED",
      effectiveFrom: "2024-01-01",
      sourcePointerIds: sourcePointerIds,
      newValue: "40000 EUR",
    })

    const signature2 = buildEventSignature({
      ruleId: "rule-pdv-2024",
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED",
      effectiveFrom: "2024-01-01",
      sourcePointerIds: [...sourcePointerIds].reverse(), // Different order
      newValue: "40000 EUR",
    })

    const id1 = generateEventId(signature1)
    const id2 = generateEventId(signature2)

    expect(id1).toBe(id2)
  })

  it("should produce different event IDs for different effective dates", () => {
    const baseParams = {
      ruleId: "rule-pdv-2024",
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED" as const,
      sourcePointerIds: ["ptr-a"],
      newValue: "40000 EUR",
    }

    const sig1 = buildEventSignature({ ...baseParams, effectiveFrom: "2024-01-01" })
    const sig2 = buildEventSignature({ ...baseParams, effectiveFrom: "2024-07-01" })

    expect(generateEventId(sig1)).not.toBe(generateEventId(sig2))
  })
})
