import { z } from "zod"

// Croatian OIB validation (11 digits with checksum)
const oibRegex = /^\d{11}$/

export const companySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  oib: z.string().regex(oibRegex, "OIB must be exactly 11 digits"),
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
