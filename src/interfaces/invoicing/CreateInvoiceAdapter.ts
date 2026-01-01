import { z } from "zod"
import { CreateInvoice } from "@/application/invoicing"
import { PrismaInvoiceRepository } from "@/infrastructure/invoicing"

const CreateInvoiceSchema = z.object({
  buyerId: z.string().min(1, "Buyer ID is required"),
  sellerId: z.string().min(1, "Seller ID is required"),
})

export type CreateInvoiceRequest = z.infer<typeof CreateInvoiceSchema>

export async function handleCreateInvoice(input: unknown) {
  const validated = CreateInvoiceSchema.parse(input)
  const repo = new PrismaInvoiceRepository()
  const useCase = new CreateInvoice(repo)
  return await useCase.execute(validated)
}
