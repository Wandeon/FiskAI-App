// src/application/invoicing/AddInvoiceLine.ts
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"
import { InvoiceId, InvoiceLine, InvoiceError } from "@/domain/invoicing"
import { Money, Quantity, VatRate } from "@/domain/shared"

export interface AddInvoiceLineInput {
  invoiceId: string
  description: string
  quantity: number
  unitPriceCents: number
  vatRatePercent: number
  discountCents?: number
}

export class AddInvoiceLine {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(input: AddInvoiceLineInput): Promise<void> {
    const invoice = await this.repo.findById(InvoiceId.fromString(input.invoiceId))
    if (!invoice) {
      throw new InvoiceError(`Invoice ${input.invoiceId} not found`)
    }

    const line = InvoiceLine.create({
      description: input.description,
      quantity: Quantity.of(input.quantity),
      unitPrice: Money.fromCents(input.unitPriceCents),
      vatRate: VatRate.standard((input.vatRatePercent / 100).toString()),
      discount: input.discountCents ? Money.fromCents(input.discountCents) : undefined,
    })

    invoice.addLine(line)
    await this.repo.save(invoice)
  }
}
