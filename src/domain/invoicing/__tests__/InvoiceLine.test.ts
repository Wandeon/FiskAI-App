import { describe, it, expect } from "vitest"
import { InvoiceLine } from "../InvoiceLine"
import { InvoiceError } from "../InvoiceError"
import { Money, Quantity, VatRate } from "@/domain/shared"

describe("InvoiceLine", () => {
  describe("creation", () => {
    it("creates with all fields", () => {
      const line = InvoiceLine.create({
        id: "line-123",
        description: "Test Product",
        quantity: Quantity.of(2),
        unitPrice: Money.fromString("100.00"),
        vatRate: VatRate.HR_STANDARD,
        discount: Money.fromString("10.00"),
      })

      expect(line.id).toBe("line-123")
      expect(line.description).toBe("Test Product")
      expect(line.quantity.equals(Quantity.of(2))).toBe(true)
      expect(line.unitPrice.equals(Money.fromString("100.00"))).toBe(true)
      expect(line.vatRate.equals(VatRate.HR_STANDARD)).toBe(true)
      expect(line.discount.equals(Money.fromString("10.00"))).toBe(true)
    })

    it("generates UUID if id not provided", () => {
      const line = InvoiceLine.create({
        description: "Test Product",
        quantity: Quantity.one(),
        unitPrice: Money.fromString("50.00"),
        vatRate: VatRate.HR_STANDARD,
      })

      // UUID format: 8-4-4-4-12 hex digits
      expect(line.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it("throws InvoiceError on empty description", () => {
      expect(() =>
        InvoiceLine.create({
          description: "",
          quantity: Quantity.one(),
          unitPrice: Money.fromString("50.00"),
          vatRate: VatRate.HR_STANDARD,
        })
      ).toThrow(InvoiceError)
      expect(() =>
        InvoiceLine.create({
          description: "",
          quantity: Quantity.one(),
          unitPrice: Money.fromString("50.00"),
          vatRate: VatRate.HR_STANDARD,
        })
      ).toThrow("Line description cannot be empty")
    })

    it("throws InvoiceError on whitespace-only description", () => {
      expect(() =>
        InvoiceLine.create({
          description: "   ",
          quantity: Quantity.one(),
          unitPrice: Money.fromString("50.00"),
          vatRate: VatRate.HR_STANDARD,
        })
      ).toThrow(InvoiceError)
      expect(() =>
        InvoiceLine.create({
          description: "\t\n",
          quantity: Quantity.one(),
          unitPrice: Money.fromString("50.00"),
          vatRate: VatRate.HR_STANDARD,
        })
      ).toThrow("Line description cannot be empty")
    })

    it("trims description", () => {
      const line = InvoiceLine.create({
        description: "  Test Product  ",
        quantity: Quantity.one(),
        unitPrice: Money.fromString("50.00"),
        vatRate: VatRate.HR_STANDARD,
      })

      expect(line.description).toBe("Test Product")
    })

    it("defaults discount to zero", () => {
      const line = InvoiceLine.create({
        description: "Test Product",
        quantity: Quantity.one(),
        unitPrice: Money.fromString("50.00"),
        vatRate: VatRate.HR_STANDARD,
      })

      expect(line.discount.isZero()).toBe(true)
    })
  })

  describe("calculations", () => {
    it("calculates netTotal as unitPrice * quantity", () => {
      const line = InvoiceLine.create({
        description: "Product",
        quantity: Quantity.of(3),
        unitPrice: Money.fromString("25.00"),
        vatRate: VatRate.HR_STANDARD,
      })

      // 25.00 * 3 = 75.00
      expect(line.netTotal().equals(Money.fromString("75.00"))).toBe(true)
    })

    it("calculates netTotal with discount", () => {
      const line = InvoiceLine.create({
        description: "Product",
        quantity: Quantity.of(2),
        unitPrice: Money.fromString("100.00"),
        vatRate: VatRate.HR_STANDARD,
        discount: Money.fromString("20.00"),
      })

      // (100.00 * 2) - 20.00 = 180.00
      expect(line.netTotal().equals(Money.fromString("180.00"))).toBe(true)
    })

    it("calculates vatAmount with 25% rate", () => {
      const line = InvoiceLine.create({
        description: "Product",
        quantity: Quantity.of(2),
        unitPrice: Money.fromString("100.00"),
        vatRate: VatRate.HR_STANDARD, // 25%
      })

      // net = 200.00, vat = 200.00 * 0.25 = 50.00
      expect(line.vatAmount().equals(Money.fromString("50.00"))).toBe(true)
    })

    it("calculates vatAmount with 13% rate", () => {
      const line = InvoiceLine.create({
        description: "Product",
        quantity: Quantity.of(1),
        unitPrice: Money.fromString("100.00"),
        vatRate: VatRate.HR_REDUCED_13, // 13%
      })

      // net = 100.00, vat = 100.00 * 0.13 = 13.00
      expect(line.vatAmount().equals(Money.fromString("13.00"))).toBe(true)
    })

    it("calculates vatAmount with 5% rate", () => {
      const line = InvoiceLine.create({
        description: "Product",
        quantity: Quantity.of(1),
        unitPrice: Money.fromString("100.00"),
        vatRate: VatRate.HR_REDUCED_5, // 5%
      })

      // net = 100.00, vat = 100.00 * 0.05 = 5.00
      expect(line.vatAmount().equals(Money.fromString("5.00"))).toBe(true)
    })

    it("calculates vatAmount as zero with zero rate", () => {
      const line = InvoiceLine.create({
        description: "Product",
        quantity: Quantity.of(2),
        unitPrice: Money.fromString("100.00"),
        vatRate: VatRate.zero(),
      })

      // net = 200.00, vat = 0.00
      expect(line.vatAmount().isZero()).toBe(true)
    })

    it("calculates grossTotal as net + vat", () => {
      const line = InvoiceLine.create({
        description: "Product",
        quantity: Quantity.of(2),
        unitPrice: Money.fromString("100.00"),
        vatRate: VatRate.HR_STANDARD, // 25%
      })

      // net = 200.00, vat = 50.00, gross = 250.00
      expect(line.grossTotal().equals(Money.fromString("250.00"))).toBe(true)
    })

    it("handles complete example: qty=2, price=100.00, rate=25%", () => {
      const line = InvoiceLine.create({
        description: "Test Product",
        quantity: Quantity.of(2),
        unitPrice: Money.fromString("100.00"),
        vatRate: VatRate.HR_STANDARD, // 25%
      })

      expect(line.netTotal().equals(Money.fromString("200.00"))).toBe(true)
      expect(line.vatAmount().equals(Money.fromString("50.00"))).toBe(true)
      expect(line.grossTotal().equals(Money.fromString("250.00"))).toBe(true)
    })

    it("handles decimal quantities", () => {
      const line = InvoiceLine.create({
        description: "Product by weight",
        quantity: Quantity.of("1.5"),
        unitPrice: Money.fromString("10.00"),
        vatRate: VatRate.HR_STANDARD,
      })

      // 10.00 * 1.5 = 15.00
      expect(line.netTotal().equals(Money.fromString("15.00"))).toBe(true)
    })

    it("rounds netTotal correctly", () => {
      const line = InvoiceLine.create({
        description: "Product",
        quantity: Quantity.of(3),
        unitPrice: Money.fromString("33.33"),
        vatRate: VatRate.HR_STANDARD,
      })

      // 33.33 * 3 = 99.99, rounds to 99.99
      expect(line.netTotal().equals(Money.fromString("99.99"))).toBe(true)
    })
  })
})
