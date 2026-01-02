import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { VatBreakdown } from "../VatBreakdown"
import { Money, VatRate } from "@/domain/shared"

describe("VatBreakdown property tests", () => {
  it("total gross equals sum of base + VAT", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000000 }), { minLength: 1, maxLength: 10 }),
        (centAmounts) => {
          let breakdown = VatBreakdown.empty()
          for (const cents of centAmounts) {
            breakdown = breakdown.addLine(Money.fromCents(cents), VatRate.HR_STANDARD)
          }
          const totalBase = breakdown.totalBase()
          const totalVat = breakdown.totalVat()
          const totalGross = breakdown.totalGross()
          expect(totalBase.add(totalVat).equals(totalGross)).toBe(true)
        }
      )
    )
  })

  it("VAT is always non-negative", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000000 }), (cents) => {
        const breakdown = VatBreakdown.empty().addLine(Money.fromCents(cents), VatRate.HR_STANDARD)
        expect(breakdown.totalVat().isNegative()).toBe(false)
      })
    )
  })

  it("25% VAT rate produces approximately 25% of base", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 100000 }), (cents) => {
        const base = Money.fromCents(cents)
        const breakdown = VatBreakdown.empty().addLine(base, VatRate.HR_STANDARD)
        const vat = breakdown.totalVat()
        const expectedVat = base.multiply("0.25").round()
        expect(vat.equals(expectedVat)).toBe(true)
      })
    )
  })

  it("lineCount matches number of addLine calls", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 }), (count) => {
        let breakdown = VatBreakdown.empty()
        for (let i = 0; i < count; i++) {
          breakdown = breakdown.addLine(Money.fromCents(100), VatRate.HR_STANDARD)
        }
        expect(breakdown.lineCount()).toBe(count)
      })
    )
  })

  it("getLines length matches lineCount", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 }), (count) => {
        let breakdown = VatBreakdown.empty()
        for (let i = 0; i < count; i++) {
          breakdown = breakdown.addLine(Money.fromCents(100), VatRate.HR_STANDARD)
        }
        expect(breakdown.getLines().length).toBe(breakdown.lineCount())
      })
    )
  })

  it("byRate groups all lines correctly", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 10 }),
        (centAmounts) => {
          let breakdown = VatBreakdown.empty()
          let expectedBase = Money.zero()

          for (const cents of centAmounts) {
            const amount = Money.fromCents(cents)
            breakdown = breakdown.addLine(amount, VatRate.HR_STANDARD)
            expectedBase = expectedBase.add(amount)
          }

          const grouped = breakdown.byRate()
          const rate25 = grouped.get(25)

          expect(rate25).toBeDefined()
          expect(rate25?.base.equals(expectedBase)).toBe(true)
        }
      )
    )
  })

  it("total base equals sum of all line base amounts", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 0, maxLength: 15 }),
        (centAmounts) => {
          let breakdown = VatBreakdown.empty()
          let expectedTotal = Money.zero()

          for (const cents of centAmounts) {
            const amount = Money.fromCents(cents)
            breakdown = breakdown.addLine(amount, VatRate.HR_STANDARD)
            expectedTotal = expectedTotal.add(amount)
          }

          expect(breakdown.totalBase().equals(expectedTotal)).toBe(true)
        }
      )
    )
  })

  it("mixed rates still sum correctly", () => {
    const rates = [VatRate.HR_STANDARD, VatRate.HR_REDUCED_13, VatRate.HR_REDUCED_5, VatRate.zero()]

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            cents: fc.integer({ min: 1, max: 10000 }),
            rateIndex: fc.integer({ min: 0, max: 3 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (items) => {
          let breakdown = VatBreakdown.empty()

          for (const item of items) {
            breakdown = breakdown.addLine(Money.fromCents(item.cents), rates[item.rateIndex])
          }

          // Total gross should always equal base + VAT
          const totalGross = breakdown.totalGross()
          const expectedGross = breakdown.totalBase().add(breakdown.totalVat())
          expect(totalGross.equals(expectedGross)).toBe(true)
        }
      )
    )
  })

  it("zero-rate VAT contributes zero to totalVat", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000000 }), (cents) => {
        const breakdown = VatBreakdown.empty().addLine(Money.fromCents(cents), VatRate.zero())
        expect(breakdown.totalVat().isZero()).toBe(true)
      })
    )
  })

  it("addLine returns new instance (immutability)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000000 }), (cents) => {
        const original = VatBreakdown.empty()
        const updated = original.addLine(Money.fromCents(cents), VatRate.HR_STANDARD)
        expect(original).not.toBe(updated)
        expect(original.lineCount()).toBe(0)
        expect(updated.lineCount()).toBe(1)
      })
    )
  })
})
