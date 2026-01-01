// src/application/invoicing/IssueInvoice.ts
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"
import { InvoiceId, InvoiceNumber, InvoiceError } from "@/domain/invoicing"

export interface IssueInvoiceInput {
  invoiceId: string
  companyId: string
  premiseCode: number
  deviceCode: number
  dueDate: Date
}

export interface IssueInvoiceOutput {
  invoiceNumber: string
}

export class IssueInvoice {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(input: IssueInvoiceInput): Promise<IssueInvoiceOutput> {
    const invoice = await this.repo.findById(InvoiceId.fromString(input.invoiceId))
    if (!invoice) {
      throw new InvoiceError(`Invoice ${input.invoiceId} not found`)
    }

    const sequenceNumber = await this.repo.nextSequenceNumber(
      input.companyId,
      input.premiseCode,
      input.deviceCode
    )

    const invoiceNumber = InvoiceNumber.create(
      sequenceNumber,
      input.premiseCode,
      input.deviceCode,
      new Date().getFullYear()
    )

    invoice.issue(invoiceNumber, new Date(), input.dueDate)
    await this.repo.save(invoice)

    return { invoiceNumber: invoiceNumber.format() }
  }
}
