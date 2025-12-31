// src/lib/pos/__tests__/payment-qr.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { generatePosPaymentQR, type PosPaymentQRInput } from "../payment-qr"

describe("generatePosPaymentQR", () => {
  const validInput: PosPaymentQRInput = {
    sellerName: "Test Company d.o.o.",
    sellerAddress: "Testna ulica 1",
    sellerCity: "Zagreb",
    sellerIban: "HR12 3456 7890 1234 5678 9",
    invoiceNumber: "2025-1-1-00001",
    amount: 125.5,
  }

  it("should generate a data URL", async () => {
    const result = await generatePosPaymentQR(validInput)
    assert.ok(result.startsWith("data:image/png;base64,"), "Should return PNG data URL")
  })

  it("should handle optional buyer info", async () => {
    const inputWithBuyer: PosPaymentQRInput = {
      ...validInput,
      buyerName: "Kupac d.o.o.",
      buyerAddress: "Kupčeva ulica 2",
      buyerCity: "Split",
    }
    const result = await generatePosPaymentQR(inputWithBuyer)
    assert.ok(result.startsWith("data:image/png;base64,"), "Should return PNG data URL")
  })
})
