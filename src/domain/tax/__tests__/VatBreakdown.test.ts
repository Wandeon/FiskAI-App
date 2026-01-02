import { describe, it, expect } from "vitest"
import { VatBreakdown } from "../VatBreakdown"
import { Money, VatRate } from "@/domain/shared"

describe("VatBreakdown", () => {
  describe("addLine", () => {
    it("adds line with calculated VAT", () => {
      const breakdown = VatBreakdown.empty()
      const baseAmount = Money.fromString("100.00")

      const updated = breakdown.addLine(baseAmount, VatRate.HR_STANDARD)

      const lines = updated.getLines()
      expect(lines).toHaveLength(1)
      expect(lines[0].baseAmount.equals(baseAmount)).toBe(true)
      expect(lines[0].vatRate.equals(VatRate.HR_STANDARD)).toBe(true)
      expect(lines[0].vatAmount.toDecimal().toString()).toBe("25")
    })

    it("adds multiple lines with different rates", () => {
      const breakdown = VatBreakdown.empty()
        .addLine(Money.fromString("100.00"), VatRate.HR_STANDARD)
        .addLine(Money.fromString("100.00"), VatRate.HR_REDUCED_13)
        .addLine(Money.fromString("100.00"), VatRate.HR_REDUCED_5)

      expect(breakdown.getLines()).toHaveLength(3)
    })

    it("returns a new instance (immutability)", () => {
      const original = VatBreakdown.empty()
      const updated = original.addLine(Money.fromString("100.00"), VatRate.HR_STANDARD)

      expect(original.lineCount()).toBe(0)
      expect(updated.lineCount()).toBe(1)
      expect(original).not.toBe(updated)
    })
  })

  describe("getLines", () => {
    it("returns copy of lines (not the original array)", () => {
      const breakdown = VatBreakdown.empty().addLine(
        Money.fromString("100.00"),
        VatRate.HR_STANDARD
      )

      const lines1 = breakdown.getLines()
      const lines2 = breakdown.getLines()

      expect(lines1).not.toBe(lines2)
      expect(lines1).toHaveLength(lines2.length)
    })

    it("returns empty array for new breakdown", () => {
      const breakdown = VatBreakdown.empty()
      expect(breakdown.getLines()).toHaveLength(0)
    })
  })

  describe("totalBase", () => {
    it("sums all base amounts", () => {
      const breakdown = VatBreakdown.empty()
        .addLine(Money.fromString("100.00"), VatRate.HR_STANDARD)
        .addLine(Money.fromString("200.00"), VatRate.HR_REDUCED_13)
        .addLine(Money.fromString("50.00"), VatRate.HR_REDUCED_5)

      const totalBase = breakdown.totalBase()

      expect(totalBase.toDecimal().toString()).toBe("350")
    })

    it("returns zero for empty breakdown", () => {
      const breakdown = VatBreakdown.empty()
      expect(breakdown.totalBase().isZero()).toBe(true)
    })
  })

  describe("totalVat", () => {
    it("sums all VAT amounts", () => {
      const breakdown = VatBreakdown.empty()
        .addLine(Money.fromString("100.00"), VatRate.HR_STANDARD) // 25 VAT
        .addLine(Money.fromString("100.00"), VatRate.HR_REDUCED_13) // 13 VAT
        .addLine(Money.fromString("100.00"), VatRate.HR_REDUCED_5) // 5 VAT

      const totalVat = breakdown.totalVat()

      expect(totalVat.toDecimal().toString()).toBe("43")
    })

    it("returns zero for empty breakdown", () => {
      const breakdown = VatBreakdown.empty()
      expect(breakdown.totalVat().isZero()).toBe(true)
    })

    it("returns zero for zero-rate items", () => {
      const breakdown = VatBreakdown.empty()
        .addLine(Money.fromString("100.00"), VatRate.zero())
        .addLine(Money.fromString("200.00"), VatRate.zero())

      expect(breakdown.totalVat().isZero()).toBe(true)
    })
  })

  describe("totalGross", () => {
    it("equals base plus VAT", () => {
      const breakdown = VatBreakdown.empty()
        .addLine(Money.fromString("100.00"), VatRate.HR_STANDARD) // 100 + 25 = 125
        .addLine(Money.fromString("100.00"), VatRate.HR_REDUCED_13) // 100 + 13 = 113

      const totalGross = breakdown.totalGross()

      // 200 base + 38 VAT = 238
      expect(totalGross.toDecimal().toString()).toBe("238")
    })

    it("equals sum of base and VAT totals", () => {
      const breakdown = VatBreakdown.empty()
        .addLine(Money.fromString("100.00"), VatRate.HR_STANDARD)
        .addLine(Money.fromString("200.00"), VatRate.HR_REDUCED_13)

      const totalBase = breakdown.totalBase()
      const totalVat = breakdown.totalVat()
      const totalGross = breakdown.totalGross()

      expect(totalBase.add(totalVat).equals(totalGross)).toBe(true)
    })

    it("returns zero for empty breakdown", () => {
      const breakdown = VatBreakdown.empty()
      expect(breakdown.totalGross().isZero()).toBe(true)
    })
  })

  describe("byRate", () => {
    it("groups lines by VAT rate correctly", () => {
      const breakdown = VatBreakdown.empty()
        .addLine(Money.fromString("100.00"), VatRate.HR_STANDARD)
        .addLine(Money.fromString("200.00"), VatRate.HR_STANDARD)
        .addLine(Money.fromString("100.00"), VatRate.HR_REDUCED_13)

      const grouped = breakdown.byRate()

      // 25% rate: 300 base, 75 VAT
      const standard = grouped.get(25)
      expect(standard?.base.toDecimal().toString()).toBe("300")
      expect(standard?.vat.toDecimal().toString()).toBe("75")

      // 13% rate: 100 base, 13 VAT
      const reduced = grouped.get(13)
      expect(reduced?.base.toDecimal().toString()).toBe("100")
      expect(reduced?.vat.toDecimal().toString()).toBe("13")
    })

    it("returns empty map for empty breakdown", () => {
      const breakdown = VatBreakdown.empty()
      const grouped = breakdown.byRate()

      expect(grouped.size).toBe(0)
    })

    it("handles all Croatian rates", () => {
      const breakdown = VatBreakdown.empty()
        .addLine(Money.fromString("100.00"), VatRate.HR_STANDARD)
        .addLine(Money.fromString("100.00"), VatRate.HR_REDUCED_13)
        .addLine(Money.fromString("100.00"), VatRate.HR_REDUCED_5)
        .addLine(Money.fromString("100.00"), VatRate.zero())

      const grouped = breakdown.byRate()

      expect(grouped.size).toBe(4)
      expect(grouped.has(25)).toBe(true)
      expect(grouped.has(13)).toBe(true)
      expect(grouped.has(5)).toBe(true)
      expect(grouped.has(0)).toBe(true)
    })
  })

  describe("lineCount", () => {
    it("returns number of lines added", () => {
      let breakdown = VatBreakdown.empty()

      expect(breakdown.lineCount()).toBe(0)

      breakdown = breakdown.addLine(Money.fromString("100.00"), VatRate.HR_STANDARD)
      expect(breakdown.lineCount()).toBe(1)

      breakdown = breakdown.addLine(Money.fromString("100.00"), VatRate.HR_REDUCED_13)
      expect(breakdown.lineCount()).toBe(2)

      breakdown = breakdown.addLine(Money.fromString("100.00"), VatRate.HR_REDUCED_5)
      expect(breakdown.lineCount()).toBe(3)
    })
  })

  describe("empty breakdown", () => {
    it("has zero totals", () => {
      const breakdown = VatBreakdown.empty()

      expect(breakdown.totalBase().isZero()).toBe(true)
      expect(breakdown.totalVat().isZero()).toBe(true)
      expect(breakdown.totalGross().isZero()).toBe(true)
      expect(breakdown.lineCount()).toBe(0)
      expect(breakdown.getLines()).toHaveLength(0)
      expect(breakdown.byRate().size).toBe(0)
    })
  })

  describe("fromLines", () => {
    it("creates VatBreakdown from array of lines", () => {
      const lines = [
        {
          vatRate: VatRate.HR_STANDARD,
          baseAmount: Money.fromString("100.00"),
          vatAmount: Money.fromString("25.00"),
        },
        {
          vatRate: VatRate.HR_REDUCED_13,
          baseAmount: Money.fromString("100.00"),
          vatAmount: Money.fromString("13.00"),
        },
      ]

      const breakdown = VatBreakdown.fromLines(lines)

      expect(breakdown.lineCount()).toBe(2)
      expect(breakdown.totalBase().toDecimal().toString()).toBe("200")
      expect(breakdown.totalVat().toDecimal().toString()).toBe("38")
    })
  })
})
