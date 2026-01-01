// src/domain/compliance/__tests__/DeadlineType.test.ts
import { describe, it, expect } from "vitest"
import { DeadlineType } from "../DeadlineType"

describe("DeadlineType", () => {
  describe("values", () => {
    it("returns all deadline type values", () => {
      const values = DeadlineType.values()
      expect(values).toContain("TAX")
      expect(values).toContain("REPORTING")
      expect(values).toContain("REGISTRATION")
      expect(values).toContain("REGULATORY")
      expect(values.length).toBe(4)
    })
  })

  describe("isValid", () => {
    it("returns true for valid deadline types", () => {
      expect(DeadlineType.isValid("TAX")).toBe(true)
      expect(DeadlineType.isValid("REPORTING")).toBe(true)
      expect(DeadlineType.isValid("REGISTRATION")).toBe(true)
      expect(DeadlineType.isValid("REGULATORY")).toBe(true)
    })

    it("returns false for invalid deadline types", () => {
      expect(DeadlineType.isValid("INVALID")).toBe(false)
      expect(DeadlineType.isValid("tax")).toBe(false) // Case sensitive
      expect(DeadlineType.isValid("")).toBe(false)
      expect(DeadlineType.isValid("OTHER")).toBe(false)
    })
  })

  describe("constants", () => {
    it("exports deadline type constants", () => {
      expect(DeadlineType.TAX).toBe("TAX")
      expect(DeadlineType.REPORTING).toBe("REPORTING")
      expect(DeadlineType.REGISTRATION).toBe("REGISTRATION")
      expect(DeadlineType.REGULATORY).toBe("REGULATORY")
    })
  })
})
