// src/domain/identity/LegalForm.ts

/**
 * Croatian legal forms for businesses
 */
const OBRT_PAUSAL = "OBRT_PAUSAL" as const
const OBRT_REAL = "OBRT_REAL" as const
const DOO = "DOO" as const
const DIONICKO_DRUSTVO = "DIONICKO_DRUSTVO" as const

const LEGAL_FORM_VALUES = [OBRT_PAUSAL, OBRT_REAL, DOO, DIONICKO_DRUSTVO] as const

const DISPLAY_NAMES: Record<string, string> = {
  [OBRT_PAUSAL]: "Obrt (pausalni)",
  [OBRT_REAL]: "Obrt (realni)",
  [DOO]: "d.o.o.",
  [DIONICKO_DRUSTVO]: "d.d.",
}

export const LegalForm = {
  OBRT_PAUSAL,
  OBRT_REAL,
  DOO,
  DIONICKO_DRUSTVO,

  values(): readonly string[] {
    return LEGAL_FORM_VALUES
  },

  isValid(value: string): boolean {
    return (LEGAL_FORM_VALUES as readonly string[]).includes(value)
  },

  getDisplayName(form: LegalFormType): string {
    return DISPLAY_NAMES[form] ?? form
  },
} as const

export type LegalFormType = (typeof LEGAL_FORM_VALUES)[number]
