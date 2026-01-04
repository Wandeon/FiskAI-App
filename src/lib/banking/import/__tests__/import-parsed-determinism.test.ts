import { vi, describe, it, expect } from "vitest"

// Mock DB - this test uses mocked repository calls
vi.mock("@/lib/db", () => ({ db: {} }))

import { importParsedBankTransactions } from "../import-parsed"

describe("importParsedBankTransactions", () => {
  it("preserves signed amounts and does not coerce to JS number", async () => {
    const importedAt = new Date("2025-03-31T00:00:00.000Z")
    const tx1Date = new Date("2025-03-10T00:00:00.000Z")
    const tx2Date = new Date("2025-03-11T00:00:00.000Z")
    const tx3Date = new Date("2025-03-12T00:00:00.000Z")

    const client = {
      statementImport: {
        create: vi.fn().mockResolvedValue({ id: "statement-import-1" }),
      },
      bankTransaction: {
        createMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
    } as any

    const originalNumber = globalThis.Number
    ;(globalThis as any).Number = () => {
      throw new Error("Number() coercion is forbidden for money computations")
    }

    try {
      await importParsedBankTransactions(
        {
          companyId: "company-1",
          bankAccountId: "bank-1",
          importedBy: "user-1",
          fileName: "camt053.xml",
          importedAt,
          transactions: [
            { date: tx1Date, description: "Incoming payment", amount: "98.00" },
            { date: tx2Date, description: "Incoming payment", amount: "102.00" },
            { date: tx3Date, description: "Naknada banke", amount: "-5.00" },
          ],
        },
        client
      )
    } finally {
      ;(globalThis as any).Number = originalNumber
    }

    expect(client.bankTransaction.createMany).toHaveBeenCalledTimes(1)
    const createManyArgs = client.bankTransaction.createMany.mock.calls[0][0]
    expect(createManyArgs.data).toHaveLength(3)
    expect(createManyArgs.data[2].amount).toBe("-5.00")
  })
})
