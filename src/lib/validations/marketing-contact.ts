import { z } from "zod"

/**
 * Validation schema for the marketing contact/demo request form
 */
export const marketingContactSchema = z.object({
  name: z.string().min(2, "Ime mora imati najmanje 2 znaka").max(100, "Ime je predugačko"),
  email: z.string().email("Unesite ispravnu email adresu"),
  businessType: z.enum(["pausalni-obrt", "vat-obrt", "doo", "accountant"], {
    message: "Molimo odaberite tip poslovanja",
  }),
  invoiceVolume: z.enum(["1-10", "11-50", "51-200", "200+"], {
    message: "Molimo odaberite broj računa mjesečno",
  }),
  message: z.string().max(1000, "Poruka može imati maksimalno 1000 znakova").optional(),
})

export type MarketingContactInput = z.infer<typeof marketingContactSchema>
