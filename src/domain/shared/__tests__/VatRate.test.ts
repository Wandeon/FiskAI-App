import { describe, it, expect } from "vitest"
import { VatRate } from "../VatRate"
import { Money } from "../Money"

describe("VatRate", () => {
  describe("creation", () => {
    it("creates standard rate", () => {
      const rate = VatRate.standard("0.25", "PDV 25%")
      expect(rate.rateAsPercentage()).toBe(25)
      expect(rate.label).toBe("PDV 25%")
      expect(rate.type).toBe("standard")
    })

    it("creates reduced rate", () => {
      const rate = VatRate.reduced("0.13", "PDV 13%")
      expect(rate.rateAsPercentage()).toBe(13)
      expect(rate.type).toBe("reduced")
    })

    it("creates zero rate", () => {
      const rate = VatRate.zero()
      expect(rate.rateAsPercentage()).toBe(0)
      expect(rate.type).toBe("zero")
    })

    it("creates exempt rate", () => {
      const rate = VatRate.exempt()
      expect(rate.rateAsPercentage()).toBe(0)
      expect(rate.type).toBe("exempt")
    })
  })

  describe("Croatian rates", () => {
    it("has correct HR standard rate", () => {
      expect(VatRate.HR_STANDARD.rateAsPercentage()).toBe(25)
    })

    it("has correct HR reduced 13% rate", () => {
      expect(VatRate.HR_REDUCED_13.rateAsPercentage()).toBe(13)
    })

    it("has correct HR reduced 5% rate", () => {
      expect(VatRate.HR_REDUCED_5.rateAsPercentage()).toBe(5)
    })
  })

  describe("VAT calculation", () => {
    it("calculates VAT from net amount", () => {
      const rate = VatRate.HR_STANDARD // 25%
      const net = Money.fromString("100.00")
      const vat = rate.calculateVat(net)
      expect(vat.toDecimal().toString()).toBe("25")
    })

    it("calculates gross from net amount", () => {
      const rate = VatRate.HR_STANDARD // 25%
      const net = Money.fromString("100.00")
      const gross = rate.calculateGross(net)
      expect(gross.toDecimal().toString()).toBe("125")
    })

    it("calculates zero VAT for zero rate", () => {
      const rate = VatRate.zero()
      const net = Money.fromString("100.00")
      const vat = rate.calculateVat(net)
      expect(vat.isZero()).toBe(true)
    })

    it("handles rounding correctly", () => {
      const rate = VatRate.HR_STANDARD // 25%
      const net = Money.fromString("99.99")
      const vat = rate.calculateVat(net)
      // 99.99 * 0.25 = 24.9975 -> rounds to 25.00
      expect(vat.toDecimal().toString()).toBe("25")
    })
  })

  describe("VAT extraction", () => {
    it("extracts net from gross amount", () => {
      const rate = VatRate.HR_STANDARD // 25%
      const gross = Money.fromString("125.00")
      const net = rate.extractNet(gross)
      expect(net.toDecimal().toString()).toBe("100")
    })

    it("extracts VAT from gross amount", () => {
      const rate = VatRate.HR_STANDARD // 25%
      const gross = Money.fromString("125.00")
      const vat = rate.extractVat(gross)
      expect(vat.toDecimal().toString()).toBe("25")
    })

    it("handles 13% rate extraction", () => {
      const rate = VatRate.HR_REDUCED_13 // 13%
      const gross = Money.fromString("113.00")
      const net = rate.extractNet(gross)
      expect(net.toDecimal().toString()).toBe("100")
    })
  })

  describe("comparison", () => {
    it("equals works correctly", () => {
      const a = VatRate.standard("0.25", "Rate A")
      const b = VatRate.standard("0.25", "Rate B")
      const c = VatRate.standard("0.20", "Rate C")
      expect(a.equals(b)).toBe(true)
      expect(a.equals(c)).toBe(false)
    })
  })
})
