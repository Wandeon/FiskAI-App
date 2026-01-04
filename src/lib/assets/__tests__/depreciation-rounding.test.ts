import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

import { buildDepreciationEntries } from "@/lib/assets/depreciation"

describe("depreciation rounding", () => {
  it("truncates intermediate months and carries remainder into last month", () => {
    const Decimal = Prisma.Decimal

    const entries = buildDepreciationEntries({
      acquisitionDate: new Date("2025-01-01T00:00:00.000Z"),
      acquisitionCost: new Decimal("2500.00"),
      salvageValue: new Decimal("0.00"),
      usefulLifeMonths: 24,
      depreciationMethod: "STRAIGHT_LINE",
      periodMonths: 1,
    })

    expect(entries).toHaveLength(24)
    expect(entries[0]!.amount.toFixed(2)).toBe("104.16")
    expect(entries.at(-1)!.amount.toFixed(2)).toBe("104.32")
    expect(entries.at(-1)!.accumulatedAmount.toFixed(2)).toBe("2500.00")
  })
})
