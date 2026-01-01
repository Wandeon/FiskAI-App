import { describe, it, expect } from "vitest"
import { Money, MoneyError } from "../Money"

describe("Money", () => {
  describe("creation", () => {
    it("creates from string", () => {
      const money = Money.fromString("100.50")
      expect(money.toDecimal().toString()).toBe("100.5")
    })

    it("creates from cents", () => {
      const money = Money.fromCents(10050)
      expect(money.toDecimal().toString()).toBe("100.5")
    })

    it("rejects non-integer cents", () => {
      expect(() => Money.fromCents(100.5)).toThrow(MoneyError)
    })

    it("creates zero", () => {
      expect(Money.zero().isZero()).toBe(true)
    })

    it("handles negative amounts", () => {
      const money = Money.fromString("-100.50")
      expect(money.isNegative()).toBe(true)
    })
  })

  describe("arithmetic", () => {
    it("adds correctly", () => {
      const a = Money.fromString("100.00")
      const b = Money.fromString("50.25")
      expect(a.add(b).toDecimal().toString()).toBe("150.25")
    })

    it("subtracts correctly", () => {
      const a = Money.fromString("100.00")
      const b = Money.fromString("50.25")
      expect(a.subtract(b).toDecimal().toString()).toBe("49.75")
    })

    it("multiplies correctly", () => {
      const money = Money.fromString("100.00")
      expect(money.multiply(0.25).toDecimal().toString()).toBe("25")
    })

    it("divides correctly", () => {
      const money = Money.fromString("100.00")
      expect(money.divide(4).toDecimal().toString()).toBe("25")
    })

    it("prevents division by zero", () => {
      const money = Money.fromString("100.00")
      expect(() => money.divide(0)).toThrow(MoneyError)
    })

    it("prevents currency mixing on add", () => {
      const eur = Money.fromString("100", "EUR")
      const usd = Money.fromString("100", "USD")
      expect(() => eur.add(usd)).toThrow(MoneyError)
    })

    it("prevents currency mixing on subtract", () => {
      const eur = Money.fromString("100", "EUR")
      const usd = Money.fromString("100", "USD")
      expect(() => eur.subtract(usd)).toThrow(MoneyError)
    })
  })

  describe("rounding", () => {
    it("rounds using banker's rounding (half to even)", () => {
      // 0.125 -> 0.12 (rounds to even)
      expect(Money.fromString("100.125").round().toDecimal().toString()).toBe("100.12")
      // 0.135 -> 0.14 (rounds to even)
      expect(Money.fromString("100.135").round().toDecimal().toString()).toBe("100.14")
      // 0.145 -> 0.14 (rounds to even)
      expect(Money.fromString("100.145").round().toDecimal().toString()).toBe("100.14")
      // 0.155 -> 0.16 (rounds to even)
      expect(Money.fromString("100.155").round().toDecimal().toString()).toBe("100.16")
    })

    it("rounds 2.005 to 2 (banker's rounding - half to even)", () => {
      // 2.005 -> 2.00 (rounds to even)
      expect(Money.fromString("2.005").round().toDecimal().toString()).toBe("2")
    })

    it("rounds 2.015 to 2.02 (banker's rounding - half to even)", () => {
      // 2.015 -> 2.02 (rounds to even)
      expect(Money.fromString("2.015").round().toDecimal().toString()).toBe("2.02")
    })
  })

  describe("toCents", () => {
    it("converts to cents", () => {
      expect(Money.fromString("100.50").toCents()).toBe(10050)
    })

    it("handles zero", () => {
      expect(Money.zero().toCents()).toBe(0)
    })

    it("handles negative amounts", () => {
      expect(Money.fromString("-100.50").toCents()).toBe(-10050)
    })

    it("rejects non-representable amounts", () => {
      expect(() => Money.fromString("100.123").toCents()).toThrow(MoneyError)
    })
  })

  describe("comparison", () => {
    it("equals works correctly", () => {
      const a = Money.fromString("100.00")
      const b = Money.fromString("100.00")
      const c = Money.fromString("100.01")
      expect(a.equals(b)).toBe(true)
      expect(a.equals(c)).toBe(false)
    })

    it("lessThan works correctly", () => {
      const a = Money.fromString("100.00")
      const b = Money.fromString("100.01")
      expect(a.lessThan(b)).toBe(true)
      expect(b.lessThan(a)).toBe(false)
    })

    it("greaterThan works correctly", () => {
      const a = Money.fromString("100.01")
      const b = Money.fromString("100.00")
      expect(a.greaterThan(b)).toBe(true)
      expect(b.greaterThan(a)).toBe(false)
    })

    it("isPositive works correctly", () => {
      expect(Money.fromString("100").isPositive()).toBe(true)
      expect(Money.fromString("0").isPositive()).toBe(false)
      expect(Money.fromString("-100").isPositive()).toBe(false)
    })
  })

  describe("format", () => {
    it("formats for Croatian locale", () => {
      const money = Money.fromString("1234.56", "EUR")
      const formatted = money.format("hr-HR")
      // Should contain EUR and the number
      expect(formatted).toContain("1")
      expect(formatted).toContain("234")
    })
  })
})
