import { vi, describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

import { emitAssetCandidates } from "../asset-candidates"

describe("emitAssetCandidates", () => {
  it("does not coerce money to JS number", async () => {
    const Decimal = Prisma.Decimal
    const tx = {
      fixedAssetCandidate: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as any

    const expense = {
      id: "expense-1",
      companyId: "company-1",
      currency: "EUR",
    } as any

    const lines = [
      {
        id: "line-1",
        description: "Laptop",
        totalAmount: new Decimal("3000.00"),
      },
    ] as any

    const originalNumber = globalThis.Number
    ;(globalThis as any).Number = () => {
      throw new Error("Number() coercion is forbidden for money computations")
    }

    try {
      await expect(emitAssetCandidates(tx, { expense, lines })).resolves.toBeUndefined()
    } finally {
      ;(globalThis as any).Number = originalNumber
    }

    expect(tx.fixedAssetCandidate.createMany).toHaveBeenCalledTimes(1)
  })
})
