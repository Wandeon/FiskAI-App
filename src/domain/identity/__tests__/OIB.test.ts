// src/domain/identity/__tests__/OIB.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { OIB } from "../OIB"
import { IdentityError } from "../IdentityError"

describe("OIB", () => {
  describe("create", () => {
    it("creates a valid OIB with correct checksum", () => {
      // Known valid Croatian OIBs (Mod 11,10 algorithm)
      const validOibs = [
        "12345678903", // Computed: check digit = 3
        "00000000001", // All zeros with check digit 1
        "11111111116", // All ones with check digit 6
        "69435151530", // Common test OIB
      ]

      for (const value of validOibs) {
        const oib = OIB.create(value)
        expect(oib.value).toBe(value)
        expect(oib.toString()).toBe(value)
      }
    })

    it("trims whitespace from input", () => {
      const oib = OIB.create("  12345678903  ")
      expect(oib.value).toBe("12345678903")
    })

    it("throws IdentityError for empty value", () => {
      expect(() => OIB.create("")).toThrow(IdentityError)
      expect(() => OIB.create("")).toThrow("OIB cannot be empty")
    })

    it("throws IdentityError for whitespace-only value", () => {
      expect(() => OIB.create("   ")).toThrow(IdentityError)
      expect(() => OIB.create("   ")).toThrow("OIB cannot be empty")
    })

    it("throws IdentityError for null/undefined value", () => {
      expect(() => OIB.create(null as unknown as string)).toThrow(IdentityError)
      expect(() => OIB.create(undefined as unknown as string)).toThrow(IdentityError)
    })

    it("throws IdentityError for OIB with wrong length", () => {
      expect(() => OIB.create("1234567890")).toThrow(IdentityError)
      expect(() => OIB.create("1234567890")).toThrow("OIB must be exactly 11 digits")

      expect(() => OIB.create("123456789012")).toThrow(IdentityError)
      expect(() => OIB.create("123456789012")).toThrow("OIB must be exactly 11 digits")
    })

    it("throws IdentityError for non-numeric characters", () => {
      expect(() => OIB.create("1234567890a")).toThrow(IdentityError)
      expect(() => OIB.create("1234567890a")).toThrow("OIB must contain only numeric characters")

      expect(() => OIB.create("12345-67890")).toThrow(IdentityError)
      expect(() => OIB.create("12345 67890")).toThrow("OIB must contain only numeric characters")
    })

    it("throws IdentityError for invalid checksum", () => {
      // Valid would be 12345678903 (check digit 3), 2 is wrong
      expect(() => OIB.create("12345678902")).toThrow(IdentityError)
      expect(() => OIB.create("12345678902")).toThrow("OIB has invalid checksum")

      // All same digits with wrong check digit
      expect(() => OIB.create("11111111111")).toThrow(IdentityError)
      expect(() => OIB.create("11111111111")).toThrow("OIB has invalid checksum")
    })
  })

  describe("value", () => {
    it("returns the OIB value", () => {
      const oib = OIB.create("12345678903")
      expect(oib.value).toBe("12345678903")
    })
  })

  describe("toString", () => {
    it("returns the OIB as a string", () => {
      const oib = OIB.create("12345678903")
      expect(oib.toString()).toBe("12345678903")
    })

    it("matches the value property", () => {
      const oib = OIB.create("69435151530")
      expect(oib.toString()).toBe(oib.value)
    })
  })

  describe("equals", () => {
    it("returns true for OIBs with the same value", () => {
      const oib1 = OIB.create("12345678903")
      const oib2 = OIB.create("12345678903")
      expect(oib1.equals(oib2)).toBe(true)
    })

    it("returns true for OIBs created from equivalent input", () => {
      const oib1 = OIB.create("12345678903")
      const oib2 = OIB.create("  12345678903  ")
      expect(oib1.equals(oib2)).toBe(true)
    })

    it("returns false for OIBs with different values", () => {
      const oib1 = OIB.create("12345678903")
      const oib2 = OIB.create("00000000001")
      expect(oib1.equals(oib2)).toBe(false)
    })
  })

  describe("Mod 11,10 checksum algorithm", () => {
    // These tests verify the Mod 11,10 (ISO 7064) algorithm implementation
    it("validates known good OIBs from Croatian tax authority", () => {
      // Test OIBs that follow the Mod 11,10 pattern
      const knownGoodOibs = ["69435151530", "12345678903", "00000000001"]

      for (const oib of knownGoodOibs) {
        expect(() => OIB.create(oib)).not.toThrow()
      }
    })

    it("rejects OIBs with single digit changes", () => {
      // Change one digit from a valid OIB should break checksum
      const validOib = "12345678903"
      const corruptedOibs = [
        "02345678903", // First digit changed
        "13345678903", // Second digit changed
        "12445678903", // Third digit changed
        "12355678903", // Fourth digit changed
        "12346678903", // Fifth digit changed
        "12345778903", // Sixth digit changed
        "12345688903", // Seventh digit changed
        "12345679903", // Eighth digit changed
        "12345678003", // Ninth digit changed
        "12345678913", // Tenth digit changed
      ]

      for (const corrupted of corruptedOibs) {
        expect(() => OIB.create(corrupted)).toThrow("OIB has invalid checksum")
      }
    })
  })
})
