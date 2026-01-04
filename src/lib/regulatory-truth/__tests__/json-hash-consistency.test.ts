// src/lib/regulatory-truth/__tests__/json-hash-consistency.test.ts
// Tests for JSON hash consistency fix (INV-001 F-1)
//
// Acceptance criteria:
// - stored rawContent bytes hash equals contentHash
// - pretty-print change changes hash (verifies whitespace sensitivity)
// - re-fetching same URL may produce different hash only if bytes differ

import { describe, it } from "node:test"
import assert from "node:assert"
import { hashContent } from "../utils/content-hash"

describe("JSON Hash Consistency (INV-001 F-1)", () => {
  describe("stored rawContent bytes hash equals contentHash", () => {
    it("compact JSON hash matches when stored and recomputed", () => {
      const sampleData = {
        valuta: "USD",
        srednji_tecaj: "1.0856",
        datum_primjene: "2025-12-26",
      }

      // Simulate what fetchers now do: hash compact, store compact
      const rawContent = JSON.stringify(sampleData)
      const contentHash = hashContent(rawContent, "application/json")

      // Simulate verification: recompute hash from stored rawContent
      const recomputedHash = hashContent(rawContent, "application/json")

      assert.strictEqual(recomputedHash, contentHash)
    })

    it("verifies 10 sample JSON structures hash correctly", () => {
      const samples = [
        { id: 1, name: "Test", value: 123.45 },
        { eli: "https://example.com/eli/2025/1/1", type: "ZAKON" },
        { celex: "32006L0112", title: "VAT Directive" },
        { rates: [{ from: "EUR", to: "USD", rate: 1.08 }] },
        { nested: { deep: { value: true } } },
        { array: [1, 2, 3, 4, 5] },
        { unicode: "Tečaj EUR/HRK" },
        { special: 'Value with "quotes" and \\backslash' },
        { numbers: { int: 42, float: 3.14159, negative: -100 } },
        { mixed: { str: "hello", num: 42, bool: true, nil: null } },
      ]

      for (const sample of samples) {
        const rawContent = JSON.stringify(sample)
        const contentHash = hashContent(rawContent, "application/json")
        const recomputedHash = hashContent(rawContent, "application/json")

        assert.strictEqual(recomputedHash, contentHash)
      }
    })
  })

  describe("pretty-print change changes hash", () => {
    it("compact and pretty-printed JSON produce different hashes", () => {
      const data = { key: "value", number: 42 }

      const compact = JSON.stringify(data)
      const prettyPrinted = JSON.stringify(data, null, 2)

      const compactHash = hashContent(compact, "application/json")
      const prettyHash = hashContent(prettyPrinted, "application/json")

      // These MUST be different - this is what caused F-1
      assert.notStrictEqual(compactHash, prettyHash)

      // Verify the actual content differs
      assert.notStrictEqual(compact, prettyPrinted)
      assert.strictEqual(compact, '{"key":"value","number":42}')
      assert.ok(prettyPrinted.includes("\n"))
    })

    it("any whitespace change produces a different hash", () => {
      const original = '{"key":"value"}'
      const withSpace = '{"key": "value"}'
      const withNewline = '{\n"key":"value"\n}'

      const originalHash = hashContent(original, "application/json")
      const spaceHash = hashContent(withSpace, "application/json")
      const newlineHash = hashContent(withNewline, "application/json")

      assert.notStrictEqual(originalHash, spaceHash)
      assert.notStrictEqual(originalHash, newlineHash)
      assert.notStrictEqual(spaceHash, newlineHash)
    })
  })

  describe("content change detection", () => {
    it("detects value changes as hash changes", () => {
      const original = { rate: "1.0856" }
      const updated = { rate: "1.0857" }

      const originalHash = hashContent(JSON.stringify(original), "application/json")
      const updatedHash = hashContent(JSON.stringify(updated), "application/json")

      assert.notStrictEqual(originalHash, updatedHash)
    })

    it("identical content produces identical hash regardless of creation order", () => {
      // Create same object structure in different ways
      const obj1 = { a: 1, b: 2 }
      const obj2: Record<string, number> = {}
      obj2.a = 1
      obj2.b = 2

      const hash1 = hashContent(JSON.stringify(obj1), "application/json")
      const hash2 = hashContent(JSON.stringify(obj2), "application/json")

      assert.strictEqual(hash1, hash2)
    })

    it("key order affects hash (JSON.stringify property order)", () => {
      // JSON.stringify preserves insertion order
      const obj1 = { a: 1, b: 2 }
      const obj2 = { b: 2, a: 1 }

      const hash1 = hashContent(JSON.stringify(obj1), "application/json")
      const hash2 = hashContent(JSON.stringify(obj2), "application/json")

      // These will be different because JSON.stringify preserves key order
      assert.notStrictEqual(hash1, hash2)
    })
  })

  describe("hash determinism", () => {
    it("same content always produces same hash", () => {
      const data = { test: "determinism", value: 42 }
      const content = JSON.stringify(data)

      const hashes = Array.from({ length: 100 }, () => hashContent(content, "application/json"))

      // All 100 hashes should be identical
      assert.strictEqual(new Set(hashes).size, 1)
    })

    it("hash is a valid SHA-256 hex string", () => {
      const hash = hashContent('{"test":true}', "application/json")

      // SHA-256 produces 64 hex characters
      assert.match(hash, /^[a-f0-9]{64}$/)
    })
  })
})

describe("Fetcher hash-store consistency simulation", () => {
  it("simulates HNB fetcher: hash and store same bytes", () => {
    const rate = {
      valuta: "USD",
      srednji_tecaj: "1.0856",
      datum_primjene: "2025-12-26",
    }

    // What the FIXED fetcher does:
    const rawContent = JSON.stringify(rate) // Compact
    const contentHash = hashContent(rawContent, "application/json")

    // Simulate storing to DB and retrieving
    const storedRawContent = rawContent
    const storedContentHash = contentHash

    // Verification (what verify-immutability.ts does):
    const recomputed = hashContent(storedRawContent, "application/json")
    assert.strictEqual(recomputed, storedContentHash)
  })

  it("simulates NN fetcher: hash and store same bytes", () => {
    const metadata = {
      eli: "https://narodne-novine.nn.hr/eli/sluzbeni/2025/1/1",
      type: "ZAKON",
      title: "Test Law",
    }

    const rawContent = JSON.stringify(metadata)
    const contentHash = hashContent(rawContent)

    // Verification
    assert.strictEqual(hashContent(rawContent), contentHash)
  })

  it("simulates EUR-Lex fetcher: hash and store same bytes", () => {
    const metadata = {
      celex: "32006L0112",
      title: "VAT Directive",
      domain: "vat",
    }

    const rawContent = JSON.stringify(metadata)
    const contentHash = hashContent(rawContent)

    // Verification
    assert.strictEqual(hashContent(rawContent), contentHash)
  })
})
