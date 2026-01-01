// src/domain/identity/LegalForm.ts

/**
 * Croatian legal forms for businesses
 */
export const LegalForm = {
  OBRT_PAUSAL: "OBRT_PAUSAL" as const,
  OBRT_REAL: "OBRT_REAL" as const,
  DOO: "DOO" as const,
  DIONICKO_DRUSTVO: "DIONICKO_DRUSTVO" as const,

  values(): string[] {
    return [LegalForm.OBRT_PAUSAL, LegalForm.OBRT_REAL, LegalForm.DOO, LegalForm.DIONICKO_DRUSTVO]
  },

  isValid(value: string): boolean {
    return LegalForm.values().includes(value)
  },

  getDisplayName(
    form:
      | typeof LegalForm.OBRT_PAUSAL
      | typeof LegalForm.OBRT_REAL
      | typeof LegalForm.DOO
      | typeof LegalForm.DIONICKO_DRUSTVO
  ): string {
    const displayNames: Record<string, string> = {
      [LegalForm.OBRT_PAUSAL]: "Obrt (pausalni)",
      [LegalForm.OBRT_REAL]: "Obrt (realni)",
      [LegalForm.DOO]: "d.o.o.",
      [LegalForm.DIONICKO_DRUSTVO]: "d.d.",
    }
    return displayNames[form] ?? form
  },
}

export type LegalFormType =
  | typeof LegalForm.OBRT_PAUSAL
  | typeof LegalForm.OBRT_REAL
  | typeof LegalForm.DOO
  | typeof LegalForm.DIONICKO_DRUSTVO
