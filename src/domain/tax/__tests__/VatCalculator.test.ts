import { describe, it, expect } from "vitest"
import { VatCalculator } from "../VatCalculator"
import { Money, VatRate } from "@/domain/shared"

describe("VatCalculator", () => {
  describe("calculate", () => {
    it("calculates VAT and gross from net amount", () => {
      const net = Money.fromString("100.00")
      const rate = VatRate.HR_STANDARD // 25%

      const result = VatCalculator.calculate(net, rate)

      expect(result.netAmount.equals(net)).toBe(true)
      expect(result.vatAmount.toDecimal().toString()).toBe("25")
      expect(result.grossAmount.toDecimal().toString()).toBe("125")
    })

    it("handles 13% reduced rate", () => {
      const net = Money.fromString("100.00")
      const rate = VatRate.HR_REDUCED_13 // 13%

      const result = VatCalculator.calculate(net, rate)

      expect(result.vatAmount.toDecimal().toString()).toBe("13")
      expect(result.grossAmount.toDecimal().toString()).toBe("113")
    })

    it("handles zero rate", () => {
      const net = Money.fromString("100.00")
      const rate = VatRate.zero()

      const result = VatCalculator.calculate(net, rate)

      expect(result.vatAmount.isZero()).toBe(true)
      expect(result.grossAmount.equals(net)).toBe(true)
    })

    it("handles fractional amounts with rounding", () => {
      const net = Money.fromString("99.99")
      const rate = VatRate.HR_STANDARD // 25%

      const result = VatCalculator.calculate(net, rate)

      // 99.99 * 0.25 = 24.9975 -> rounds to 25.00
      expect(result.vatAmount.toDecimal().toString()).toBe("25")
      // 99.99 + 25.00 = 124.99
      expect(result.grossAmount.toDecimal().toString()).toBe("124.99")
    })
  })

  describe("calculateFromGross", () => {
    it("extracts net and VAT from gross amount", () => {
      const gross = Money.fromString("125.00")
      const rate = VatRate.HR_STANDARD // 25%

      const result = VatCalculator.calculateFromGross(gross, rate)

      expect(result.netAmount.toDecimal().toString()).toBe("100")
      expect(result.vatAmount.toDecimal().toString()).toBe("25")
      expect(result.grossAmount.equals(gross)).toBe(true)
    })

    it("handles 13% rate extraction", () => {
      const gross = Money.fromString("113.00")
      const rate = VatRate.HR_REDUCED_13 // 13%

      const result = VatCalculator.calculateFromGross(gross, rate)

      expect(result.netAmount.toDecimal().toString()).toBe("100")
      expect(result.vatAmount.toDecimal().toString()).toBe("13")
    })

    it("handles zero rate", () => {
      const gross = Money.fromString("100.00")
      const rate = VatRate.zero()

      const result = VatCalculator.calculateFromGross(gross, rate)

      expect(result.netAmount.equals(gross)).toBe(true)
      expect(result.vatAmount.isZero()).toBe(true)
    })
  })

  describe("calculateTotal", () => {
    it("calculates total VAT for multiple items", () => {
      const items = [
        { netAmount: Money.fromString("100.00"), rate: VatRate.HR_STANDARD },
        { netAmount: Money.fromString("100.00"), rate: VatRate.HR_REDUCED_13 },
        { netAmount: Money.fromString("100.00"), rate: VatRate.HR_REDUCED_5 },
      ]

      const totalVat = VatCalculator.calculateTotal(items)

      // 25 + 13 + 5 = 43
      expect(totalVat.toDecimal().toString()).toBe("43")
    })

    it("returns zero for empty items", () => {
      const totalVat = VatCalculator.calculateTotal([])
      expect(totalVat.isZero()).toBe(true)
    })
  })

  describe("splitByRates", () => {
    it("groups items by VAT rate", () => {
      const items = [
        { grossAmount: Money.fromString("125.00"), rate: VatRate.HR_STANDARD },
        { grossAmount: Money.fromString("125.00"), rate: VatRate.HR_STANDARD },
        { grossAmount: Money.fromString("113.00"), rate: VatRate.HR_REDUCED_13 },
      ]

      const results = VatCalculator.splitByRates(items)

      // Two items at 25%: 200 net, 50 VAT, 250 gross
      const standard = results.get(VatRate.HR_STANDARD)
      expect(standard?.netAmount.toDecimal().toString()).toBe("200")
      expect(standard?.vatAmount.toDecimal().toString()).toBe("50")
      expect(standard?.grossAmount.toDecimal().toString()).toBe("250")

      // One item at 13%: 100 net, 13 VAT, 113 gross
      const reduced = results.get(VatRate.HR_REDUCED_13)
      expect(reduced?.netAmount.toDecimal().toString()).toBe("100")
      expect(reduced?.vatAmount.toDecimal().toString()).toBe("13")
      expect(reduced?.grossAmount.toDecimal().toString()).toBe("113")
    })
  })
})
