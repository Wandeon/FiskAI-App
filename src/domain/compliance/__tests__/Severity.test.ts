// src/domain/compliance/__tests__/Severity.test.ts
import { describe, it, expect } from "vitest"
import { Severity } from "../Severity"

describe("Severity", () => {
  describe("values", () => {
    it("returns all severity values", () => {
      const values = Severity.values()
      expect(values).toContain("CRITICAL")
      expect(values).toContain("HIGH")
      expect(values).toContain("NORMAL")
      expect(values).toContain("LOW")
      expect(values.length).toBe(4)
    })

    it("returns values in order from highest to lowest", () => {
      const values = Severity.values()
      expect(values[0]).toBe("CRITICAL")
      expect(values[1]).toBe("HIGH")
      expect(values[2]).toBe("NORMAL")
      expect(values[3]).toBe("LOW")
    })
  })

  describe("isValid", () => {
    it("returns true for valid severity levels", () => {
      expect(Severity.isValid("CRITICAL")).toBe(true)
      expect(Severity.isValid("HIGH")).toBe(true)
      expect(Severity.isValid("NORMAL")).toBe(true)
      expect(Severity.isValid("LOW")).toBe(true)
    })

    it("returns false for invalid severity levels", () => {
      expect(Severity.isValid("INVALID")).toBe(false)
      expect(Severity.isValid("critical")).toBe(false) // Case sensitive
      expect(Severity.isValid("")).toBe(false)
      expect(Severity.isValid("MEDIUM")).toBe(false)
    })
  })

  describe("compare", () => {
    it("returns positive when first severity is higher", () => {
      expect(Severity.compare("CRITICAL", "HIGH")).toBeGreaterThan(0)
      expect(Severity.compare("HIGH", "NORMAL")).toBeGreaterThan(0)
      expect(Severity.compare("NORMAL", "LOW")).toBeGreaterThan(0)
      expect(Severity.compare("CRITICAL", "LOW")).toBeGreaterThan(0)
    })

    it("returns negative when first severity is lower", () => {
      expect(Severity.compare("LOW", "CRITICAL")).toBeLessThan(0)
      expect(Severity.compare("NORMAL", "HIGH")).toBeLessThan(0)
      expect(Severity.compare("HIGH", "CRITICAL")).toBeLessThan(0)
    })

    it("returns zero for same severity levels", () => {
      expect(Severity.compare("CRITICAL", "CRITICAL")).toBe(0)
      expect(Severity.compare("HIGH", "HIGH")).toBe(0)
      expect(Severity.compare("NORMAL", "NORMAL")).toBe(0)
      expect(Severity.compare("LOW", "LOW")).toBe(0)
    })

    it("handles unknown severity levels gracefully", () => {
      // Unknown values get 0, so comparing two unknowns returns 0
      expect(Severity.compare("UNKNOWN", "ALSO_UNKNOWN")).toBe(0)
      // Known beats unknown
      expect(Severity.compare("LOW", "UNKNOWN")).toBeGreaterThan(0)
      expect(Severity.compare("UNKNOWN", "LOW")).toBeLessThan(0)
    })
  })

  describe("constants", () => {
    it("exports severity constants", () => {
      expect(Severity.CRITICAL).toBe("CRITICAL")
      expect(Severity.HIGH).toBe("HIGH")
      expect(Severity.NORMAL).toBe("NORMAL")
      expect(Severity.LOW).toBe("LOW")
    })
  })
})
