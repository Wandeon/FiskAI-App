// src/domain/invoicing/__tests__/Invoice.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { Invoice, InvoiceProps } from "../Invoice"
import { InvoiceId } from "../InvoiceId"
import { InvoiceNumber } from "../InvoiceNumber"
import { InvoiceStatus } from "../InvoiceStatus"
import { InvoiceLine } from "../InvoiceLine"
import { InvoiceError } from "../InvoiceError"
import { Money, Quantity, VatRate } from "@/domain/shared"

function createTestLine(
  overrides: Partial<Parameters<typeof InvoiceLine.create>[0]> = {}
): InvoiceLine {
  return InvoiceLine.create({
    description: "Test Item",
    quantity: Quantity.of(2),
    unitPrice: Money.fromString("100.00"),
    vatRate: VatRate.HR_STANDARD,
    ...overrides,
  })
}

function createTestInvoiceNumber(): InvoiceNumber {
  return InvoiceNumber.create(1, 1, 1, 2025)
}

describe("Invoice", () => {
  describe("Creation", () => {
    it("creates a draft invoice with empty lines and version 1", () => {
      const invoice = Invoice.create("buyer-123", "seller-456")

      expect(invoice.status).toBe(InvoiceStatus.DRAFT)
      expect(invoice.buyerId).toBe("buyer-123")
      expect(invoice.sellerId).toBe("seller-456")
      expect(invoice.getLines()).toHaveLength(0)
      expect(invoice.version).toBe(1)
      expect(invoice.id).toBeDefined()
      expect(invoice.invoiceNumber).toBeUndefined()
      expect(invoice.issueDate).toBeUndefined()
      expect(invoice.dueDate).toBeUndefined()
      expect(invoice.jir).toBeUndefined()
      expect(invoice.zki).toBeUndefined()
    })

    it("generates a unique ID for each invoice", () => {
      const invoice1 = Invoice.create("buyer", "seller")
      const invoice2 = Invoice.create("buyer", "seller")

      expect(invoice1.id.toString()).not.toBe(invoice2.id.toString())
    })
  })

  describe("Adding lines", () => {
    it("adds line to draft invoice and increments version", () => {
      const invoice = Invoice.create("buyer", "seller")
      const line = createTestLine()

      invoice.addLine(line)

      expect(invoice.getLines()).toHaveLength(1)
      expect(invoice.version).toBe(2)
    })

    it("can add multiple lines", () => {
      const invoice = Invoice.create("buyer", "seller")

      invoice.addLine(createTestLine({ description: "Item 1" }))
      invoice.addLine(createTestLine({ description: "Item 2" }))

      expect(invoice.getLines()).toHaveLength(2)
      expect(invoice.version).toBe(3)
    })

    it("throws when adding line to non-draft invoice", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())
      invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))

      expect(() => invoice.addLine(createTestLine())).toThrow(InvoiceError)
      expect(() => invoice.addLine(createTestLine())).toThrow("not in DRAFT status")
    })
  })

  describe("Removing lines", () => {
    it("removes line from draft invoice and increments version", () => {
      const invoice = Invoice.create("buyer", "seller")
      const line = createTestLine()
      invoice.addLine(line)

      invoice.removeLine(line.id)

      expect(invoice.getLines()).toHaveLength(0)
      expect(invoice.version).toBe(3)
    })

    it("throws when line not found", () => {
      const invoice = Invoice.create("buyer", "seller")

      expect(() => invoice.removeLine("nonexistent")).toThrow(InvoiceError)
      expect(() => invoice.removeLine("nonexistent")).toThrow("not found")
    })

    it("throws when removing line from non-draft invoice", () => {
      const invoice = Invoice.create("buyer", "seller")
      const line = createTestLine()
      invoice.addLine(line)
      invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))

      expect(() => invoice.removeLine(line.id)).toThrow(InvoiceError)
      expect(() => invoice.removeLine(line.id)).toThrow("not in DRAFT status")
    })
  })

  describe("updateBuyer", () => {
    it("updates buyer in draft invoice and increments version", () => {
      const invoice = Invoice.create("old-buyer", "seller")

      invoice.updateBuyer("new-buyer")

      expect(invoice.buyerId).toBe("new-buyer")
      expect(invoice.version).toBe(2)
    })

    it("throws when updating buyer on non-draft invoice", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())
      invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))

      expect(() => invoice.updateBuyer("new-buyer")).toThrow(InvoiceError)
      expect(() => invoice.updateBuyer("new-buyer")).toThrow("not in DRAFT status")
    })
  })

  describe("Calculations", () => {
    it("calculates netTotal as sum of line net totals", () => {
      const invoice = Invoice.create("buyer", "seller")
      // Line 1: 2 x 100.00 = 200.00 net
      invoice.addLine(
        createTestLine({
          quantity: Quantity.of(2),
          unitPrice: Money.fromString("100.00"),
        })
      )
      // Line 2: 3 x 50.00 = 150.00 net
      invoice.addLine(
        createTestLine({
          quantity: Quantity.of(3),
          unitPrice: Money.fromString("50.00"),
        })
      )

      // 200 + 150 = 350
      expect(invoice.netTotal().toDecimal().toNumber()).toBe(350)
    })

    it("calculates vatTotal as sum of line VAT amounts", () => {
      const invoice = Invoice.create("buyer", "seller")
      // Line: 2 x 100.00 = 200.00 net, VAT 25% = 50.00
      invoice.addLine(
        createTestLine({
          quantity: Quantity.of(2),
          unitPrice: Money.fromString("100.00"),
          vatRate: VatRate.HR_STANDARD, // 25%
        })
      )

      expect(invoice.vatTotal().toDecimal().toNumber()).toBe(50)
    })

    it("calculates grossTotal as net plus VAT", () => {
      const invoice = Invoice.create("buyer", "seller")
      // Line: 2 x 100.00 = 200.00 net, VAT 25% = 50.00, gross = 250.00
      invoice.addLine(
        createTestLine({
          quantity: Quantity.of(2),
          unitPrice: Money.fromString("100.00"),
          vatRate: VatRate.HR_STANDARD, // 25%
        })
      )

      expect(invoice.grossTotal().toDecimal().toNumber()).toBe(250)
    })

    it("returns zero totals for invoice with no lines", () => {
      const invoice = Invoice.create("buyer", "seller")

      expect(invoice.netTotal().isZero()).toBe(true)
      expect(invoice.vatTotal().isZero()).toBe(true)
      expect(invoice.grossTotal().isZero()).toBe(true)
    })
  })

  describe("Issue", () => {
    it("issues invoice with invoice number and dates", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())
      const invoiceNumber = createTestInvoiceNumber()
      const issueDate = new Date("2025-01-01")
      const dueDate = new Date("2025-01-15")

      invoice.issue(invoiceNumber, issueDate, dueDate)

      expect(invoice.status).toBe(InvoiceStatus.PENDING_FISCALIZATION)
      expect(invoice.invoiceNumber).toBe(invoiceNumber)
      expect(invoice.issueDate).toBe(issueDate)
      expect(invoice.dueDate).toBe(dueDate)
    })

    it("throws when issuing invoice with no lines", () => {
      const invoice = Invoice.create("buyer", "seller")

      expect(() =>
        invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))
      ).toThrow(InvoiceError)
      expect(() =>
        invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))
      ).toThrow("no lines")
    })

    it("throws when due date is before issue date", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())

      expect(() =>
        invoice.issue(createTestInvoiceNumber(), new Date("2025-01-15"), new Date("2025-01-01"))
      ).toThrow(InvoiceError)
      expect(() =>
        invoice.issue(createTestInvoiceNumber(), new Date("2025-01-15"), new Date("2025-01-01"))
      ).toThrow("Due date cannot be before issue date")
    })

    it("throws when issuing non-draft invoice", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())
      invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))

      expect(() =>
        invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))
      ).toThrow(InvoiceError)
    })
  })

  describe("Fiscalize", () => {
    let invoice: Invoice

    beforeEach(() => {
      invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())
      invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))
    })

    it("fiscalizes invoice with JIR and ZKI", () => {
      invoice.fiscalize("jir-12345", "zki-67890")

      expect(invoice.status).toBe(InvoiceStatus.FISCALIZED)
      expect(invoice.jir).toBe("jir-12345")
      expect(invoice.zki).toBe("zki-67890")
      expect(invoice.fiscalizedAt).toBeDefined()
    })

    it("throws when JIR is empty", () => {
      expect(() => invoice.fiscalize("", "zki-67890")).toThrow(InvoiceError)
      expect(() => invoice.fiscalize("", "zki-67890")).toThrow("JIR cannot be empty")
    })

    it("throws when JIR is whitespace only", () => {
      expect(() => invoice.fiscalize("   ", "zki-67890")).toThrow(InvoiceError)
    })

    it("throws when ZKI is empty", () => {
      expect(() => invoice.fiscalize("jir-12345", "")).toThrow(InvoiceError)
      expect(() => invoice.fiscalize("jir-12345", "")).toThrow("ZKI cannot be empty")
    })

    it("throws when fiscalizing non-PENDING_FISCALIZATION invoice", () => {
      const draftInvoice = Invoice.create("buyer", "seller")

      expect(() => draftInvoice.fiscalize("jir", "zki")).toThrow(InvoiceError)
      expect(() => draftInvoice.fiscalize("jir", "zki")).toThrow("expected PENDING_FISCALIZATION")
    })
  })

  describe("Full lifecycle", () => {
    it("completes DRAFT -> PENDING -> FISCALIZED -> SENT -> ACCEPTED -> ARCHIVED", () => {
      const invoice = Invoice.create("buyer", "seller")
      expect(invoice.status).toBe(InvoiceStatus.DRAFT)

      invoice.addLine(createTestLine())
      invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))
      expect(invoice.status).toBe(InvoiceStatus.PENDING_FISCALIZATION)

      invoice.fiscalize("jir-abc", "zki-xyz")
      expect(invoice.status).toBe(InvoiceStatus.FISCALIZED)

      invoice.markSent()
      expect(invoice.status).toBe(InvoiceStatus.SENT)

      invoice.accept()
      expect(invoice.status).toBe(InvoiceStatus.ACCEPTED)

      invoice.archive()
      expect(invoice.status).toBe(InvoiceStatus.ARCHIVED)
    })

    it("completes lifecycle via DELIVERED path", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())
      invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))
      invoice.fiscalize("jir-abc", "zki-xyz")
      invoice.markSent()
      expect(invoice.status).toBe(InvoiceStatus.SENT)

      invoice.markDelivered()
      expect(invoice.status).toBe(InvoiceStatus.DELIVERED)

      invoice.accept()
      expect(invoice.status).toBe(InvoiceStatus.ACCEPTED)

      invoice.archive()
      expect(invoice.status).toBe(InvoiceStatus.ARCHIVED)
    })

    it("can cancel draft invoice", () => {
      const invoice = Invoice.create("buyer", "seller")

      invoice.cancel()

      expect(invoice.status).toBe(InvoiceStatus.CANCELED)
    })
  })

  describe("Invalid transitions", () => {
    it("rejects markSent on draft invoice", () => {
      const invoice = Invoice.create("buyer", "seller")

      expect(() => invoice.markSent()).toThrow(InvoiceError)
      expect(() => invoice.markSent()).toThrow("expected FISCALIZED")
    })

    it("rejects markDelivered on fiscalized invoice", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())
      invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))
      invoice.fiscalize("jir", "zki")

      expect(() => invoice.markDelivered()).toThrow(InvoiceError)
      expect(() => invoice.markDelivered()).toThrow("expected SENT")
    })

    it("rejects accept on draft invoice", () => {
      const invoice = Invoice.create("buyer", "seller")

      expect(() => invoice.accept()).toThrow(InvoiceError)
      expect(() => invoice.accept()).toThrow("Cannot accept invoice in DRAFT status")
    })

    it("rejects archive on non-accepted invoice", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())
      invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))
      invoice.fiscalize("jir", "zki")
      invoice.markSent()

      expect(() => invoice.archive()).toThrow(InvoiceError)
      expect(() => invoice.archive()).toThrow("expected ACCEPTED")
    })

    it("rejects cancel on non-draft invoice", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())
      invoice.issue(createTestInvoiceNumber(), new Date("2025-01-01"), new Date("2025-01-15"))

      expect(() => invoice.cancel()).toThrow(InvoiceError)
      expect(() => invoice.cancel()).toThrow("not in DRAFT status")
    })
  })

  describe("reconstitute", () => {
    it("reconstitutes invoice from props", () => {
      const id = InvoiceId.create()
      const invoiceNumber = createTestInvoiceNumber()
      const line = createTestLine()
      const issueDate = new Date("2025-01-01")
      const dueDate = new Date("2025-01-15")
      const fiscalizedAt = new Date("2025-01-02")

      const props: InvoiceProps = {
        id,
        invoiceNumber,
        status: InvoiceStatus.FISCALIZED,
        buyerId: "buyer-abc",
        sellerId: "seller-xyz",
        issueDate,
        dueDate,
        lines: [line],
        jir: "jir-123",
        zki: "zki-456",
        fiscalizedAt,
        version: 5,
      }

      const invoice = Invoice.reconstitute(props)

      expect(invoice.id).toBe(id)
      expect(invoice.invoiceNumber).toBe(invoiceNumber)
      expect(invoice.status).toBe(InvoiceStatus.FISCALIZED)
      expect(invoice.buyerId).toBe("buyer-abc")
      expect(invoice.sellerId).toBe("seller-xyz")
      expect(invoice.issueDate).toBe(issueDate)
      expect(invoice.dueDate).toBe(dueDate)
      expect(invoice.getLines()).toHaveLength(1)
      expect(invoice.jir).toBe("jir-123")
      expect(invoice.zki).toBe("zki-456")
      expect(invoice.fiscalizedAt).toBe(fiscalizedAt)
      expect(invoice.version).toBe(5)
    })

    it("reconstituted invoice can continue its lifecycle", () => {
      const props: InvoiceProps = {
        id: InvoiceId.create(),
        status: InvoiceStatus.FISCALIZED,
        buyerId: "buyer",
        sellerId: "seller",
        lines: [createTestLine()],
        invoiceNumber: createTestInvoiceNumber(),
        issueDate: new Date("2025-01-01"),
        dueDate: new Date("2025-01-15"),
        jir: "jir-123",
        zki: "zki-456",
        fiscalizedAt: new Date("2025-01-02"),
        version: 5,
      }

      const invoice = Invoice.reconstitute(props)
      invoice.markSent()

      expect(invoice.status).toBe(InvoiceStatus.SENT)
      expect(invoice.version).toBe(6)
    })
  })

  describe("getLines immutability", () => {
    it("returns a copy of lines array", () => {
      const invoice = Invoice.create("buyer", "seller")
      const line = createTestLine()
      invoice.addLine(line)

      const lines1 = invoice.getLines()
      const lines2 = invoice.getLines()

      expect(lines1).not.toBe(lines2)
      expect(lines1).toEqual(lines2)
    })

    it("modifications to returned array do not affect invoice", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createTestLine())

      const lines = invoice.getLines() as InvoiceLine[]
      lines.pop()

      expect(invoice.getLines()).toHaveLength(1)
    })
  })
})
