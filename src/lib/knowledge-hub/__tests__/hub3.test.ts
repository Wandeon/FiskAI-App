// src/lib/knowledge-hub/__tests__/hub3.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { generateHub3Data, formatHub3Amount, validateOIB } from "../hub3"

describe("Hub3 Barcode Generator", () => {
  describe("validateOIB", () => {
    it("should validate correct OIB", () => {
      // Using test OIB with valid checksum
      assert.strictEqual(validateOIB("12345678903"), true)
    })

    it("should reject invalid OIB length", () => {
      assert.strictEqual(validateOIB("123456789"), false)
    })

    it("should reject non-numeric OIB", () => {
      assert.strictEqual(validateOIB("1234567890A"), false)
    })
  })

  describe("formatHub3Amount", () => {
    it("should format 262.51 as 000000000026251", () => {
      assert.strictEqual(formatHub3Amount(262.51), "000000000026251")
    })

    it("should format 1000 as 000000000100000", () => {
      assert.strictEqual(formatHub3Amount(1000), "000000000100000")
    })
  })

  describe("generateHub3Data", () => {
    it("should generate valid Hub3 data string", () => {
      const data = generateHub3Data({
        amount: 262.51,
        payerName: "Ivan Horvat",
        payerAddress: "Ilica 1",
        payerCity: "10000 Zagreb",
        recipientName: "HZZO",
        recipientAddress: "Margaretska 3",
        recipientCity: "10000 Zagreb",
        recipientIBAN: "HR6510010051550100001",
        model: "HR68",
        reference: "1234567890123-12345",
        description: "Doprinos za zdravstveno osiguranje",
      })

      assert.ok(data.startsWith("HRVHUB30"))
      assert.ok(data.includes("HR6510010051550100001"))
    })
  })
})
