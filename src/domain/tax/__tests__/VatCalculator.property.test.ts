// src/domain/tax/__tests__/VatCalculator.property.test.ts
import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { VatCalculator } from "../VatCalculator"
import { Money, VatRate } from "@/domain/shared"

describe("VatCalculator property tests", () => {
  // Croatian VAT rates for testing
  const vatRates = [
    VatRate.HR_STANDARD,
    VatRate.HR_REDUCED_13,
    VatRate.HR_REDUCED_5,
    VatRate.zero(),
  ]

  describe("calculate", () => {
    it("VAT is always non-negative for positive net amounts", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.constantFrom(...vatRates),
          (cents, rate) => {
            const net = Money.fromCents(cents)
            const result = VatCalculator.calculate(net, rate)
            expect(result.vatAmount.isNegative()).toBe(false)
          }
        )
      )
    })

    it("gross always equals net plus VAT", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.constantFrom(...vatRates),
          (cents, rate) => {
            const net = Money.fromCents(cents)
            const result = VatCalculator.calculate(net, rate)

            const expectedGross = result.netAmount.add(result.vatAmount)
            expect(result.grossAmount.equals(expectedGross)).toBe(true)
          }
        )
      )
    })

    it("zero rate produces zero VAT", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10_000_000 }), (cents) => {
          const net = Money.fromCents(cents)
          const result = VatCalculator.calculate(net, VatRate.zero())

          expect(result.vatAmount.isZero()).toBe(true)
          expect(result.grossAmount.equals(result.netAmount)).toBe(true)
        })
      )
    })

    it("netAmount is preserved in result", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.constantFrom(...vatRates),
          (cents, rate) => {
            const net = Money.fromCents(cents)
            const result = VatCalculator.calculate(net, rate)
            expect(result.netAmount.equals(net)).toBe(true)
          }
        )
      )
    })
  })

  describe("calculateFromGross", () => {
    it("extracted amounts sum to gross", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.constantFrom(...vatRates),
          (cents, rate) => {
            const gross = Money.fromCents(cents)
            const result = VatCalculator.calculateFromGross(gross, rate)

            const summed = result.netAmount.add(result.vatAmount)
            expect(summed.equals(gross)).toBe(true)
          }
        )
      )
    })

    it("grossAmount is preserved in result", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.constantFrom(...vatRates),
          (cents, rate) => {
            const gross = Money.fromCents(cents)
            const result = VatCalculator.calculateFromGross(gross, rate)
            expect(result.grossAmount.equals(gross)).toBe(true)
          }
        )
      )
    })

    it("zero rate produces net equal to gross", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10_000_000 }), (cents) => {
          const gross = Money.fromCents(cents)
          const result = VatCalculator.calculateFromGross(gross, VatRate.zero())

          expect(result.netAmount.equals(gross)).toBe(true)
          expect(result.vatAmount.isZero()).toBe(true)
        })
      )
    })
  })

  describe("round-trip consistency", () => {
    it("calculate then extractFromGross recovers original net (within rounding)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 1_000_000 }), // Min 1.00 to reduce rounding edge cases
          fc.constantFrom(VatRate.HR_STANDARD, VatRate.HR_REDUCED_13, VatRate.HR_REDUCED_5),
          (cents, rate) => {
            const originalNet = Money.fromCents(cents)

            // Forward: net -> gross
            const calculated = VatCalculator.calculate(originalNet, rate)
            // Reverse: gross -> net
            const extracted = VatCalculator.calculateFromGross(calculated.grossAmount, rate)

            // Allow 1 cent tolerance for rounding
            const diff = Math.abs(originalNet.toCents() - extracted.netAmount.toCents())
            expect(diff).toBeLessThanOrEqual(1)
          }
        )
      )
    })
  })

  describe("calculateTotal", () => {
    it("empty items produces zero VAT", () => {
      const result = VatCalculator.calculateTotal([])
      expect(result.isZero()).toBe(true)
    })

    it("single item equals individual calculation", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1_000_000 }),
          fc.constantFrom(...vatRates),
          (cents, rate) => {
            const net = Money.fromCents(cents)
            const total = VatCalculator.calculateTotal([{ netAmount: net, rate }])
            const individual = VatCalculator.calculate(net, rate)

            expect(total.equals(individual.vatAmount)).toBe(true)
          }
        )
      )
    })

    it("total VAT is sum of individual VAT amounts", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              cents: fc.integer({ min: 0, max: 100_000 }),
              rateIndex: fc.integer({ min: 0, max: 3 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (items) => {
            const vatItems = items.map((item) => ({
              netAmount: Money.fromCents(item.cents),
              rate: vatRates[item.rateIndex],
            }))

            const total = VatCalculator.calculateTotal(vatItems)

            // Calculate expected by summing individual VATs
            let expected = Money.zero()
            for (const item of vatItems) {
              const result = VatCalculator.calculate(item.netAmount, item.rate)
              expected = expected.add(result.vatAmount)
            }

            expect(total.equals(expected)).toBe(true)
          }
        )
      )
    })
  })

  describe("splitByRates", () => {
    it("all results sum to input totals", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              cents: fc.integer({ min: 1, max: 100_000 }),
              rateIndex: fc.integer({ min: 0, max: 3 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (items) => {
            const grossItems = items.map((item) => ({
              grossAmount: Money.fromCents(item.cents),
              rate: vatRates[item.rateIndex],
            }))

            const results = VatCalculator.splitByRates(grossItems)

            // Sum all gross amounts from results
            let totalGross = Money.zero()
            for (const result of results.values()) {
              totalGross = totalGross.add(result.grossAmount)
            }

            // Sum all input gross amounts
            let expectedGross = Money.zero()
            for (const item of grossItems) {
              expectedGross = expectedGross.add(item.grossAmount)
            }

            expect(totalGross.equals(expectedGross)).toBe(true)
          }
        )
      )
    })

    it("each rate group sums correctly", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100_000 }), { minLength: 2, maxLength: 5 }),
          (centAmounts) => {
            // All items at same rate
            const rate = VatRate.HR_STANDARD
            const grossItems = centAmounts.map((cents) => ({
              grossAmount: Money.fromCents(cents),
              rate,
            }))

            const results = VatCalculator.splitByRates(grossItems)
            const grouped = results.get(rate)!

            // Each grouped result should have gross = net + vat
            expect(grouped.netAmount.add(grouped.vatAmount).equals(grouped.grossAmount)).toBe(true)
          }
        )
      )
    })
  })
})
