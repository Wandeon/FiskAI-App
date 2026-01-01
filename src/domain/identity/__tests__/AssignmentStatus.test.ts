// src/domain/identity/__tests__/AssignmentStatus.test.ts
import { describe, it, expect } from "vitest"
import { AssignmentStatus } from "../AssignmentStatus"

describe("AssignmentStatus", () => {
  describe("values", () => {
    it("returns all assignment status values", () => {
      const values = AssignmentStatus.values()
      expect(values).toContain("ACTIVE")
      expect(values).toContain("REVOKED")
      expect(values.length).toBe(2)
    })
  })

  describe("isValid", () => {
    it("returns true for valid status values", () => {
      expect(AssignmentStatus.isValid("ACTIVE")).toBe(true)
      expect(AssignmentStatus.isValid("REVOKED")).toBe(true)
    })

    it("returns false for invalid status values", () => {
      expect(AssignmentStatus.isValid("INVALID")).toBe(false)
      expect(AssignmentStatus.isValid("active")).toBe(false) // Case sensitive
      expect(AssignmentStatus.isValid("")).toBe(false)
      expect(AssignmentStatus.isValid("PENDING")).toBe(false)
      expect(AssignmentStatus.isValid("INACTIVE")).toBe(false)
    })
  })

  describe("constants", () => {
    it("exports status constants", () => {
      expect(AssignmentStatus.ACTIVE).toBe("ACTIVE")
      expect(AssignmentStatus.REVOKED).toBe("REVOKED")
    })
  })

  describe("usage in context", () => {
    it("ACTIVE represents an active assignment", () => {
      const status = AssignmentStatus.ACTIVE
      expect(status).toBe("ACTIVE")
      expect(AssignmentStatus.isValid(status)).toBe(true)
    })

    it("REVOKED represents a revoked assignment", () => {
      const status = AssignmentStatus.REVOKED
      expect(status).toBe("REVOKED")
      expect(AssignmentStatus.isValid(status)).toBe(true)
    })
  })
})
