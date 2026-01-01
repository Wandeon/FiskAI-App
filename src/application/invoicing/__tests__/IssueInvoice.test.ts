// src/application/invoicing/__tests__/IssueInvoice.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { IssueInvoice, IssueInvoiceInput } from "../IssueInvoice"
import { Invoice, InvoiceId, InvoiceLine, InvoiceError, InvoiceStatus } from "@/domain/invoicing"
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"
import { Money, Quantity, VatRate } from "@/domain/shared"

describe("IssueInvoice", () => {
  let mockRepo: InvoiceRepository
  let useCase: IssueInvoice
  let existingInvoice: Invoice

  beforeEach(() => {
    existingInvoice = Invoice.create("buyer-123", "seller-456")
    // Add a line so the invoice can be issued
    existingInvoice.addLine(
      InvoiceLine.create({
        description: "Test Product",
        quantity: Quantity.of(1),
        unitPrice: Money.fromCents(1000),
        vatRate: VatRate.standard("0.25"),
      })
    )

    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockImplementation((id: InvoiceId) => {
        if (id.toString() === existingInvoice.id.toString()) {
          return Promise.resolve(existingInvoice)
        }
        return Promise.resolve(null)
      }),
      findByNumber: vi.fn(),
      nextSequenceNumber: vi.fn().mockResolvedValue(42),
    }
    useCase = new IssueInvoice(mockRepo)
  })

  it("finds the invoice and issues it with a generated number", async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const input: IssueInvoiceInput = {
      invoiceId: existingInvoice.id.toString(),
      companyId: "company-789",
      premiseCode: 1,
      deviceCode: 1,
      dueDate: futureDate,
    }

    const result = await useCase.execute(input)

    expect(result.invoiceNumber).toBe("42-1-1")
    expect(mockRepo.findById).toHaveBeenCalledTimes(1)
    expect(mockRepo.nextSequenceNumber).toHaveBeenCalledWith("company-789", 1, 1)
  })

  it("saves the invoice after issuing", async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const input: IssueInvoiceInput = {
      invoiceId: existingInvoice.id.toString(),
      companyId: "company-789",
      premiseCode: 2,
      deviceCode: 3,
      dueDate: futureDate,
    }

    await useCase.execute(input)

    expect(mockRepo.save).toHaveBeenCalledTimes(1)
    expect(mockRepo.save).toHaveBeenCalledWith(existingInvoice)
    expect(existingInvoice.status).toBe(InvoiceStatus.PENDING_FISCALIZATION)
  })

  it("throws InvoiceError when invoice is not found", async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const input: IssueInvoiceInput = {
      invoiceId: "non-existent-id",
      companyId: "company-789",
      premiseCode: 1,
      deviceCode: 1,
      dueDate: futureDate,
    }

    await expect(useCase.execute(input)).rejects.toThrow(InvoiceError)
    await expect(useCase.execute(input)).rejects.toThrow("Invoice non-existent-id not found")
  })

  it("uses the correct sequence number from repository", async () => {
    ;(mockRepo.nextSequenceNumber as ReturnType<typeof vi.fn>).mockResolvedValue(100)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const input: IssueInvoiceInput = {
      invoiceId: existingInvoice.id.toString(),
      companyId: "company-abc",
      premiseCode: 5,
      deviceCode: 2,
      dueDate: futureDate,
    }

    const result = await useCase.execute(input)

    expect(result.invoiceNumber).toBe("100-5-2")
  })
})
