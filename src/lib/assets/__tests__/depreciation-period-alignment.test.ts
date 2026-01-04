import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

import { buildDepreciationEntries } from "@/lib/assets/depreciation"

describe("depreciation period alignment", () => {
  it("aligns monthly depreciation periods to calendar months", () => {
    const Decimal = Prisma.Decimal

    const entries = buildDepreciationEntries({
      acquisitionDate: new Date("2026-01-10T12:00:00.000Z"),
      acquisitionCost: new Decimal("2500.00"),
      salvageValue: new Decimal("0.00"),
      usefulLifeMonths: 24,
      depreciationMethod: "STRAIGHT_LINE",
      periodMonths: 1,
    })

    expect(entries[0]!.amount.toFixed(2)).toBe("104.16")

    const first = entries[0]!
    expect(first.periodStart.getFullYear()).toBe(2026)
    expect(first.periodStart.getMonth()).toBe(0)
    expect(first.periodStart.getDate()).toBe(1)

    expect(first.periodEnd.getFullYear()).toBe(2026)
    expect(first.periodEnd.getMonth()).toBe(0)
    expect(first.periodEnd.getDate()).toBe(31)
  })
})
