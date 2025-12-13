import { z } from "zod"

export const eInvoiceLineSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().default("C62"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
  vatRate: z.number().min(0).max(100).default(25),
  vatCategory: z.enum(["S", "AA", "E", "Z", "O"]).default("S"),
})

export const eInvoiceSchema = z.object({
  buyerId: z.string().min(1, "Buyer is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  currency: z.string().default("EUR"),
  buyerReference: z.string().optional(),
  bankAccount: z.string().regex(/^HR\d{2}\d{17}$/, "Neispravan IBAN").optional().or(z.literal("")),
  includeBarcode: z.boolean().optional(),
  lines: z.array(eInvoiceLineSchema).min(1, "At least one line item is required"),
})

export type EInvoiceLineInput = z.infer<typeof eInvoiceLineSchema>
export type EInvoiceInput = z.infer<typeof eInvoiceSchema>
