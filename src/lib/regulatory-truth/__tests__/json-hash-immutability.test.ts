// src/lib/regulatory-truth/__tests__/json-hash-immutability.test.ts
/**
 * JSON Hash Immutability Tests
 *
 * Verifies that JSON content hashing preserves exact bytes and
 * does not destroy valid JSON data like timestamps or hex strings.
 */

import { describe, it } from "node:test"
import assert from "node:assert"
import { hashContent, hashRawContent, normalizeHtmlContent } from "../utils/content-hash"

describe("JSON Hash Immutability", () => {
  describe("hashRawContent", () => {
    it("preserves exact bytes - same input = same hash", () => {
      const json = '{"id": 1234567890123, "hash": "abc123def456789"}'
      const hash1 = hashRawContent(json)
      const hash2 = hashRawContent(json)

      assert.strictEqual(hash1, hash2, "Same content should produce same hash")
      assert.strictEqual(hash1.length, 64, "SHA-256 produces 64 hex chars")
    })

    it("preserves Unix timestamps in JSON", () => {
      const json = '{"timestamp": 1703332800000, "value": 25}'
      const hash = hashRawContent(json)

      // Re-hash should match
      assert.strictEqual(hashRawContent(json), hash)

      // Different timestamp = different hash
      const json2 = '{"timestamp": 1703332800001, "value": 25}'
      assert.notStrictEqual(hashRawContent(json2), hash)
    })

    it("preserves hex strings in JSON", () => {
      const json =
        '{"contentHash": "ca5ece5976e2dc082d3a5ec4acfdf5502a37c45f6c6617c054d14939d83ea70d"}'
      const hash = hashRawContent(json)

      // Re-hash should match
      assert.strictEqual(hashRawContent(json), hash)
    })

    it("is sensitive to whitespace changes", () => {
      const json1 = '{"key": "value"}'
      const json2 = '{"key":  "value"}' // Extra space
      const json3 = '{ "key": "value" }' // Spaces around braces

      assert.notStrictEqual(hashRawContent(json1), hashRawContent(json2))
      assert.notStrictEqual(hashRawContent(json1), hashRawContent(json3))
    })
  })

  describe("hashContent with contentType", () => {
    it("uses raw hash for JSON content type", () => {
      const json = '{"timestamp": 1703332800000}'
      const rawHash = hashRawContent(json)
      const contentTypeHash = hashContent(json, "application/json")

      assert.strictEqual(contentTypeHash, rawHash, "JSON should use raw hashing")
    })

    it("uses raw hash for JSON-LD content type", () => {
      const jsonld = '{"@context": "http://schema.org", "@type": "Thing"}'
      const rawHash = hashRawContent(jsonld)
      const contentTypeHash = hashContent(jsonld, "application/ld+json")

      assert.strictEqual(contentTypeHash, rawHash, "JSON-LD should use raw hashing")
    })

    it("auto-detects JSON by content structure", () => {
      const json = '{"key": "value"}'
      const rawHash = hashRawContent(json)
      const autoHash = hashContent(json) // No content type

      assert.strictEqual(autoHash, rawHash, "Should auto-detect JSON")
    })

    it("auto-detects JSON arrays", () => {
      const jsonArray = '[{"id": 1}, {"id": 2}]'
      const rawHash = hashRawContent(jsonArray)
      const autoHash = hashContent(jsonArray)

      assert.strictEqual(autoHash, rawHash, "Should auto-detect JSON arrays")
    })

    it("uses normalized hash for HTML content", () => {
      const html = "<html><body>Test  content</body></html>"
      const rawHash = hashRawContent(html)
      const htmlHash = hashContent(html, "text/html")

      // HTML should be normalized (different from raw)
      assert.notStrictEqual(htmlHash, rawHash, "HTML should use normalized hashing")
    })
  })

  describe("normalizeHtmlContent does NOT affect JSON", () => {
    it("normalizeHtmlContent destroys JSON timestamps", () => {
      const json = '{"timestamp": 1703332800000}'
      const normalized = normalizeHtmlContent(json)

      // This demonstrates WHY we don't use normalization for JSON
      assert.ok(
        !normalized.includes("1703332800000"),
        "Normalization removes timestamps - this is why we use raw hashing for JSON"
      )
    })

    it("normalizeHtmlContent destroys JSON hex strings", () => {
      const json = '{"hash": "ca5ece5976e2dc082d3a5ec4acfdf5502a37c45f6c6617c054d14939d83ea70d"}'
      const normalized = normalizeHtmlContent(json)

      // This demonstrates WHY we don't use normalization for JSON
      assert.ok(
        !normalized.includes("ca5ece5976e2dc082d3a5ec4acfdf5502a37c45f"),
        "Normalization removes hex strings - this is why we use raw hashing for JSON"
      )
    })
  })

  describe("HNB Exchange Rate JSON Immutability", () => {
    const sampleHnbRate = {
      broj_tecajnice: "245",
      datum_primjene: "2025-12-22",
      drzava: "Australija",
      drzava_iso: "AUS",
      valuta: "AUD",
      sifra_valute: "036",
      kupovni_tecaj: "1,765000",
      prodajni_tecaj: "1,782800",
      srednji_tecaj: "1,773900",
    }

    it("HNB rate JSON produces consistent hash", () => {
      const json = JSON.stringify(sampleHnbRate)
      const hash1 = hashContent(json, "application/json")
      const hash2 = hashContent(json, "application/json")

      assert.strictEqual(hash1, hash2, "Same HNB rate should produce same hash")
    })

    it("HNB rate JSON hash differs with different value", () => {
      const rate1 = { ...sampleHnbRate, srednji_tecaj: "1,773900" }
      const rate2 = { ...sampleHnbRate, srednji_tecaj: "1,773901" }

      const hash1 = hashContent(JSON.stringify(rate1), "application/json")
      const hash2 = hashContent(JSON.stringify(rate2), "application/json")

      assert.notStrictEqual(hash1, hash2, "Different rate should produce different hash")
    })

    it("stored rawContent can be rehashed to match contentHash", () => {
      // Simulate what's stored in DB
      const rawContent = JSON.stringify(sampleHnbRate, null, 2) // Pretty-printed
      const storedHash = hashContent(rawContent, "application/json")

      // Later retrieval and rehash
      const rehashedFromStored = hashContent(rawContent, "application/json")

      assert.strictEqual(rehashedFromStored, storedHash, "Rehash should match stored hash")
    })
  })
})
