import { z } from "zod"
import { AddInvoiceLine } from "@/application/invoicing"
import { PrismaInvoiceRepository } from "@/infrastructure/invoicing"
import { TenantScopedContext } from "@/infrastructure/shared/TenantScopedContext"

const AddInvoiceLineSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPriceCents: z.number().int().min(0, "Unit price cannot be negative"),
  vatRatePercent: z.number().min(0).max(100, "VAT rate must be 0-100"),
  discountCents: z.number().int().min(0).optional(),
})

export type AddInvoiceLineRequest = z.infer<typeof AddInvoiceLineSchema>

/**
 * Handle adding a line to an invoice.
 *
 * @param ctx - TenantScopedContext for the current request
 * @param input - The request data
 */
export async function handleAddInvoiceLine(ctx: TenantScopedContext, input: unknown) {
  const validated = AddInvoiceLineSchema.parse(input)
  const repo = new PrismaInvoiceRepository(ctx)
  const useCase = new AddInvoiceLine(repo)
  await useCase.execute(validated)
  return { success: true }
}
