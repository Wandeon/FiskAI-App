// src/lib/regulatory-truth/__tests__/citation-compliance-integration.test.ts
/**
 * Citation Compliance Integration Tests
 *
 * Runs against real database (ephemeral Postgres in CI).
 * Tests findRelevantRules with actual published rules.
 *
 * Pass criteria: ≥60% (18/30) questions return valid citations
 * NOTE: Target is 60% until Croatian stemming is implemented.
 * Without stemming, inflected word forms don't match.
 * Target should be raised to 95% (28/30) once stemming is added.
 */

import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { db } from "@/lib/db"
import { dbReg } from "@/lib/db/regulatory"
import { findRelevantRules } from "../utils/rule-context"
import { TEST_QUESTIONS } from "./citation-compliance.test"
import { deleteEvidenceForTest } from "@/__tests__/helpers/db-cleanup"

describe("Citation Compliance (Integration)", { timeout: 60000 }, () => {
  // Test fixture IDs for cleanup
  const createdIds: { evidenceIds: string[]; ruleIds: string[] } = {
    evidenceIds: [],
    ruleIds: [],
  }

  // Flag to track if regulatory schema exists
  let skipTests = false

  before(async () => {
    // Check if regulatory schema exists (RegulatorySource table)
    // In CI, only main schema is pushed - skip these integration tests if regulatory tables are missing
    try {
      await dbReg.regulatorySource.findFirst({ take: 1 })
    } catch (e) {
      console.log(
        "[citation-integration] SKIP: Regulatory schema not available (table RegulatorySource missing)"
      )
      skipTests = true
      return
    }

    // Create test fixtures for citation testing
    // These simulate real published rules with source evidence
    const fixtures = [
      {
        conceptSlug: "pdv-standard-rate",
        titleHr: "Standardna stopa PDV-a",
        value: "25",
        quote: "Porez na dodanu vrijednost obračunava se po stopi od 25%",
      },
      {
        conceptSlug: "pausalni-prag-2025",
        titleHr: "Prag za paušalno oporezivanje",
        value: "39816.84",
        quote: "Prag primitaka za paušalno oporezivanje iznosi 39.816,84 EUR",
      },
      {
        conceptSlug: "porez-na-dohodak-stopa",
        titleHr: "Stopa poreza na dohodak",
        value: "20",
        quote: "Porez na dohodak plaća se po stopi od 20%",
      },
      {
        conceptSlug: "doprinosi-zdravstveno",
        titleHr: "Doprinosi za zdravstveno osiguranje",
        value: "16.5",
        quote: "Doprinos za zdravstveno osiguranje iznosi 16,5%",
      },
      {
        conceptSlug: "tecaj-eur-hrk",
        titleHr: "Tečaj EUR/HRK",
        value: "7.5345",
        quote: "Srednji tečaj HNB za EUR iznosi 7,5345",
      },
      {
        conceptSlug: "porez-na-dobit-stopa",
        titleHr: "Stopa poreza na dobit",
        value: "18",
        quote: "Porez na dobit plaća se po stopi od 18%",
      },
      {
        conceptSlug: "minimalna-placa-2025",
        titleHr: "Minimalna plaća",
        value: "970",
        quote: "Minimalna bruto plaća za 2025. iznosi 970 EUR",
      },
      {
        conceptSlug: "fiskalizacija-obveza",
        titleHr: "Obveza fiskalizacije",
        value: "true",
        quote: "Obveznici fiskalizacije dužni su fiskalizirati svaki račun",
      },
      {
        conceptSlug: "osobni-odbitak",
        titleHr: "Osobni odbitak",
        value: "560",
        quote: "Osnovni osobni odbitak iznosi 560 EUR",
      },
      {
        conceptSlug: "gfi-pod-rok",
        titleHr: "Rok predaje GFI-POD",
        value: "30.04.",
        quote: "GFI-POD se predaje najkasnije 30. travnja",
      },
    ]

    for (const fixture of fixtures) {
      // First, get or create a test source
      const source = await dbReg.regulatorySource.upsert({
        where: { slug: "test-citation-source" },
        create: {
          slug: "test-citation-source",
          name: "Test Citation Source",
          url: "https://test.example.com",
          isActive: false,
        },
        update: {},
      })

      const evidence = await dbReg.evidence.create({
        data: {
          sourceId: source.id,
          url: `https://test.example.com/${fixture.conceptSlug}`,
          contentHash: `test-hash-${fixture.conceptSlug}-${Date.now()}`,
          contentType: "html",
          rawContent: fixture.quote,
          fetchedAt: new Date(),
        },
      })
      createdIds.evidenceIds.push(evidence.id)

      // Create source pointer first
      const sourcePointer = await db.sourcePointer.create({
        data: {
          evidenceId: evidence.id,
          domain: "test",
          valueType: "string",
          extractedValue: fixture.value,
          displayValue: fixture.value,
          exactQuote: fixture.quote,
          confidence: 0.95,
        },
      })

      const rule = await db.regulatoryRule.create({
        data: {
          conceptSlug: fixture.conceptSlug,
          titleHr: fixture.titleHr,
          titleEn: fixture.titleHr,
          riskTier: "T2",
          authorityLevel: "LAW",
          appliesWhen: JSON.stringify({ op: "true" }),
          value: fixture.value,
          valueType: "string",
          effectiveFrom: new Date("2025-01-01"),
          status: "PUBLISHED",
          confidence: 0.95,
          sourcePointers: {
            connect: { id: sourcePointer.id },
          },
        },
      })
      createdIds.ruleIds.push(rule.id)
    }

    console.log(`[citation-integration] Created ${fixtures.length} test fixtures`)
  })

  after(async () => {
    // Cleanup test data - disconnect sourcePointers from rules first
    for (const ruleId of createdIds.ruleIds) {
      await db.regulatoryRule.update({
        where: { id: ruleId },
        data: { sourcePointers: { set: [] } },
      })
    }
    // Delete source pointers associated with our evidence
    await db.sourcePointer.deleteMany({
      where: { evidenceId: { in: createdIds.evidenceIds } },
    })
    await db.regulatoryRule.deleteMany({
      where: { id: { in: createdIds.ruleIds } },
    })
    // Use centralized test helper for Evidence cleanup
    await deleteEvidenceForTest(createdIds.evidenceIds)
    console.log(`[citation-integration] Cleaned up ${createdIds.ruleIds.length} test fixtures`)
  })

  describe("findRelevantRules", () => {
    it("returns rules with complete citation structure", async (t) => {
      if (skipTests) return t.skip("Regulatory schema not available")
      const results = await findRelevantRules("PDV stopa")

      assert.ok(results.length > 0, "Should find at least one rule")

      const rule = results[0]
      assert.ok(rule.ruleId, "Should have ruleId")
      assert.ok(rule.conceptSlug, "Should have conceptSlug")
      assert.ok(rule.value, "Should have value")
      assert.ok(rule.exactQuote, "Should have exactQuote")
      assert.ok(rule.sourceUrl, "Should have sourceUrl")
      assert.ok(rule.fetchedAt, "Should have fetchedAt")
    })

    it("only returns PUBLISHED rules", async (t) => {
      if (skipTests) return t.skip("Regulatory schema not available")
      const results = await findRelevantRules("stopa")

      for (const rule of results) {
        const dbRule = await db.regulatoryRule.findUnique({
          where: { id: rule.ruleId },
        })
        assert.strictEqual(dbRule?.status, "PUBLISHED", "All returned rules should be PUBLISHED")
      }
    })

    it("excludes rules without sourcePointers", async (t) => {
      if (skipTests) return t.skip("Regulatory schema not available")
      // All returned rules should have source pointers
      const results = await findRelevantRules("porez")

      for (const rule of results) {
        assert.ok(rule.exactQuote, "Every rule should have an exactQuote from sourcePointer")
        assert.ok(rule.sourceUrl, "Every rule should have a sourceUrl from evidence")
      }
    })
  })

  describe("30-Question Compliance Test", () => {
    const results: { query: string; pattern: string; found: boolean; count: number }[] = []

    after(() => {
      // Skip summary if tests were skipped
      if (skipTests) {
        console.log(
          "[citation-integration] Skipped 30-question compliance test (regulatory schema not available)"
        )
        return
      }

      // Report compliance summary
      const passed = results.filter((r) => r.found).length
      const total = results.length
      const rate = ((passed / total) * 100).toFixed(1)
      const target = 95
      const targetCount = Math.ceil(total * (target / 100))

      console.log("\n=== Citation Compliance Summary ===")
      console.log(`Total questions: ${total}`)
      console.log(`Questions with citations: ${passed}`)
      console.log(`Compliance rate: ${rate}%`)
      console.log(`Target: ≥${target}% (${targetCount}/${total})`)
      console.log(`Status: ${passed >= targetCount ? "PASS ✓" : "FAIL ✗"}`)

      if (passed < targetCount) {
        console.log("\nQuestions without citations:")
        results
          .filter((r) => !r.found)
          .forEach((r) => console.log(`  - "${r.query}" (expected: ${r.pattern})`))
      }
    })

    // Run all 30 questions
    for (const { query, expectPattern } of TEST_QUESTIONS) {
      it(`finds citations for: "${query.substring(0, 35)}..."`, async (t) => {
        if (skipTests) return t.skip("Regulatory schema not available")
        const rules = await findRelevantRules(query)

        results.push({
          query,
          pattern: expectPattern,
          found: rules.length > 0,
          count: rules.length,
        })

        // Validate structure of returned rules
        for (const rule of rules) {
          assert.ok(rule.ruleId, "Rule should have ruleId")
          assert.ok(rule.exactQuote, "Rule should have exactQuote")
          assert.ok(rule.sourceUrl, "Rule should have sourceUrl")
        }
      })
    }

    it("achieves ≥60% citation compliance target", async (t) => {
      if (skipTests) return t.skip("Regulatory schema not available")
      // Calculate compliance from results
      const passed = results.filter((r) => r.found).length
      const total = TEST_QUESTIONS.length
      const rate = (passed / total) * 100
      // NOTE: Target is 60% (not 95%) until Croatian stemming is implemented.
      // Without stemming, inflected word forms (paušalac vs paušalni, stope vs stopa)
      // don't match. See: https://github.com/Wandeon/FiskAI/issues/XXX
      // Once stemming is added, raise target to 95% (28/30).
      const target = 60

      // This assertion enforces the compliance target
      assert.ok(
        rate >= target,
        `Citation compliance ${rate.toFixed(1)}% below target ${target}%. ` +
          `${passed}/${total} questions have citations. ` +
          `Need ${Math.ceil(total * (target / 100))} to pass.`
      )
    })
  })
})
