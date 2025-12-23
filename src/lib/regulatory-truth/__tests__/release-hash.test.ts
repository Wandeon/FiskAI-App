// src/lib/regulatory-truth/__tests__/release-hash.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { computeReleaseHash } from "../utils/release-hash"

describe("release-hash", () => {
  describe("computeReleaseHash determinism", () => {
    const sampleRules = [
      {
        conceptSlug: "pdv-standard-rate",
        appliesWhen: { op: "true" },
        value: 25,
        valueType: "percentage",
        effectiveFrom: new Date("2025-01-01"),
        effectiveUntil: null,
      },
      {
        conceptSlug: "pausalni-revenue-threshold",
        appliesWhen: { op: "cmp", field: "year", cmp: "eq", value: "2025" },
        value: 39816.84,
        valueType: "currency",
        effectiveFrom: new Date("2025-01-01"),
        effectiveUntil: new Date("2025-12-31"),
      },
    ]

    it("produces same hash when computed multiple times", () => {
      const hash1 = computeReleaseHash(sampleRules)
      const hash2 = computeReleaseHash(sampleRules)
      const hash3 = computeReleaseHash(sampleRules)

      assert.strictEqual(hash1, hash2, "Hash should be identical on recompute")
      assert.strictEqual(hash2, hash3, "Hash should be identical on third compute")
      assert.strictEqual(hash1.length, 64, "SHA-256 hash should be 64 hex chars")
    })

    it("produces same hash regardless of input array order", () => {
      const reversedRules = [...sampleRules].reverse()

      const hashOriginal = computeReleaseHash(sampleRules)
      const hashReversed = computeReleaseHash(reversedRules)

      assert.strictEqual(
        hashOriginal,
        hashReversed,
        "Hash should be identical regardless of input order (rules sorted internally by conceptSlug)"
      )
    })

    it("produces same hash with equivalent Date objects", () => {
      const rulesWithNewDates = sampleRules.map((r) => ({
        ...r,
        effectiveFrom: r.effectiveFrom ? new Date(r.effectiveFrom.getTime()) : null,
        effectiveUntil: r.effectiveUntil ? new Date(r.effectiveUntil.getTime()) : null,
      }))

      const hash1 = computeReleaseHash(sampleRules)
      const hash2 = computeReleaseHash(rulesWithNewDates)

      assert.strictEqual(hash1, hash2, "Hash should be identical with equivalent Date objects")
    })

    it("produces same hash with nested object key reordering", () => {
      const rulesWithReorderedKeys = [
        {
          appliesWhen: { op: "true" }, // keys in different order
          conceptSlug: "pdv-standard-rate",
          valueType: "percentage",
          value: 25,
          effectiveUntil: null,
          effectiveFrom: new Date("2025-01-01"),
        },
        {
          // Deeply nested appliesWhen with different key order
          appliesWhen: { value: "2025", cmp: "eq", field: "year", op: "cmp" },
          value: 39816.84,
          conceptSlug: "pausalni-revenue-threshold",
          effectiveFrom: new Date("2025-01-01"),
          valueType: "currency",
          effectiveUntil: new Date("2025-12-31"),
        },
      ]

      const hashOriginal = computeReleaseHash(sampleRules)
      const hashReordered = computeReleaseHash(rulesWithReorderedKeys)

      assert.strictEqual(
        hashOriginal,
        hashReordered,
        "Hash should be identical despite object key reordering (recursive key sorting)"
      )
    })

    it("produces different hash when value changes", () => {
      const modifiedRules = [
        { ...sampleRules[0], value: 26 }, // Changed from 25 to 26
        sampleRules[1],
      ]

      const hashOriginal = computeReleaseHash(sampleRules)
      const hashModified = computeReleaseHash(modifiedRules)

      assert.notStrictEqual(hashOriginal, hashModified, "Hash should differ when a value changes")
    })

    it("produces different hash when date changes", () => {
      const modifiedRules = [
        { ...sampleRules[0], effectiveFrom: new Date("2025-02-01") }, // Different date
        sampleRules[1],
      ]

      const hashOriginal = computeReleaseHash(sampleRules)
      const hashModified = computeReleaseHash(modifiedRules)

      assert.notStrictEqual(
        hashOriginal,
        hashModified,
        "Hash should differ when effectiveFrom changes"
      )
    })

    it("produces different hash when appliesWhen changes", () => {
      const modifiedRules = [
        { ...sampleRules[0], appliesWhen: { op: "false" } }, // Changed condition
        sampleRules[1],
      ]

      const hashOriginal = computeReleaseHash(sampleRules)
      const hashModified = computeReleaseHash(modifiedRules)

      assert.notStrictEqual(
        hashOriginal,
        hashModified,
        "Hash should differ when appliesWhen changes"
      )
    })

    it("handles empty rule array", () => {
      const hash = computeReleaseHash([])
      assert.strictEqual(typeof hash, "string")
      assert.strictEqual(hash.length, 64)
    })

    it("handles null effectiveUntil consistently", () => {
      const rulesWithNull = [
        { ...sampleRules[0], effectiveUntil: null },
        { ...sampleRules[1], effectiveUntil: null },
      ]

      const hash1 = computeReleaseHash(rulesWithNull)
      const hash2 = computeReleaseHash(rulesWithNull)

      assert.strictEqual(hash1, hash2, "Null effectiveUntil should produce consistent hash")
    })
  })
})
