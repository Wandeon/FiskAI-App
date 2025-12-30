import { z } from "zod"

export const productSchema = z.object({
  name: z.string().min(2, "Naziv mora imati najmanje 2 znaka"),
  description: z.string().optional(),
  sku: z.string().optional(),
  unit: z.string().default("C62"),
  price: z.coerce.number().min(0, "Cijena mora biti pozitivna"),
  vatRate: z.coerce.number().min(0).max(100).default(25),
  vatCategory: z.enum(["S", "AA", "E", "Z", "O"]).default("S"),
  isActive: z.boolean().default(true),
})

export type ProductInput = z.infer<typeof productSchema>

// UN/ECE Recommendation 20 unit codes commonly used in Croatia
export const unitCodes = [
  { code: "C62", name: "Komad" },
  { code: "KGM", name: "Kilogram" },
  { code: "LTR", name: "Litra" },
  { code: "MTR", name: "Metar" },
  { code: "MTK", name: "Kvadratni metar" },
  { code: "HUR", name: "Sat" },
  { code: "DAY", name: "Dan" },
  { code: "MON", name: "Mjesec" },
  { code: "SET", name: "Set" },
  { code: "PCE", name: "Komad" },
] as const

// VAT categories per EN 16931
export const vatCategories = [
  { code: "S", name: "Standardna stopa (25%)", rate: 25 },
  { code: "AA", name: "Snižena stopa (13%)", rate: 13 },
  { code: "E", name: "Oslobođeno PDV-a", rate: 0 },
  { code: "Z", name: "Nulta stopa", rate: 0 },
  { code: "O", name: "Izvan oporezivanja", rate: 0 },
] as const

// Map VAT category codes to their corresponding rates
// Used to derive vatRate from vatCategory to ensure consistency
export const vatRateMap: Record<string, number> = {
  S: 25,
  AA: 13,
  E: 0,
  Z: 0,
  O: 0,
}

// Helper function to get VAT rate from category
export function getVatRateFromCategory(vatCategory: string): number {
  return vatRateMap[vatCategory] ?? 25
}
