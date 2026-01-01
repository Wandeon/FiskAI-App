// src/application/invoicing/__tests__/AddInvoiceLine.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AddInvoiceLine, AddInvoiceLineInput } from "../AddInvoiceLine"
import { Invoice, InvoiceId, InvoiceError } from "@/domain/invoicing"
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"

describe("AddInvoiceLine", () => {
  let mockRepo: InvoiceRepository
  let useCase: AddInvoiceLine
  let existingInvoice: Invoice

  beforeEach(() => {
    existingInvoice = Invoice.create("buyer-123", "seller-456")

    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockImplementation((id: InvoiceId) => {
        if (id.toString() === existingInvoice.id.toString()) {
          return Promise.resolve(existingInvoice)
        }
        return Promise.resolve(null)
      }),
      findByNumber: vi.fn(),
      nextSequenceNumber: vi.fn(),
    }
    useCase = new AddInvoiceLine(mockRepo)
  })

  it("finds the invoice and adds a line", async () => {
    const input: AddInvoiceLineInput = {
      invoiceId: existingInvoice.id.toString(),
      description: "Test Product",
      quantity: 2,
      unitPriceCents: 1000,
      vatRatePercent: 25,
    }

    await useCase.execute(input)

    expect(mockRepo.findById).toHaveBeenCalledTimes(1)
    expect(existingInvoice.getLines()).toHaveLength(1)
    expect(existingInvoice.getLines()[0].description).toBe("Test Product")
  })

  it("saves the invoice after adding a line", async () => {
    const input: AddInvoiceLineInput = {
      invoiceId: existingInvoice.id.toString(),
      description: "Another Product",
      quantity: 1,
      unitPriceCents: 500,
      vatRatePercent: 25,
    }

    await useCase.execute(input)

    expect(mockRepo.save).toHaveBeenCalledTimes(1)
    expect(mockRepo.save).toHaveBeenCalledWith(existingInvoice)
  })

  it("adds a line with discount when discountCents is provided", async () => {
    const input: AddInvoiceLineInput = {
      invoiceId: existingInvoice.id.toString(),
      description: "Discounted Product",
      quantity: 1,
      unitPriceCents: 1000,
      vatRatePercent: 25,
      discountCents: 100,
    }

    await useCase.execute(input)

    const line = existingInvoice.getLines()[0]
    expect(line.discount.toCents()).toBe(100)
  })

  it("throws InvoiceError when invoice is not found", async () => {
    const input: AddInvoiceLineInput = {
      invoiceId: "non-existent-id",
      description: "Test Product",
      quantity: 1,
      unitPriceCents: 1000,
      vatRatePercent: 25,
    }

    await expect(useCase.execute(input)).rejects.toThrow(InvoiceError)
    await expect(useCase.execute(input)).rejects.toThrow("Invoice non-existent-id not found")
  })
})
