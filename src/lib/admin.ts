export const MODULE_LABELS: Record<string, string> = {
  invoicing: "Izrada računa",
  "e-invoicing": "E-Računi",
  expenses: "Troškovi",
  banking: "Banka",
  "reports-basic": "Izvještaji",
  "reports-advanced": "Napredni izvještaji",
  pausalni: "Paušalni obrt",
  fiscalization: "Fiskalizacija",
  pos: "Blagajna (POS)",
  documents: "Dokumenti",
  contacts: "Kontakti",
  products: "Proizvodi",
  "ai-assistant": "AI Asistent",
}

export function getEntitlementsList(entitlements: unknown): string[] {
  if (!entitlements) return []
  if (Array.isArray(entitlements)) return entitlements as string[]
  return []
}
