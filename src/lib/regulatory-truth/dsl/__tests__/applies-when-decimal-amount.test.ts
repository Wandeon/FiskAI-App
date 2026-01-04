import { describe, it, expect } from "vitest"

import { evaluateAppliesWhen } from "@/lib/regulatory-truth/dsl/applies-when"

describe("H1: applies-when supports decimal string amounts", () => {
  it("evaluates cmp against txn.amount when amount is a decimal string", () => {
    const predicate = {
      op: "cmp",
      field: "txn.amount",
      cmp: "gte",
      value: 1000,
    } as const

    const context = {
      asOf: "2026-01-01T00:00:00.000Z",
      entity: {
        type: "DOO",
        vat: { status: "IN_VAT" },
        location: { country: "HR" },
      },
      txn: {
        kind: "PURCHASE",
        amount: "1000.00",
        currency: "EUR",
        date: "2026-01-01T00:00:00.000Z",
      },
    } as any

    expect(evaluateAppliesWhen(predicate as any, context)).toBe(true)
  })

  it("evaluates between against txn.amount when amount is a decimal string", () => {
    const predicate = {
      op: "between",
      field: "txn.amount",
      gte: 1000,
      lte: 2000,
    } as const

    const context = {
      asOf: "2026-01-01T00:00:00.000Z",
      entity: {
        type: "DOO",
        vat: { status: "IN_VAT" },
        location: { country: "HR" },
      },
      txn: {
        kind: "PURCHASE",
        amount: "1500.00",
        currency: "EUR",
        date: "2026-01-01T00:00:00.000Z",
      },
    } as any

    expect(evaluateAppliesWhen(predicate as any, context)).toBe(true)
  })

  it("evaluates eq against txn.amount when amount is a decimal string", () => {
    const predicate = {
      op: "cmp",
      field: "txn.amount",
      cmp: "eq",
      value: 1000,
    } as const

    const context = {
      asOf: "2026-01-01T00:00:00.000Z",
      entity: {
        type: "DOO",
        vat: { status: "IN_VAT" },
        location: { country: "HR" },
      },
      txn: {
        kind: "PURCHASE",
        amount: "1000.00",
        currency: "EUR",
        date: "2026-01-01T00:00:00.000Z",
      },
    } as any

    expect(evaluateAppliesWhen(predicate as any, context)).toBe(true)
  })
})
