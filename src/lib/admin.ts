import { db } from "@/lib/db"

/**
 * Checks if a user is a global admin by verifying their systemRole in the database.
 *
 * @deprecated Use `requireAdmin()` from auth-utils instead for better security and consistency.
 * This function only checks the database systemRole and does NOT use email allowlists.
 * For bootstrapping new admin users, use the `scripts/set-admin-role.ts` script.
 *
 * Security note: Previously relied on ADMIN_EMAILS environment variable as fallback,
 * which was insecure as emails can be spoofed. Now only uses database-backed roles.
 */
export async function isGlobalAdmin(email?: string | null) {
  if (!email) return false

  // Check database systemRole (Primary and only truth)
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { systemRole: true },
  })

  return user?.systemRole === "ADMIN"
}

export const MODULE_LABELS: Record<string, string> = {
  "platform-core": "Platform Core",
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
