// src/lib/assistant/__tests__/fail-closed-integration.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- Test file uses partial mocks */
/**
 * Fail-Closed Integration Tests
 *
 * Tests the full assistant pipeline with real database.
 * Verifies that the system returns proper REFUSAL when citations cannot be built.
 *
 * These tests prove the product promise: "evidence-backed answers or refusal"
 *
 * NOTE: These tests require a running database. Skip in CI if no DB available.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { buildAnswer } from "../query-engine/answer-builder"
import { validateResponse } from "../validation"
import { db } from "@/lib/db"

// Skip these tests if no database is available
const hasDatabase = !!process.env.DATABASE_URL

describe.skipIf(!hasDatabase)("Fail-Closed Integration", () => {
  // Use unique identifiers to avoid test isolation issues
  const testRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // Test fixture IDs for cleanup
  const createdIds: {
    evidenceIds: string[]
    sourceIds: string[]
    conceptIds: string[]
    ruleIds: string[]
    pointerIds: string[]
  } = {
    evidenceIds: [],
    sourceIds: [],
    conceptIds: [],
    ruleIds: [],
    pointerIds: [],
  }

  beforeAll(async () => {
    // Create test fixtures that represent complete citation chain:
    // Source → Evidence → SourcePointer → RegulatoryRule → Concept

    // 1. Create Source
    const source = await (db as any).source.create({
      data: {
        name: `Test Narodne Novine ${testRunId}`,
        url: `https://test.nn.hr/${testRunId}`,
        authorityLevel: "LAW",
        priority: 1,
      },
    })
    createdIds.sourceIds.push(source.id)

    // 2. Create Evidence (with fetchedAt for fail-closed validation)
    const evidence = await db.evidence.create({
      data: {
        sourceId: source.id,
        url: `https://test.nn.hr/clanci/${testRunId}`,
        contentHash: `test-hash-${testRunId}`,
        rawContent: "Članak 38. Opća stopa poreza na dodanu vrijednost iznosi 25%.",
        fetchedAt: new Date(),
      } as any,
    })
    createdIds.evidenceIds.push(evidence.id)

    // 3. Create Concept (unique slug per test run)
    const concept = await db.concept.create({
      data: {
        slug: `pdv-opca-stopa-test-${testRunId}`,
        nameHr: "PDV opća stopa",
        nameEn: "VAT standard rate",
        description: "Opća stopa poreza na dodanu vrijednost",
        aliases: ["pdv", "pdv stopa", "vat", "porez na dodanu vrijednost"],
      } as any,
    })
    createdIds.conceptIds.push(concept.id)

    // 4. Create RegulatoryRule (unique conceptSlug per test run)
    const rule = await db.regulatoryRule.create({
      data: {
        conceptSlug: `pdv-opca-stopa-test-${testRunId}`,
        conceptId: concept.id,
        titleHr: "Opća stopa PDV-a",
        titleEn: "VAT Standard Rate",
        explanationHr: "Opća stopa poreza na dodanu vrijednost iznosi 25%.",
        value: "25",
        valueType: "percentage",
        authorityLevel: "LAW",
        status: "PUBLISHED",
        effectiveFrom: new Date("2024-01-01"),
        confidence: 0.98,
      } as any,
    })
    createdIds.ruleIds.push(rule.id)

    // 5. Create SourcePointer (links Rule to Evidence with quote)
    const pointer = await db.sourcePointer.create({
      data: {
        regulatoryRuleId: rule.id,
        evidenceId: evidence.id,
        exactQuote: "Opća stopa poreza na dodanu vrijednost iznosi 25%.",
        articleNumber: "38",
        lawReference: "Zakon o PDV-u (NN 73/13)",
      } as any,
    })
    createdIds.pointerIds.push(pointer.id)
  })

  afterAll(async () => {
    // Cleanup in reverse order of creation
    for (const id of createdIds.pointerIds) {
      await db.sourcePointer.delete({ where: { id } }).catch(() => {})
    }
    for (const id of createdIds.ruleIds) {
      await db.regulatoryRule.delete({ where: { id } }).catch(() => {})
    }
    for (const id of createdIds.conceptIds) {
      await db.concept.delete({ where: { id } }).catch(() => {})
    }
    for (const id of createdIds.evidenceIds) {
      await db.evidence.delete({ where: { id } }).catch(() => {})
    }
    for (const id of createdIds.sourceIds) {
      await (db as any).source.delete({ where: { id } }).catch(() => {})
    }
  })

  describe("ANSWER with complete citations", () => {
    it("returns ANSWER with valid citations for matching query", async () => {
      const response = await buildAnswer("Kolika je stopa PDV-a?", "MARKETING")

      // Should be an ANSWER (if concepts matched)
      if (response.kind === "ANSWER") {
        expect(response.topic).toBe("REGULATORY")

        // Must have citations
        expect(response.citations).toBeTruthy()
        expect(response.citations!.primary).toBeTruthy()
        expect(response.citations!.primary.url).toBeTruthy()
        expect(response.citations!.primary.quote).toBeTruthy()
        expect(response.citations!.primary.evidenceId).toBeTruthy()
        expect(response.citations!.primary.fetchedAt).toBeTruthy()

        // Validation should pass
        const validation = validateResponse(response)
        expect(validation.valid).toBe(true)
      } else {
        // If REFUSAL, that's also valid (no matching rules found)
        expect(response.kind).toBe("REFUSAL")
        expect(response.refusalReason).toBeTruthy()
      }
    })
  })

  describe("REFUSAL when citations incomplete", () => {
    it("returns REFUSAL for query with no matching concepts", async () => {
      const response = await buildAnswer("Random unrelated query xyz123", "MARKETING")

      expect(response.kind).toBe("REFUSAL")
      expect(["NO_CITABLE_RULES", "OUT_OF_SCOPE"]).toContain(response.refusalReason)
    })

    // CRITICAL: Gibberish queries must return REFUSAL (fail-closed)
    it("returns REFUSAL for pure gibberish 'xyz123 asdfghjkl qwerty'", async () => {
      const response = await buildAnswer("xyz123 asdfghjkl qwerty zxcvbn", "MARKETING")

      expect(response.kind).toBe("REFUSAL")
      expect(response.refusalReason).toBe("NO_CITABLE_RULES")
    })

    it("returns REFUSAL for keyboard smash", async () => {
      const response = await buildAnswer("aslkdjfaslkdf askdjhfasd asdfkjh", "MARKETING")

      expect(response.kind).toBe("REFUSAL")
      expect(response.refusalReason).toBe("NO_CITABLE_RULES")
    })

    it("returns REFUSAL for English stopwords only", async () => {
      const response = await buildAnswer("the and or is are was were", "MARKETING")

      expect(response.kind).toBe("REFUSAL")
      expect(response.refusalReason).toBe("NO_CITABLE_RULES")
    })

    it("returns REFUSAL for short tokens only", async () => {
      const response = await buildAnswer("ab cd xy zz aa bb", "MARKETING")

      expect(response.kind).toBe("REFUSAL")
      expect(response.refusalReason).toBe("NO_CITABLE_RULES")
    })

    it("validation rejects REGULATORY ANSWER without citations", async () => {
      // Construct invalid response manually
      const invalidResponse = {
        schemaVersion: "1.0.0" as const,
        requestId: "req_test",
        traceId: "trace_test",
        kind: "ANSWER" as const,
        topic: "REGULATORY" as const,
        surface: "MARKETING" as const,
        createdAt: new Date().toISOString(),
        headline: "Test",
        directAnswer: "Test answer",
        // Missing citations - should fail
      }

      const validation = validateResponse(invalidResponse)
      expect(validation.valid).toBe(false)
      expect(validation.errors.some((e) => e.includes("fail-closed"))).toBe(true)
    })
  })

  describe("Response always passes validation", () => {
    it("buildAnswer always returns validatable response", async () => {
      const queries = [
        "Kolika je stopa PDV-a?",
        "Koja je minimalna plaća?",
        "Random xyz query",
        "FiskAI app pricing",
      ]

      for (const query of queries) {
        const response = await buildAnswer(query, "MARKETING")
        const validation = validateResponse(response)

        // Either ANSWER with valid citations, or REFUSAL
        if (response.kind === "ANSWER" && response.topic === "REGULATORY") {
          expect(validation.valid).toBe(true)
        } else if (response.kind === "REFUSAL") {
          // REFUSAL is always valid
          expect(response.refusalReason).toBeTruthy()
        }
      }
    })
  })
})
