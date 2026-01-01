// src/domain/invoicing/InvoiceError.ts
export class InvoiceError extends Error {
  readonly code = "INVOICE_ERROR"

  constructor(message: string) {
    super(message)
    this.name = "InvoiceError"
  }
}
