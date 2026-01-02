import { z } from "zod"
import { CreateInvoice } from "@/application/invoicing"
import { PrismaInvoiceRepository } from "@/infrastructure/invoicing"
import { TenantScopedContext } from "@/infrastructure/shared/TenantScopedContext"

const CreateInvoiceSchema = z.object({
  buyerId: z.string().min(1, "Buyer ID is required"),
  sellerId: z.string().min(1, "Seller ID is required"),
})

export type CreateInvoiceRequest = z.infer<typeof CreateInvoiceSchema>

/**
 * Handle creating a new invoice.
 *
 * @param ctx - TenantScopedContext for the current request
 * @param input - The request data
 */
export async function handleCreateInvoice(ctx: TenantScopedContext, input: unknown) {
  const validated = CreateInvoiceSchema.parse(input)
  const repo = new PrismaInvoiceRepository(ctx)
  const useCase = new CreateInvoice(repo)
  return await useCase.execute(validated)
}
