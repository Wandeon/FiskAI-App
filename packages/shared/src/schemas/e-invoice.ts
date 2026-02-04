import { z } from "zod"

// UN/CEFACT unit codes used in Croatia
export const UNIT_CODES = {
  C62: "kom",     // Piece/item
  HUR: "sat",     // Hour
  DAY: "dan",     // Day
  MON: "mj",      // Month
  KGM: "kg",      // Kilogram
  MTR: "m",       // Meter
  LTR: "L",       // Liter
  MTK: "m²",      // Square meter
  MTQ: "m³",      // Cubic meter
} as const

export const VAT_CATEGORIES = {
  S: "Standardna stopa",    // Standard rate (25%)
  AA: "Snižena stopa",      // Reduced rate (13%, 5%)
  E: "Oslobođeno",          // Exempt
  Z: "Nulta stopa",         // Zero rate
  O: "Izvan PDV-a",         // Outside scope
} as const

export const VAT_RATES = [25, 13, 5, 0] as const

export const eInvoiceLineSchema = z.object({
  description: z.string().min(1, "Opis je obavezan"),
  quantity: z.number().positive("Količina mora biti pozitivna"),
  unit: z.enum(Object.keys(UNIT_CODES) as [string, ...string[]]).default("C62"),
  unitPrice: z.number().min(0, "Cijena ne može biti negativna"),
  vatRate: z.number().refine(
    (v) => VAT_RATES.includes(v as typeof VAT_RATES[number]),
    { message: "Nevažeća stopa PDV-a" }
  ).default(25),
  vatCategory: z.enum(["S", "AA", "E", "Z", "O"]).default("S"),
  productId: z.string().optional(), // Link to product catalog
})

export type EInvoiceLineInput = z.infer<typeof eInvoiceLineSchema>

export const eInvoiceSchema = z.object({
  // Buyer selection
  contactId: z.string().min(1, "Kupac je obavezan"),

  // Dates
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),

  // Optional fields
  buyerReference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),

  // Line items
  lines: z.array(eInvoiceLineSchema).min(1, "Potrebna je najmanje jedna stavka"),
}).refine((data) => {
  if (data.dueDate && data.issueDate) {
    return data.dueDate >= data.issueDate
  }
  return true
}, {
  message: "Datum dospijeća mora biti nakon datuma izdavanja",
  path: ["dueDate"],
})

export type EInvoiceInput = z.infer<typeof eInvoiceSchema>
