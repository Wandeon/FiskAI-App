import { XMLParser } from "fast-xml-parser"
import { z } from "zod"

const metapodaciSchema = z.object({
  DatumIzvjesca: z.string().min(1),
  OznakaIzvjesca: z.string().min(1),
  OznakaPodnositelja: z.string().min(1),
})

const podnositeljSchema = z.object({
  OIB: z.string().min(1),
  Naziv: z.string().min(1),
  Adresa: z.string().min(1),
  Email: z.string().min(1),
})

const stranaASchema = z.object({
  PodnositeljIzvjesca: podnositeljSchema,
  BrojOsoba: z.string().min(1),
  BrojRedaka: z.string().min(1),
  I: z.string().min(1),
  II: z.string().min(1),
  III: z.string().min(1),
  IV: z.string().min(1),
  V: z.string().min(1),
})

const lineSchema = z
  .object({
    P1: z.string(),
    P2: z.string(),
    P3: z.string(),
    P4: z.string(),
    P5: z.union([z.string(), z.array(z.string())]),
    "P6.1": z.string(),
    "P6.2": z.string(),
    P7: z.string(),
    P8: z.string(),
    P9: z.string(),
    P10: z.string(),
    P11: z.string(),
    P12: z.string(),
    "P13.1": z.string(),
    "P13.2": z.string(),
    "P13.3": z.string(),
    "P13.4": z.string(),
    P14: z.string(),
    P15: z.string(),
    P16: z.string(),
    P17: z.string(),
  })
  .passthrough()

const joppdSchema = z.object({
  ObrazacJOPPD: z
    .object({
      "@_Original": z.string().min(1),
      Metapodaci: metapodaciSchema,
      StranaA: stranaASchema,
      StranaB: z.object({
        P: z.union([lineSchema, z.array(lineSchema)]),
      }),
    })
    .passthrough(),
})

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
})

export type JoppdXmlValidationResult =
  | { valid: true }
  | {
      valid: false
      errors: string[]
    }

export function validateJoppdXml(xml: string): JoppdXmlValidationResult {
  const parsed = parser.parse(xml)
  const result = joppdSchema.safeParse(parsed)

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    }
  }

  return { valid: true }
}
