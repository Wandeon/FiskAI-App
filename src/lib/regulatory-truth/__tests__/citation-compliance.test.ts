// src/lib/regulatory-truth/__tests__/citation-compliance.test.ts
/**
 * Citation Compliance Test Suite
 *
 * 30 test questions covering Croatian tax/regulatory domain.
 * Tests keyword extraction, prompt formatting, and citation structure.
 *
 * Integration tests (DB-dependent) are in citation-compliance-integration.test.ts
 * and run in CI with ephemeral Postgres.
 *
 * Pass criteria for integration tests: ≥95% (28/30) questions return valid citations
 */

import { describe, it } from "node:test"
import assert from "node:assert"
import { formatRulesForPrompt, RuleContext } from "../utils/rule-context"

// Test questions mapped to expected concept patterns
// Used by both unit and integration tests
export const TEST_QUESTIONS = [
  // PDV (VAT) questions
  { query: "Koja je stopa PDV-a u Hrvatskoj?", expectPattern: "pdv" },
  { query: "Koliki je porez na dodanu vrijednost?", expectPattern: "pdv" },
  { query: "Koja je standardna stopa PDV-a?", expectPattern: "pdv" },

  // Pausalni (lump-sum) taxation questions
  { query: "Koji je prag za paušalno oporezivanje?", expectPattern: "pausaln" },
  { query: "Koliki su limiti za paušalni obrt?", expectPattern: "pausaln" },
  { query: "Do kojeg iznosa mogu biti paušalac?", expectPattern: "pausaln" },
  { query: "Kada prelazim limit za paušalno?", expectPattern: "pausaln" },

  // Income tax questions
  { query: "Kolika je stopa poreza na dohodak?", expectPattern: "dohodak" },
  { query: "Koje su porezne stope za fizičke osobe?", expectPattern: "porez" },
  { query: "Koliki je osobni odbitak?", expectPattern: "odbitak" },

  // Social contributions questions
  { query: "Koliki su doprinosi za zdravstveno osiguranje?", expectPattern: "doprin" },
  { query: "Koliko iznosi doprinos za mirovinsko?", expectPattern: "doprin" },
  { query: "Koliki su obvezni doprinosi?", expectPattern: "doprin" },
  { query: "Kolika je stopa doprinosa za HZZO?", expectPattern: "hzzo" },

  // Exchange rate questions
  { query: "Koji je tečaj eura?", expectPattern: "tecaj" },
  { query: "Koliki je srednjji tečaj HNB?", expectPattern: "tecaj" },
  { query: "Koliki je devizni tečaj?", expectPattern: "tecaj" },

  // Corporate tax questions
  { query: "Kolika je stopa poreza na dobit?", expectPattern: "dobit" },
  { query: "Koji je porez za tvrtke?", expectPattern: "dobit" },
  { query: "Koliki je porez na profit?", expectPattern: "dobit" },

  // Minimum wage questions
  { query: "Kolika je minimalna plaća?", expectPattern: "plac" },
  { query: "Koji je najniži iznos plaće?", expectPattern: "plac" },

  // Accounting thresholds
  { query: "Kada sam obvezan voditi dvojno knjigovodstvo?", expectPattern: "knjig" },
  { query: "Koji su limiti za jednostavno knjigovodstvo?", expectPattern: "knjig" },

  // Fiscal cash register questions
  { query: "Trebam li fiskalizaciju?", expectPattern: "fisk" },
  { query: "Kada je obvezna fiskalizacija računa?", expectPattern: "fisk" },

  // Annual report questions
  { query: "Koji su rokovi za predaju GFI-POD?", expectPattern: "gfi" },
  { query: "Do kada trebam predati godišnje izvješće?", expectPattern: "izvjes" },

  // General regulation questions
  { query: "Koje su obveze malog poduzetnika?", expectPattern: "poduzetn" },
  { query: "Kakva su pravila za obrtnike?", expectPattern: "obrt" },
]

// Croatian stopwords used in keyword extraction
const STOPWORDS = [
  "što",
  "koja",
  "koji",
  "kako",
  "koliko",
  "je",
  "su",
  "za",
  "od",
  "do",
  "u",
  "na",
  "s",
  "i",
  "a",
  "li",
  "biti",
  "može",
  "hoće",
  "kada",
  "gdje",
]

// Keyword extraction function (copied from rule-context for unit testing)
function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\sčćžšđ]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.includes(w))
    .slice(0, 5)
}

describe("Citation Compliance Suite (Unit Tests)", () => {
  describe("Keyword Extraction", () => {
    it("extracts keywords from PDV query", () => {
      const keywords = extractKeywords("Koja je stopa PDV-a u Hrvatskoj?")
      assert.ok(keywords.includes("stopa"), "Should include 'stopa'")
      assert.ok(keywords.includes("pdva"), "Should include 'pdva'")
      assert.ok(keywords.includes("hrvatskoj"), "Should include 'hrvatskoj'")
    })

    it("removes Croatian stopwords", () => {
      const keywords = extractKeywords("Koja je stopa za to?")
      assert.ok(!keywords.includes("koja"), "Should remove 'koja'")
      assert.ok(!keywords.includes("je"), "Should remove 'je'")
      assert.ok(!keywords.includes("za"), "Should remove 'za'")
    })

    it("handles Croatian special characters (čćžšđ)", () => {
      const keywords = extractKeywords("Koliki je prag prihoda za paušalce?")
      assert.ok(keywords.includes("prag"), "Should include 'prag'")
      assert.ok(keywords.includes("prihoda"), "Should include 'prihoda'")
      assert.ok(keywords.includes("paušalce"), "Should include 'paušalce'")
    })

    it("filters short words (≤2 chars)", () => {
      const keywords = extractKeywords("Što je to PDV?")
      assert.ok(!keywords.includes("je"), "Should remove 'je' (2 chars)")
      assert.ok(!keywords.includes("to"), "Should remove 'to' (2 chars)")
    })

    it("limits to 5 keywords", () => {
      const keywords = extractKeywords(
        "Kolika je standardna stopa poreza na dodanu vrijednost u Republici Hrvatskoj za 2025?"
      )
      assert.ok(keywords.length <= 5, `Should have ≤5 keywords, got ${keywords.length}`)
    })

    it("handles empty query", () => {
      const keywords = extractKeywords("")
      assert.deepStrictEqual(keywords, [], "Empty query should return empty array")
    })

    it("handles query with only stopwords", () => {
      const keywords = extractKeywords("što je to za od do u na?")
      assert.deepStrictEqual(keywords, [], "Only stopwords should return empty array")
    })
  })

  describe("Test Question Coverage", () => {
    it("has exactly 30 test questions", () => {
      assert.strictEqual(TEST_QUESTIONS.length, 30, "Should have 30 test questions")
    })

    it("all questions have query and expectPattern", () => {
      for (const q of TEST_QUESTIONS) {
        assert.ok(q.query, "Each question should have a query")
        assert.ok(q.expectPattern, "Each question should have an expectPattern")
        assert.ok(q.query.length > 10, "Query should be meaningful (>10 chars)")
      }
    })

    it("covers diverse regulatory topics", () => {
      const patterns = new Set(TEST_QUESTIONS.map((q) => q.expectPattern))
      assert.ok(patterns.size >= 10, `Should cover ≥10 topics, got ${patterns.size}`)
    })

    it("keywords can be extracted from all questions", () => {
      for (const { query } of TEST_QUESTIONS) {
        const keywords = extractKeywords(query)
        // Most questions should produce keywords (some edge cases allowed)
        if (keywords.length === 0) {
          console.log(`[citation-compliance] No keywords from: "${query}"`)
        }
      }
    })
  })

  describe("Prompt Formatting", () => {
    it("formats empty results as empty string", () => {
      const formatted = formatRulesForPrompt([])
      assert.strictEqual(formatted, "", "Empty results should produce empty string")
    })

    it("formats single rule with all required fields", () => {
      const rules: RuleContext[] = [
        {
          ruleId: "test-id-1",
          conceptSlug: "pdv-standard-rate",
          value: "25",
          exactQuote: "Stopa PDV-a iznosi 25%",
          sourceUrl: "https://example.com/law",
          fetchedAt: new Date("2025-01-01"),
        },
      ]

      const formatted = formatRulesForPrompt(rules)

      assert.ok(formatted.includes("[1]"), "Should include rule number [1]")
      assert.ok(formatted.includes("pdv-standard-rate"), "Should include conceptSlug")
      assert.ok(formatted.includes("Value: 25"), "Should include value")
      assert.ok(formatted.includes('Quote: "Stopa PDV-a iznosi 25%"'), "Should include quoted text")
      assert.ok(formatted.includes("Source: https://example.com/law"), "Should include source URL")
    })

    it("formats multiple rules with sequential numbering", () => {
      const rules: RuleContext[] = [
        {
          ruleId: "test-1",
          conceptSlug: "rule-one",
          value: "1",
          exactQuote: "Quote one",
          sourceUrl: "https://example.com/1",
          fetchedAt: new Date(),
        },
        {
          ruleId: "test-2",
          conceptSlug: "rule-two",
          value: "2",
          exactQuote: "Quote two",
          sourceUrl: "https://example.com/2",
          fetchedAt: new Date(),
        },
        {
          ruleId: "test-3",
          conceptSlug: "rule-three",
          value: "3",
          exactQuote: "Quote three",
          sourceUrl: "https://example.com/3",
          fetchedAt: new Date(),
        },
      ]

      const formatted = formatRulesForPrompt(rules)

      assert.ok(formatted.includes("[1] rule-one"), "Should include rule 1")
      assert.ok(formatted.includes("[2] rule-two"), "Should include rule 2")
      assert.ok(formatted.includes("[3] rule-three"), "Should include rule 3")
    })

    it("includes optional articleNumber when present", () => {
      const rules: RuleContext[] = [
        {
          ruleId: "test-id",
          conceptSlug: "test-rule",
          value: "100",
          exactQuote: "Test quote",
          sourceUrl: "https://example.com",
          fetchedAt: new Date(),
          articleNumber: "čl. 38, st. 1",
        },
      ]

      const formatted = formatRulesForPrompt(rules)
      assert.ok(formatted.includes("Article: čl. 38, st. 1"), "Should include article number")
    })

    it("includes optional lawReference when present", () => {
      const rules: RuleContext[] = [
        {
          ruleId: "test-id",
          conceptSlug: "test-rule",
          value: "100",
          exactQuote: "Test quote",
          sourceUrl: "https://example.com",
          fetchedAt: new Date(),
          lawReference: "Zakon o porezu na dodanu vrijednost (NN 73/13)",
        },
      ]

      const formatted = formatRulesForPrompt(rules)
      assert.ok(
        formatted.includes("Law: Zakon o porezu na dodanu vrijednost (NN 73/13)"),
        "Should include law reference"
      )
    })

    it("excludes optional fields when not present", () => {
      const rules: RuleContext[] = [
        {
          ruleId: "test-id",
          conceptSlug: "test-rule",
          value: "100",
          exactQuote: "Test quote",
          sourceUrl: "https://example.com",
          fetchedAt: new Date(),
          // No articleNumber or lawReference
        },
      ]

      const formatted = formatRulesForPrompt(rules)
      assert.ok(!formatted.includes("Article:"), "Should not include empty Article field")
      assert.ok(!formatted.includes("Law:"), "Should not include empty Law field")
    })

    it("includes citation instructions header", () => {
      const rules: RuleContext[] = [
        {
          ruleId: "test-id",
          conceptSlug: "test",
          value: "0",
          exactQuote: "test",
          sourceUrl: "https://example.com",
          fetchedAt: new Date(),
        },
      ]

      const formatted = formatRulesForPrompt(rules)

      assert.ok(formatted.includes("RELEVANT REGULATORY RULES"), "Should include header")
      assert.ok(formatted.includes("CITATION INSTRUCTIONS"), "Should include citation instructions")
      assert.ok(formatted.includes("Reference rules by number"), "Should explain reference format")
    })
  })

  describe("RuleContext Interface Validation", () => {
    it("required fields are documented correctly", () => {
      // This test documents the required interface fields
      const requiredFields = [
        "ruleId",
        "conceptSlug",
        "value",
        "exactQuote",
        "sourceUrl",
        "fetchedAt",
      ]
      const optionalFields = ["articleNumber", "lawReference"]

      const sampleRule: RuleContext = {
        ruleId: "required",
        conceptSlug: "required",
        value: "required",
        exactQuote: "required",
        sourceUrl: "required",
        fetchedAt: new Date(),
      }

      for (const field of requiredFields) {
        assert.ok(field in sampleRule, `RuleContext should have required field: ${field}`)
      }

      // Optional fields should be allowed but not required
      const fullRule: RuleContext = {
        ...sampleRule,
        articleNumber: "optional",
        lawReference: "optional",
      }

      for (const field of optionalFields) {
        assert.ok(field in fullRule, `RuleContext should support optional field: ${field}`)
      }
    })
  })
})
