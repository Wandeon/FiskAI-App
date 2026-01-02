import { z } from "zod"
import { IssueInvoice } from "@/application/invoicing"
import { PrismaInvoiceRepository } from "@/infrastructure/invoicing"
import { TenantScopedContext } from "@/infrastructure/shared/TenantScopedContext"

const IssueInvoiceSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  premiseCode: z.number().int().positive("Premise code must be positive"),
  deviceCode: z.number().int().positive("Device code must be positive"),
  dueDate: z.coerce.date(),
})

export type IssueInvoiceRequest = z.infer<typeof IssueInvoiceSchema>

/**
 * Handle issuing an invoice.
 *
 * Note: companyId is no longer in the input - it comes from the
 * TenantScopedContext which scopes all repository operations.
 *
 * @param ctx - TenantScopedContext for the current request
 * @param input - The request data
 */
export async function handleIssueInvoice(ctx: TenantScopedContext, input: unknown) {
  const validated = IssueInvoiceSchema.parse(input)
  const repo = new PrismaInvoiceRepository(ctx)
  const useCase = new IssueInvoice(repo)
  return await useCase.execute(validated)
}
