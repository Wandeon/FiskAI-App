// src/lib/regulatory-truth/__tests__/fetcher-lifecycle.test.ts
// Tests for fetcher lifecycle invariant:
// Fetchers create DRAFT rules only - approval and publication happen via pipeline/service.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { db } from "@/lib/db"
import { createHNBRules, type HNBExchangeRate } from "../fetchers/hnb-fetcher"

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: {
    regulatorySource: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    evidence: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    sourcePointer: {
      create: vi.fn(),
    },
    concept: {
      upsert: vi.fn(),
    },
    regulatoryRule: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

// Mock fetch for HNB API
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock audit log
vi.mock("../utils/audit-log", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

// Mock content hash
vi.mock("../utils/content-hash", () => ({
  hashContent: vi.fn().mockReturnValue("test-hash-123"),
}))

describe("Fetcher Lifecycle Invariants", () => {
  const mockRate: HNBExchangeRate = {
    broj_tecajnice: "123",
    datum_primjene: "2024-12-28",
    drzava: "SAD",
    drzava_iso: "US",
    valuta: "USD",
    sifra_valute: "840",
    kupovni_tecaj: "7,40",
    prodajni_tecaj: "7,46",
    srednji_tecaj: "7,43",
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockRate]),
    })

    vi.mocked(db.regulatorySource.findFirst).mockResolvedValue({
      id: "source-1",
      slug: "hnb",
      name: "HNB",
      url: "https://hnb.hr",
      hierarchy: 3,
      isActive: true,
      fetchIntervalHours: 24,
      lastFetchedAt: null,
      lastContentHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(db.evidence.findFirst).mockResolvedValue(null) // No existing evidence
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.evidence.create).mockResolvedValue({
      id: "evidence-1",
      sourceId: "source-1",
      url: "https://api.hnb.hr/test",
      rawContent: JSON.stringify(mockRate),
      contentHash: "test-hash",
      contentType: "json",
      hasChanged: false,
      changeSummary: null,
      fetchedAt: new Date(),
      deletedAt: null,
      contentClass: "JSON",
      ocrMetadata: null,
      primaryTextArtifactId: null,
    } as any)

    vi.mocked(db.sourcePointer.create).mockResolvedValue({
      id: "pointer-1",
      evidenceId: "evidence-1",
      domain: "exchange-rate",
      valueType: "decimal",
      extractedValue: "7,43",
      displayValue: "7,43 USD/EUR",
      exactQuote: '"srednji_tecaj":"7,43"',
      contextBefore: null,
      contextAfter: null,
      selector: null,
      articleNumber: null,
      paragraphNumber: null,
      lawReference: null,
      confidence: 1.0,
      extractionNotes: null,
      createdAt: new Date(),
      deletedAt: null,
      startOffset: 100,
      endOffset: 120,
      matchType: "EXACT",
    })

    vi.mocked(db.concept.upsert).mockResolvedValue({
      id: "concept-1",
      slug: "exchange-rate-eur-usd",
      nameHr: "Tečaj EUR/USD",
      nameEn: "Exchange Rate EUR/USD",
      aliases: [],
      tags: ["exchange-rate", "hnb", "usd"],
      description: null,
      parentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.regulatoryRule.create).mockResolvedValue({
      id: "rule-1",
      conceptId: "concept-1",
      conceptSlug: "exchange-rate-eur-usd",
      titleHr: "Test rule",
      titleEn: "Test rule",
      riskTier: "T0",
      authorityLevel: "LAW",
      automationPolicy: "ALLOW",
      ruleStability: "STABLE",
      obligationType: "OBLIGATION",
      appliesWhen: "{}",
      value: "7.43",
      valueType: "decimal",
      outcome: "Test",
      explanationHr: "Test",
      explanationEn: "Test",
      effectiveFrom: new Date(),
      effectiveUntil: null,
      supersedesId: null,
      confidence: 1.0,
      status: "DRAFT",
      composerNotes: null,
      reviewerNotes: null,
      approvedBy: null,
      approvedAt: null,
      meaningSignature: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("HNB Fetcher creates DRAFT only", () => {
    it("creates rules with DRAFT status", async () => {
      const result = await createHNBRules(new Date("2024-12-28"))

      expect(result.success).toBe(true)
      expect(result.rulesCreated).toBe(1)

      // Verify rule was created with DRAFT status
      expect(db.regulatoryRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "DRAFT",
          }),
        })
      )
    })

    it("does NOT set approvedBy or approvedAt", async () => {
      await createHNBRules(new Date("2024-12-28"))

      const createCall = vi.mocked(db.regulatoryRule.create).mock.calls[0][0]

      // Should not have approval fields set
      expect(createCall.data).not.toHaveProperty("approvedBy")
      expect(createCall.data).not.toHaveProperty("approvedAt")
    })

    it("returns rule IDs for pipeline processing", async () => {
      const result = await createHNBRules(new Date("2024-12-28"))

      expect(result.ruleIds).toEqual(["rule-1"])
      expect(result.ruleIds.length).toBe(result.rulesCreated)
    })

    it("does NOT call any status update methods", async () => {
      await createHNBRules(new Date("2024-12-28"))

      // Should NOT update rules after creation
      expect(db.regulatoryRule.update).not.toHaveBeenCalled()
      expect(db.regulatoryRule.updateMany).not.toHaveBeenCalled()
    })

    it("logs audit event with awaitingPipeline=true", async () => {
      const { logAuditEvent } = await import("../utils/audit-log")

      await createHNBRules(new Date("2024-12-28"))

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "RULE_CREATED",
          entityType: "RULE",
          metadata: expect.objectContaining({
            status: "DRAFT",
            awaitingPipeline: true,
          }),
        })
      )
    })
  })

  describe("SourcePointer provenance at creation", () => {
    it("creates SourcePointer with offsets for Tier 1 data", async () => {
      await createHNBRules(new Date("2024-12-28"))

      expect(db.sourcePointer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startOffset: expect.any(Number),
            endOffset: expect.any(Number),
            matchType: "EXACT",
          }),
        })
      )
    })

    it("uses exactQuote that exists in rawContent", async () => {
      await createHNBRules(new Date("2024-12-28"))

      const createCall = vi.mocked(db.sourcePointer.create).mock.calls[0][0]
      const exactQuote = createCall.data.exactQuote as string

      // The exactQuote should be a JSON key-value pair that exists in the rawContent
      const rawContent = JSON.stringify(mockRate)
      expect(rawContent).toContain(exactQuote)
    })

    it("sets 100% confidence for Tier 1 structured data", async () => {
      await createHNBRules(new Date("2024-12-28"))

      expect(db.sourcePointer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            confidence: 1.0,
          }),
        })
      )
    })
  })

  describe("Lifecycle invariant enforcement", () => {
    it("INVARIANT: Fetchers never create APPROVED rules", async () => {
      await createHNBRules(new Date("2024-12-28"))

      const createCall = vi.mocked(db.regulatoryRule.create).mock.calls[0][0]

      // This is the core invariant - fetchers create DRAFT only
      expect(createCall.data.status).toBe("DRAFT")
      expect(createCall.data.status).not.toBe("APPROVED")
      expect(createCall.data.status).not.toBe("PUBLISHED")
      expect(createCall.data.status).not.toBe("PENDING_REVIEW")
    })

    it("INVARIANT: Fetchers never directly publish", async () => {
      await createHNBRules(new Date("2024-12-28"))

      // No update calls at all - fetcher only creates
      expect(db.regulatoryRule.update).not.toHaveBeenCalled()
      expect(db.regulatoryRule.updateMany).not.toHaveBeenCalled()
    })

    it("INVARIANT: Rule IDs are returned for pipeline", async () => {
      const result = await createHNBRules(new Date("2024-12-28"))

      // Fetcher must return rule IDs so pipeline can process them
      expect(Array.isArray(result.ruleIds)).toBe(true)
      expect(result.ruleIds.length).toBeGreaterThan(0)
    })
  })
})
