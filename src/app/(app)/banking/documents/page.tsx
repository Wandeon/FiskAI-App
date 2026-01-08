import { redirect } from "next/navigation"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { deriveCapabilities } from "@/lib/capabilities"

// Redirect to unified documents hub
// Keep this file for backwards compatibility - old bookmarks will redirect
export default async function BankingDocumentsPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const capabilities = deriveCapabilities(company)

  if (!capabilities.modules.banking?.enabled) {
    redirect("/settings?tab=plan&blocked=banking")
  }

  redirect("/documents?category=bank-statement")
}
