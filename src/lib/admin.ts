import { db } from "@/lib/db"

/**
 * Checks if a user is a global admin.
 * @deprecated Use session.user.systemRole === 'ADMIN' instead for better security and consistency.
 */
export async function isGlobalAdmin(email?: string | null) {
  if (!email) return false

  // 1. Check database first (Primary truth)
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { systemRole: true },
  })

  if (user?.systemRole === "ADMIN") return true

  // 2. Fallback to environment variable (Legacy/Bootstrap)
  const allowlist = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  return allowlist.includes(email.toLowerCase())
}

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
