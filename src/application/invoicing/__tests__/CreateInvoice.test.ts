// src/application/invoicing/__tests__/CreateInvoice.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { CreateInvoice, CreateInvoiceInput } from "../CreateInvoice"
import { Invoice, InvoiceId } from "@/domain/invoicing"
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"

describe("CreateInvoice", () => {
  let mockRepo: InvoiceRepository
  let useCase: CreateInvoice

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByNumber: vi.fn(),
      nextSequenceNumber: vi.fn(),
    }
    useCase = new CreateInvoice(mockRepo)
  })

  it("creates a new invoice and saves it", async () => {
    const input: CreateInvoiceInput = {
      buyerId: "buyer-123",
      sellerId: "seller-456",
    }

    const result = await useCase.execute(input)

    expect(result.invoiceId).toBeDefined()
    expect(result.invoiceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
    expect(mockRepo.save).toHaveBeenCalledTimes(1)
  })

  it("passes the created invoice to the repository", async () => {
    const input: CreateInvoiceInput = {
      buyerId: "buyer-abc",
      sellerId: "seller-xyz",
    }

    await useCase.execute(input)

    const savedInvoice = (mockRepo.save as ReturnType<typeof vi.fn>).mock.calls[0][0] as Invoice
    expect(savedInvoice.buyerId).toBe("buyer-abc")
    expect(savedInvoice.sellerId).toBe("seller-xyz")
  })
})
