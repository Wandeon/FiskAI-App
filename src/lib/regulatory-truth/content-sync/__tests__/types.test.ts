// src/lib/regulatory-truth/content-sync/__tests__/types.test.ts
import { describe, it, expect } from "vitest"
import {
  mapRtlDomainToContentDomain,
  isContentSyncEventV1,
  type ContentSyncEventV1,
} from "../types"

describe("mapRtlDomainToContentDomain", () => {
  describe("tax domain mappings", () => {
    it("should map pausalni to tax", () => {
      expect(mapRtlDomainToContentDomain("pausalni")).toBe("tax")
    })

    it("should map pdv to tax", () => {
      expect(mapRtlDomainToContentDomain("pdv")).toBe("tax")
    })

    it("should map porez_dohodak to tax", () => {
      expect(mapRtlDomainToContentDomain("porez_dohodak")).toBe("tax")
    })

    it("should map doprinosi to tax", () => {
      expect(mapRtlDomainToContentDomain("doprinosi")).toBe("tax")
    })
  })

  describe("fiscal domain mappings", () => {
    it("should map fiskalizacija to fiscal", () => {
      expect(mapRtlDomainToContentDomain("fiskalizacija")).toBe("fiscal")
    })
  })

  describe("compliance domain mappings", () => {
    it("should map rokovi to compliance", () => {
      expect(mapRtlDomainToContentDomain("rokovi")).toBe("compliance")
    })

    it("should map obrasci to compliance", () => {
      expect(mapRtlDomainToContentDomain("obrasci")).toBe("compliance")
    })
  })

  describe("business domain mappings", () => {
    it("should map obrt to business", () => {
      expect(mapRtlDomainToContentDomain("obrt")).toBe("business")
    })

    it("should map doo to business", () => {
      expect(mapRtlDomainToContentDomain("doo")).toBe("business")
    })

    it("should map jdoo to business", () => {
      expect(mapRtlDomainToContentDomain("jdoo")).toBe("business")
    })
  })

  describe("unknown domain handling", () => {
    it("should return compliance for unknown domains", () => {
      expect(mapRtlDomainToContentDomain("unknown")).toBe("compliance")
    })

    it("should return compliance for empty string", () => {
      expect(mapRtlDomainToContentDomain("")).toBe("compliance")
    })
  })
})

describe("isContentSyncEventV1", () => {
  const validEvent: ContentSyncEventV1 = {
    version: 1,
    id: "abc123def456",
    timestamp: "2024-01-01T00:00:00Z",
    type: "RULE_RELEASED",
    ruleId: "rule-123",
    conceptId: "pdv-threshold",
    domain: "tax",
    changeType: "update",
    effectiveFrom: "2024-01-01",
    sourcePointerIds: ["ptr-1", "ptr-2"],
    confidenceLevel: 95,
    severity: "major",
    signature: {
      ruleId: "rule-123",
      conceptId: "pdv-threshold",
      type: "RULE_RELEASED",
      effectiveFrom: "2024-01-01",
      sourcePointerIdsHash: "hash123",
    },
  }

  it("should return true for valid event", () => {
    expect(isContentSyncEventV1(validEvent)).toBe(true)
  })

  it("should return true for event with optional fields", () => {
    const eventWithOptional: ContentSyncEventV1 = {
      ...validEvent,
      previousValue: "30000 EUR",
      newValue: "40000 EUR",
      valueType: "currency",
      evidenceIds: ["ev-1"],
      primarySourceUrl: "https://example.com",
    }
    expect(isContentSyncEventV1(eventWithOptional)).toBe(true)
  })

  it("should return false for null", () => {
    expect(isContentSyncEventV1(null)).toBe(false)
  })

  it("should return false for undefined", () => {
    expect(isContentSyncEventV1(undefined)).toBe(false)
  })

  it("should return false for non-object", () => {
    expect(isContentSyncEventV1("string")).toBe(false)
    expect(isContentSyncEventV1(123)).toBe(false)
    expect(isContentSyncEventV1([])).toBe(false)
  })

  it("should return false for wrong version", () => {
    const invalidVersion = { ...validEvent, version: 2 }
    expect(isContentSyncEventV1(invalidVersion)).toBe(false)
  })

  it("should return false for missing id", () => {
    const { id, ...noId } = validEvent
    expect(isContentSyncEventV1(noId)).toBe(false)
  })

  it("should return false for missing timestamp", () => {
    const { timestamp, ...noTimestamp } = validEvent
    expect(isContentSyncEventV1(noTimestamp)).toBe(false)
  })

  it("should return false for missing type", () => {
    const { type, ...noType } = validEvent
    expect(isContentSyncEventV1(noType)).toBe(false)
  })

  it("should return false for missing ruleId", () => {
    const { ruleId, ...noRuleId } = validEvent
    expect(isContentSyncEventV1(noRuleId)).toBe(false)
  })

  it("should return false for missing conceptId", () => {
    const { conceptId, ...noConceptId } = validEvent
    expect(isContentSyncEventV1(noConceptId)).toBe(false)
  })

  it("should return false for missing domain", () => {
    const { domain, ...noDomain } = validEvent
    expect(isContentSyncEventV1(noDomain)).toBe(false)
  })

  it("should return false for missing changeType", () => {
    const { changeType, ...noChangeType } = validEvent
    expect(isContentSyncEventV1(noChangeType)).toBe(false)
  })

  it("should return false for missing effectiveFrom", () => {
    const { effectiveFrom, ...noEffectiveFrom } = validEvent
    expect(isContentSyncEventV1(noEffectiveFrom)).toBe(false)
  })

  it("should return false for missing sourcePointerIds", () => {
    const { sourcePointerIds, ...noSourcePointerIds } = validEvent
    expect(isContentSyncEventV1(noSourcePointerIds)).toBe(false)
  })

  it("should return false for non-array sourcePointerIds", () => {
    const invalidSourcePointerIds = {
      ...validEvent,
      sourcePointerIds: "not-an-array",
    }
    expect(isContentSyncEventV1(invalidSourcePointerIds)).toBe(false)
  })

  it("should return false for missing confidenceLevel", () => {
    const { confidenceLevel, ...noConfidenceLevel } = validEvent
    expect(isContentSyncEventV1(noConfidenceLevel)).toBe(false)
  })

  it("should return false for non-number confidenceLevel", () => {
    const invalidConfidence = { ...validEvent, confidenceLevel: "95" }
    expect(isContentSyncEventV1(invalidConfidence)).toBe(false)
  })

  it("should return false for missing severity", () => {
    const { severity, ...noSeverity } = validEvent
    expect(isContentSyncEventV1(noSeverity)).toBe(false)
  })

  it("should return false for missing signature", () => {
    const { signature, ...noSignature } = validEvent
    expect(isContentSyncEventV1(noSignature)).toBe(false)
  })

  it("should return false for non-object signature", () => {
    const invalidSignature = { ...validEvent, signature: "not-an-object" }
    expect(isContentSyncEventV1(invalidSignature)).toBe(false)
  })
})
