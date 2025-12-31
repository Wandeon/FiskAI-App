import { describe, it } from "node:test"
import assert from "node:assert"
import { calculateZKI, validateZKIInput, type ZKIInput } from "../zki"

/**
 * Test suite for ZKI calculation
 *
 * Run with: npm test -- zki.test.ts
 */

describe("ZKI Calculation", () => {
  const validInput: ZKIInput = {
    oib: "12345678903", // Valid test OIB with checksum
    dateTime: new Date("2024-12-15T14:30:25"),
    invoiceNumber: "2024/1-1-1",
    premisesCode: "1",
    deviceCode: "1",
    totalAmount: 125000, // 1250.00 EUR in cents
  }

  describe("calculateZKI", () => {
    it("should calculate ZKI without private key (demo mode)", () => {
      const zki = calculateZKI(validInput)

      assert.ok(zki, "ZKI should be defined")
      assert.strictEqual(zki.length, 32, "ZKI should be 32 characters")
      assert.ok(/^[a-f0-9]{32}$/.test(zki), "ZKI should be lowercase hex")
    })

    it("should calculate consistent ZKI for same input", () => {
      const zki1 = calculateZKI(validInput)
      const zki2 = calculateZKI(validInput)

      assert.strictEqual(zki1, zki2, "Same input should produce same ZKI")
    })

    it("should calculate different ZKI for different inputs", () => {
      const zki1 = calculateZKI(validInput)
      const zki2 = calculateZKI({
        ...validInput,
        invoiceNumber: "2024/1-1-2",
      })

      assert.notStrictEqual(zki1, zki2, "Different inputs should produce different ZKI")
    })

    it("should handle different amounts correctly", () => {
      const zki1 = calculateZKI({ ...validInput, totalAmount: 100000 })
      const zki2 = calculateZKI({ ...validInput, totalAmount: 200000 })

      assert.notStrictEqual(zki1, zki2, "Different amounts should produce different ZKI")
    })
  })

  describe("validateZKIInput", () => {
    it("should validate correct input", () => {
      const result = validateZKIInput(validInput)

      assert.strictEqual(result.valid, true, "Valid input should pass validation")
      assert.strictEqual(result.errors.length, 0, "Valid input should have no errors")
    })

    it("should reject invalid OIB (not 11 digits)", () => {
      const result = validateZKIInput({
        ...validInput,
        oib: "123456789", // only 9 digits
      })

      assert.strictEqual(result.valid, false, "Invalid OIB should fail validation")
      assert.ok(result.errors.includes("Invalid OIB format or checksum"), "Should have OIB error")
    })

    it("should reject OIB with invalid checksum", () => {
      const result = validateZKIInput({
        ...validInput,
        oib: "12345678901", // 11 digits but invalid checksum
      })

      assert.strictEqual(result.valid, false, "Invalid OIB checksum should fail validation")
      assert.ok(result.errors.includes("Invalid OIB format or checksum"), "Should have OIB error")
    })

    it("should reject empty invoice number", () => {
      const result = validateZKIInput({
        ...validInput,
        invoiceNumber: "",
      })

      assert.strictEqual(result.valid, false, "Empty invoice number should fail validation")
      assert.ok(
        result.errors.includes("Invoice number is required"),
        "Should have invoice number error"
      )
    })

    it("should reject zero or negative amounts", () => {
      const result = validateZKIInput({
        ...validInput,
        totalAmount: 0,
      })

      assert.strictEqual(result.valid, false, "Zero amount should fail validation")
      assert.ok(result.errors.includes("Total amount must be positive"), "Should have amount error")
    })

    it("should reject invalid date", () => {
      const result = validateZKIInput({
        ...validInput,
        dateTime: new Date("invalid"),
      })

      assert.strictEqual(result.valid, false, "Invalid date should fail validation")
      assert.ok(result.errors.includes("Invalid date/time"), "Should have date error")
    })
  })
})
