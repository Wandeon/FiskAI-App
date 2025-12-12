import { z } from "zod"

export const contactSchema = z.object({
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  name: z.string().min(2, "Name must be at least 2 characters"),
  oib: z.string().regex(/^\d{11}$/, "OIB must be exactly 11 digits").optional().or(z.literal("")),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("HR"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(15),
})

export type ContactInput = z.infer<typeof contactSchema>
