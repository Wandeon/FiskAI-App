import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

import { calculateVatInputAmounts } from "@/lib/vat/input-vat"

const Decimal = Prisma.Decimal

describe("H1: VAT input determinism", () => {
  it("calculates 50% deductibility without Number() coercion", () => {
    const originalNumber = globalThis.Number
    globalThis.Number = (() => {
      throw new Error("Number() coercion is forbidden for money computations")
    }) as any

    try {
      const { deductibleVatAmount, nonDeductibleVatAmount } = calculateVatInputAmounts(
        { vatDeductible: true } as any,
        { vatAmount: new Decimal("0.30") } as any,
        [{ id: "rule-50", conceptSlug: "vat-deductibility-50", titleHr: null }]
      )

      expect(deductibleVatAmount.toFixed(2)).toBe("0.15")
      expect(nonDeductibleVatAmount.toFixed(2)).toBe("0.15")
      expect(deductibleVatAmount.add(nonDeductibleVatAmount).toFixed(2)).toBe("0.30")
    } finally {
      globalThis.Number = originalNumber
    }
  })
})
