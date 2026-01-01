import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { Money } from "../Money"

describe("Money property tests", () => {
  it("addition is commutative", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        const m1 = Money.fromCents(a)
        const m2 = Money.fromCents(b)
        expect(m1.add(m2).equals(m2.add(m1))).toBe(true)
      })
    )
  })

  it("addition is associative", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), fc.integer(), (a, b, c) => {
        const m1 = Money.fromCents(a)
        const m2 = Money.fromCents(b)
        const m3 = Money.fromCents(c)
        expect(
          m1
            .add(m2)
            .add(m3)
            .equals(m1.add(m2.add(m3)))
        ).toBe(true)
      })
    )
  })

  it("zero is identity for addition", () => {
    fc.assert(
      fc.property(fc.integer(), (a) => {
        const money = Money.fromCents(a)
        expect(money.add(Money.zero()).equals(money)).toBe(true)
      })
    )
  })

  it("subtract then add returns original", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        const m1 = Money.fromCents(a)
        const m2 = Money.fromCents(b)
        expect(m1.subtract(m2).add(m2).equals(m1)).toBe(true)
      })
    )
  })

  it("multiply by 1 is identity", () => {
    fc.assert(
      fc.property(fc.integer(), (a) => {
        const money = Money.fromCents(a)
        expect(money.multiply(1).equals(money)).toBe(true)
      })
    )
  })

  it("toCents then fromCents roundtrips", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000000000, max: 1000000000 }), (cents) => {
        const money = Money.fromCents(cents)
        expect(Money.fromCents(money.toCents()).equals(money)).toBe(true)
      })
    )
  })

  it("multiply by 0 gives zero", () => {
    fc.assert(
      fc.property(fc.integer(), (a) => {
        const money = Money.fromCents(a)
        expect(money.multiply(0).isZero()).toBe(true)
      })
    )
  })

  it("negative of negative is original", () => {
    fc.assert(
      fc.property(fc.integer(), (a) => {
        const money = Money.fromCents(a)
        expect(money.multiply(-1).multiply(-1).equals(money)).toBe(true)
      })
    )
  })
})
