// src/lib/regulatory-truth/utils/__tests__/instrument-resolver.test.ts
/**
 * Tests for Instrument Resolution Utilities
 *
 * Tests verify:
 * 1. Identity merge behavior - ELI and NN key resolve to same record
 * 2. Idempotent creation - same inputs produce same outputs
 * 3. canonicalId correctness - eliUri takes precedence
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  resolveOrCreateInstrument,
  generateNNCanonicalKey,
  parseNNCanonicalKey,
  canConsolidate,
} from "../instrument-resolver"

// =============================================================================
// Mock Database
// =============================================================================

interface MockInstrument {
  id: string
  canonicalId: string
  eliUri: string | null
  nnCanonicalKey: string | null
  title: string
  shortTitle: string | null
  status: string
  hasBaselineText: boolean
  coverageStartType: string
}

class MockInstrumentDb {
  instruments: Map<string, MockInstrument> = new Map()
  private counter = 0

  reset(): void {
    this.instruments.clear()
    this.counter = 0
  }

  findByEli(eliUri: string): MockInstrument | null {
    for (const inst of this.instruments.values()) {
      if (inst.eliUri === eliUri) return inst
    }
    return null
  }

  findByNnKey(nnKey: string): MockInstrument | null {
    for (const inst of this.instruments.values()) {
      if (inst.nnCanonicalKey === nnKey) return inst
    }
    return null
  }

  create(data: Partial<MockInstrument>): MockInstrument {
    const id = `inst-${++this.counter}`
    const instrument: MockInstrument = {
      id,
      canonicalId: data.canonicalId!,
      eliUri: data.eliUri || null,
      nnCanonicalKey: data.nnCanonicalKey || null,
      title: data.title || "Unknown",
      shortTitle: data.shortTitle || null,
      status: data.status || "DELTA_ONLY",
      hasBaselineText: data.hasBaselineText || false,
      coverageStartType: data.coverageStartType || "UNKNOWN",
    }
    this.instruments.set(id, instrument)
    return instrument
  }

  update(id: string, data: Partial<MockInstrument>): MockInstrument | null {
    const existing = this.instruments.get(id)
    if (!existing) return null
    Object.assign(existing, data)
    return existing
  }
}

const mockDb = new MockInstrumentDb()

// Mock the database module
vi.mock("@/lib/db", () => ({
  dbReg: {
    instrument: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.eliUri) return mockDb.findByEli(where.eliUri)
        if (where.nnCanonicalKey) return mockDb.findByNnKey(where.nnCanonicalKey)
        return null
      }),
      create: vi.fn(async ({ data }) => mockDb.create(data)),
      update: vi.fn(async ({ where, data }) => mockDb.update(where.id, data)),
    },
  },
}))

// =============================================================================
// Helper Function Tests
// =============================================================================

describe("generateNNCanonicalKey", () => {
  it("generates correct format", () => {
    expect(generateNNCanonicalKey(2024, 152, 2505)).toBe("nn:2024:152:2505")
    expect(generateNNCanonicalKey(2013, 1, 1)).toBe("nn:2013:1:1")
  })
})

describe("parseNNCanonicalKey", () => {
  it("parses valid keys", () => {
    expect(parseNNCanonicalKey("nn:2024:152:2505")).toEqual({
      year: 2024,
      issue: 152,
      item: 2505,
    })
  })

  it("returns null for invalid keys", () => {
    expect(parseNNCanonicalKey("invalid")).toBeNull()
    expect(parseNNCanonicalKey("nn:2024:152")).toBeNull()
    expect(parseNNCanonicalKey("eli:hr:zakon:2024")).toBeNull()
  })
})

describe("canConsolidate", () => {
  it("returns true for BASELINED and CONSOLIDATED_AVAILABLE", () => {
    expect(canConsolidate("BASELINED")).toBe(true)
    expect(canConsolidate("CONSOLIDATED_AVAILABLE")).toBe(true)
  })

  it("returns false for DELTA_ONLY", () => {
    expect(canConsolidate("DELTA_ONLY")).toBe(false)
  })
})

// =============================================================================
// Resolution Tests
// =============================================================================

describe("resolveOrCreateInstrument", () => {
  beforeEach(() => {
    mockDb.reset()
  })

  it("throws if neither identity provided", async () => {
    await expect(resolveOrCreateInstrument({})).rejects.toThrow(
      "at least one of eliUri or nnCanonicalKey required"
    )
  })

  it("creates new instrument with ELI only", async () => {
    const result = await resolveOrCreateInstrument({
      eliUri: "eli/hr/zakon/2024/152/2505",
      title: "Zakon o porezu na dobit",
    })

    expect(result.wasCreated).toBe(true)
    expect(result.wasMerged).toBe(false)
    expect(result.canonicalId).toBe("eli/hr/zakon/2024/152/2505")
    expect(result.eliUri).toBe("eli/hr/zakon/2024/152/2505")
    expect(result.nnCanonicalKey).toBeNull()
  })

  it("creates new instrument with NN key only", async () => {
    const result = await resolveOrCreateInstrument({
      nnCanonicalKey: "nn:2024:152:2505",
      title: "Zakon o porezu na dobit",
    })

    expect(result.wasCreated).toBe(true)
    expect(result.wasMerged).toBe(false)
    expect(result.canonicalId).toBe("nn:2024:152:2505")
    expect(result.nnCanonicalKey).toBe("nn:2024:152:2505")
    expect(result.eliUri).toBeNull()
  })

  it("creates new instrument with both identities", async () => {
    const result = await resolveOrCreateInstrument({
      eliUri: "eli/hr/zakon/2024/152/2505",
      nnCanonicalKey: "nn:2024:152:2505",
      title: "Zakon o porezu na dobit",
    })

    expect(result.wasCreated).toBe(true)
    expect(result.canonicalId).toBe("eli/hr/zakon/2024/152/2505") // ELI preferred
    expect(result.eliUri).toBe("eli/hr/zakon/2024/152/2505")
    expect(result.nnCanonicalKey).toBe("nn:2024:152:2505")
  })

  it("returns existing instrument found by ELI", async () => {
    // Create first
    const first = await resolveOrCreateInstrument({
      eliUri: "eli/hr/zakon/2024/152/2505",
      title: "Zakon o porezu na dobit",
    })

    // Resolve same ELI again
    const second = await resolveOrCreateInstrument({
      eliUri: "eli/hr/zakon/2024/152/2505",
    })

    expect(second.wasCreated).toBe(false)
    expect(second.wasMerged).toBe(false)
    expect(second.id).toBe(first.id)
  })

  it("returns existing instrument found by NN key", async () => {
    // Create first
    const first = await resolveOrCreateInstrument({
      nnCanonicalKey: "nn:2024:152:2505",
      title: "Zakon o porezu na dobit",
    })

    // Resolve same NN key again
    const second = await resolveOrCreateInstrument({
      nnCanonicalKey: "nn:2024:152:2505",
    })

    expect(second.wasCreated).toBe(false)
    expect(second.id).toBe(first.id)
  })

  // KEY TEST: Identity Merge Behavior
  it("merges NN key into existing ELI-only instrument", async () => {
    // Create with ELI only
    const first = await resolveOrCreateInstrument({
      eliUri: "eli/hr/zakon/2024/152/2505",
      title: "Zakon o porezu na dobit",
    })
    expect(first.nnCanonicalKey).toBeNull()

    // Resolve with both identities - should merge
    const second = await resolveOrCreateInstrument({
      eliUri: "eli/hr/zakon/2024/152/2505",
      nnCanonicalKey: "nn:2024:152:2505",
    })

    expect(second.wasCreated).toBe(false)
    expect(second.wasMerged).toBe(true)
    expect(second.id).toBe(first.id)
    expect(second.nnCanonicalKey).toBe("nn:2024:152:2505")
    expect(second.eliUri).toBe("eli/hr/zakon/2024/152/2505")
  })

  // KEY TEST: ELI Discovery for Existing NN-keyed Instrument
  it("merges ELI into existing NN-only instrument and upgrades canonicalId", async () => {
    // Create with NN key only
    const first = await resolveOrCreateInstrument({
      nnCanonicalKey: "nn:2024:152:2505",
      title: "Zakon o porezu na dobit",
    })
    expect(first.eliUri).toBeNull()
    expect(first.canonicalId).toBe("nn:2024:152:2505")

    // Later, discover ELI for same instrument
    const second = await resolveOrCreateInstrument({
      eliUri: "eli/hr/zakon/2024/152/2505",
      nnCanonicalKey: "nn:2024:152:2505",
    })

    expect(second.wasCreated).toBe(false)
    expect(second.wasMerged).toBe(true)
    expect(second.id).toBe(first.id)
    expect(second.eliUri).toBe("eli/hr/zakon/2024/152/2505")
    expect(second.canonicalId).toBe("eli/hr/zakon/2024/152/2505") // Upgraded
  })

  it("handles idempotent calls with same inputs", async () => {
    const input = {
      eliUri: "eli/hr/zakon/2024/152/2505",
      nnCanonicalKey: "nn:2024:152:2505",
      title: "Zakon o porezu na dobit",
    }

    const first = await resolveOrCreateInstrument(input)
    const second = await resolveOrCreateInstrument(input)
    const third = await resolveOrCreateInstrument(input)

    expect(first.id).toBe(second.id)
    expect(second.id).toBe(third.id)
    expect(first.wasCreated).toBe(true)
    expect(second.wasCreated).toBe(false)
    expect(third.wasCreated).toBe(false)
  })

  it("sets CONSOLIDATED_AVAILABLE status for consolidated text type", async () => {
    const result = await resolveOrCreateInstrument({
      nnCanonicalKey: "nn:2024:152:2505",
      title: "Zakon o radu - pročišćeni tekst",
      textType: "CONSOLIDATED",
    })

    expect(result.status).toBe("CONSOLIDATED_AVAILABLE")
  })

  it("sets DELTA_ONLY status for amendment text type", async () => {
    const result = await resolveOrCreateInstrument({
      nnCanonicalKey: "nn:2024:152:2505",
      title: "Zakon o izmjenama Zakona o radu",
      textType: "AMENDMENT",
    })

    expect(result.status).toBe("DELTA_ONLY")
  })
})
