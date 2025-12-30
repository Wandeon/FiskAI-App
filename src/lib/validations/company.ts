import { z } from "zod"
import { oibSchema } from "./oib"

export const companySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  oib: oibSchema,
  vatNumber: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().default("HR"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  iban: z.string().optional(),
  isVatPayer: z.boolean().default(false),
  legalForm: z.enum(["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT", "JDOO", "DOO"]).optional(),
  competence: z.enum(["guided", "standard", "expert"]).optional(),
})

export const companySettingsSchema = z.object({
  eInvoiceProvider: z.enum(["ie-racuni", "fina", "ddd-invoices", "mock"]).optional(),
  eInvoiceApiKey: z.string().optional(),
})

export const planSettingsSchema = z.object({
  legalForm: z.enum(["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT", "JDOO", "DOO"]),
  isVatPayer: z.boolean().default(false),
  entitlements: z
    .array(
      z.enum([
        "platform-core",
        "invoicing",
        "e-invoicing",
        "fiscalization",
        "contacts",
        "products",
        "expenses",
        "banking",
        "reconciliation",
        "reports-basic",
        "reports-advanced",
        "pausalni",
        "vat",
        "corporate-tax",
        "pos",
        "documents",
        "ai-assistant",
      ])
    )
    .min(1),
})

export type CompanyInput = z.infer<typeof companySchema>
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>
export type PlanSettingsInput = z.infer<typeof planSettingsSchema>
