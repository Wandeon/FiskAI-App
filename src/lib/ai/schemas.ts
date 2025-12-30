import { z } from "zod"

/**
 * Zod schemas for validating LLM JSON outputs
 *
 * These schemas provide runtime validation to ensure LLM responses
 * match expected formats and prevent type errors downstream.
 */

// Schema for individual receipt items
export const extractedItemSchema = z.object({
  description: z.string().min(1, "Item description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
  total: z.number().nonnegative("Total must be non-negative"),
  vatRate: z.number().nonnegative("VAT rate must be non-negative").optional(),
})

// Schema for receipt extraction (OCR and text extraction)
export const extractedReceiptSchema = z.object({
  vendor: z.string().min(1, "Vendor name is required"),
  vendorOib: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  items: z.array(extractedItemSchema).min(1, "At least one item is required"),
  subtotal: z.number().nonnegative("Subtotal must be non-negative"),
  vatAmount: z.number().nonnegative("VAT amount must be non-negative"),
  total: z.number().nonnegative("Total must be non-negative"),
  paymentMethod: z.enum(["cash", "card", "transfer"]).optional(),
  currency: z.string().min(1, "Currency is required"),
  confidence: z.number().min(0).max(1, "Confidence must be between 0 and 1"),
})

// Schema for invoice extraction (extends receipt)
export const extractedInvoiceSchema = extractedReceiptSchema.extend({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().optional(),
  buyerName: z.string().optional(),
  buyerOib: z.string().optional(),
})

// Schema for synthesized answers from the AI Assistant
export const synthesizedAnswerSchema = z.object({
  headline: z.string().min(1, "Headline is required").max(120, "Headline must not exceed 120 characters"),
  directAnswer: z.string().min(1, "Direct answer is required").max(240, "Direct answer must not exceed 240 characters"),
  explanation: z.string().max(300, "Explanation must not exceed 300 characters").optional(),
})

// Type exports for convenience
export type ExtractedItem = z.infer<typeof extractedItemSchema>
export type ExtractedReceipt = z.infer<typeof extractedReceiptSchema>
export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>
export type SynthesizedAnswer = z.infer<typeof synthesizedAnswerSchema>
