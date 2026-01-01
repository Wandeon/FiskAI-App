import { describe, it, expect } from "vitest"
import { Quantity, QuantityError } from "../Quantity"

describe("Quantity", () => {
  describe("creation", () => {
    it("creates from number", () => {
      const qty = Quantity.of(5)
      expect(qty.toNumber()).toBe(5)
    })

    it("creates from string", () => {
      const qty = Quantity.of("5.5")
      expect(qty.toNumber()).toBe(5.5)
    })

    it("creates one", () => {
      expect(Quantity.one().toNumber()).toBe(1)
    })

    it("creates zero", () => {
      expect(Quantity.zero().toNumber()).toBe(0)
    })

    it("rejects negative values", () => {
      expect(() => Quantity.of(-1)).toThrow(QuantityError)
    })

    it("rejects Infinity", () => {
      expect(() => Quantity.of(Infinity)).toThrow(QuantityError)
    })

    it("rejects NaN", () => {
      expect(() => Quantity.of(NaN)).toThrow(QuantityError)
    })
  })

  describe("arithmetic", () => {
    it("adds correctly", () => {
      const a = Quantity.of(5)
      const b = Quantity.of(3)
      expect(a.add(b).toNumber()).toBe(8)
    })

    it("subtracts correctly", () => {
      const a = Quantity.of(5)
      const b = Quantity.of(3)
      expect(a.subtract(b).toNumber()).toBe(2)
    })

    it("prevents negative result from subtraction", () => {
      const a = Quantity.of(3)
      const b = Quantity.of(5)
      expect(() => a.subtract(b)).toThrow(QuantityError)
    })

    it("multiplies correctly", () => {
      const qty = Quantity.of(5)
      expect(qty.multiply(3).toNumber()).toBe(15)
    })
  })

  describe("comparison", () => {
    it("equals works correctly", () => {
      const a = Quantity.of(5)
      const b = Quantity.of(5)
      const c = Quantity.of(6)
      expect(a.equals(b)).toBe(true)
      expect(a.equals(c)).toBe(false)
    })

    it("isZero works correctly", () => {
      expect(Quantity.zero().isZero()).toBe(true)
      expect(Quantity.one().isZero()).toBe(false)
    })
  })
})
