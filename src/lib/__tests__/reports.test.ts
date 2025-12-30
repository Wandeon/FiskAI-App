import { describe, it } from "node:test"
import assert from "node:assert"
import { iraToCsv, uraToCsv, type IraRow, type UraRow } from "../reports/ura-ira"

describe("URA/IRA Reports CSV", () => {
  it("generates IRA CSV with tax breakdown", () => {
    const rows: IraRow[] = [
      {
        issueDate: new Date("2025-01-01"),
        invoiceNumber: "1-1-1",
        buyerName: "Test Buyer",
        buyerOib: "12345678901",
        netAmount: 100,
        vatAmount: 25,
        totalAmount: 125,
        paidAt: null,
        base25: 100,
        vat25: 25,
        base13: 0,
        vat13: 0,
        base5: 0,
        vat5: 0,
        base0: 0,
      },
    ]

    const csv = iraToCsv(rows)
    assert.ok(csv.includes("Osnovica 25%"), "Missing Base 25% header")
    assert.ok(csv.includes("100.00;25.00;0.00"), "Missing correct row values")
  })

  it("generates URA CSV with tax breakdown", () => {
    const rows: UraRow[] = [
      {
        date: new Date("2025-01-02"),
        documentRef: "Incoming Invoice 123",
        vendorName: "Vendor ABC",
        vendorOib: "98765432109",
        netAmount: 200,
        vatAmount: 26,
        totalAmount: 226,
        vatDeductible: true,
        base25: 0,
        vat25: 0,
        base13: 200,
        vat13: 26,
        base5: 0,
        vat5: 0,
        base0: 0,
      },
    ]

    const csv = uraToCsv(rows)
    assert.ok(csv.includes("Osnovica 13%"), "Missing Base 13% header")
    assert.ok(csv.includes("0.00;0.00;200.00;26.00"), "Missing correct row values")
  })
})
