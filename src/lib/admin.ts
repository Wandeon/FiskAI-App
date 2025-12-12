export function isGlobalAdmin(email?: string | null) {
  if (!email) return false
  const allowlist = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}

export const MODULE_LABELS: Record<string, string> = {
  invoicing: "Dokumenti",
  eInvoicing: "E-Računi",
  expenses: "Troškovi",
  banking: "Banka",
  reports: "Izvještaji",
  settings: "Postavke",
}

export function getEntitlementsList(entitlements: unknown): string[] {
  if (!entitlements) return []
  if (Array.isArray(entitlements)) return entitlements as string[]
  return []
}
