import type { EInvoice, EInvoiceLine, InvoiceSequence } from "@prisma/client"

export type Invoice = EInvoice
export type InvoiceLine = EInvoiceLine
export type NumberingSequence = InvoiceSequence
export type CreditNote = EInvoice & { type: "CREDIT_NOTE" }
