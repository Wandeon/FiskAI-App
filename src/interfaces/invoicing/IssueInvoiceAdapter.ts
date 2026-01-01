import { z } from "zod"
import { IssueInvoice } from "@/application/invoicing"
import { PrismaInvoiceRepository } from "@/infrastructure/invoicing"

const IssueInvoiceSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  companyId: z.string().min(1, "Company ID is required"),
  premiseCode: z.number().int().positive("Premise code must be positive"),
  deviceCode: z.number().int().positive("Device code must be positive"),
  dueDate: z.coerce.date(),
})

export type IssueInvoiceRequest = z.infer<typeof IssueInvoiceSchema>

export async function handleIssueInvoice(input: unknown) {
  const validated = IssueInvoiceSchema.parse(input)
  const repo = new PrismaInvoiceRepository()
  const useCase = new IssueInvoice(repo)
  return await useCase.execute(validated)
}
