// src/application/invoicing/CreateInvoice.ts
import { Invoice } from "@/domain/invoicing"
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"

export interface CreateInvoiceInput {
  buyerId: string
  sellerId: string
}

export interface CreateInvoiceOutput {
  invoiceId: string
}

export class CreateInvoice {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
    const invoice = Invoice.create(input.buyerId, input.sellerId)
    await this.repo.save(invoice)
    return { invoiceId: invoice.id.toString() }
  }
}
