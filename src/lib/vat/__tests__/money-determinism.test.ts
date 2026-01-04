import { describe, it, expect, vi } from "vitest"

// Mock DB - this test uses pure domain logic
vi.mock("@/lib/db", () => ({ db: {} }))

import { computeVatLineTotals } from "../output-calculator"

describe("H1: deterministic VAT money math", () => {
  it("does not exhibit JS float drift (0.1 + 0.2 style)", () => {
    const totals = computeVatLineTotals({
      quantity: "0.1",
      unitPrice: "0.2",
      vatRatePercent: "25",
    })

    expect(totals.netAmount.toString()).toBe("0.02")
    expect(totals.vatAmount.toString()).toBe("0.01")
    expect(totals.totalAmount.toString()).toBe("0.03")
  })

  it("applies consistent rounding policy (line-level, 2dp, half-up)", () => {
    const totals = computeVatLineTotals({
      quantity: "1",
      unitPrice: "0.01",
      vatRatePercent: "25",
    })

    expect(totals.netAmount.toFixed(2)).toBe("0.01")
    expect(totals.vatAmount.toFixed(2)).toBe("0.00")
    expect(totals.totalAmount.toFixed(2)).toBe("0.01")
  })

  it("always satisfies net + vat = total after rounding", () => {
    const totals = computeVatLineTotals({
      quantity: "3",
      unitPrice: "19.99",
      vatRatePercent: "5",
    })

    expect(totals.netAmount.add(totals.vatAmount).equals(totals.totalAmount)).toBe(true)
  })
})
