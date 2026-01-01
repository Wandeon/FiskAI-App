import { describe, it, expect } from "vitest"
import { InvoiceId } from "../InvoiceId"
import { InvoiceError } from "../InvoiceError"

describe("InvoiceId", () => {
  describe("creation", () => {
    it("creates with random UUID", () => {
      const id = InvoiceId.create()
      const value = id.toString()
      // UUID format: 8-4-4-4-12 hex digits
      expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it("creates unique IDs each time", () => {
      const id1 = InvoiceId.create()
      const id2 = InvoiceId.create()
      expect(id1.equals(id2)).toBe(false)
    })

    it("creates from valid string", () => {
      const value = "test-invoice-id-123"
      const id = InvoiceId.fromString(value)
      expect(id.toString()).toBe(value)
    })

    it("creates from valid UUID string", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000"
      const id = InvoiceId.fromString(uuid)
      expect(id.toString()).toBe(uuid)
    })
  })

  describe("validation", () => {
    it("throws InvoiceError on empty string", () => {
      expect(() => InvoiceId.fromString("")).toThrow(InvoiceError)
      expect(() => InvoiceId.fromString("")).toThrow("Invoice ID cannot be empty")
    })

    it("throws InvoiceError on whitespace-only string", () => {
      expect(() => InvoiceId.fromString("   ")).toThrow(InvoiceError)
      expect(() => InvoiceId.fromString("\t\n")).toThrow(InvoiceError)
    })
  })

  describe("equals", () => {
    it("returns true for same value", () => {
      const id1 = InvoiceId.fromString("test-id")
      const id2 = InvoiceId.fromString("test-id")
      expect(id1.equals(id2)).toBe(true)
    })

    it("returns false for different values", () => {
      const id1 = InvoiceId.fromString("test-id-1")
      const id2 = InvoiceId.fromString("test-id-2")
      expect(id1.equals(id2)).toBe(false)
    })

    it("is symmetric", () => {
      const id1 = InvoiceId.fromString("symmetric-test")
      const id2 = InvoiceId.fromString("symmetric-test")
      expect(id1.equals(id2)).toBe(id2.equals(id1))
    })
  })

  describe("toString", () => {
    it("returns the underlying value", () => {
      const value = "my-invoice-id"
      const id = InvoiceId.fromString(value)
      expect(id.toString()).toBe(value)
    })
  })
})
