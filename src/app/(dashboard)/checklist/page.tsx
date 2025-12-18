// src/app/(dashboard)/checklist/page.tsx
import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { getChecklist, getGuidancePreferences } from "@/lib/guidance"
import { ChecklistPageClient } from "./ChecklistPageClient"

export const metadata = {
  title: "Što moram napraviti? | FiskAI",
  description: "Mjesečni pregled svih zadataka i obveza",
}

export default async function ChecklistPage() {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
    redirect("/onboarding")
  }

  // Map legalForm to businessType
  const businessTypeMap: Record<string, string> = {
    OBRT_PAUSAL: "pausalni",
    OBRT_REAL: "obrt",
    OBRT_VAT: "obrt",
    JDOO: "doo",
    DOO: "doo",
  }
  const businessType = businessTypeMap[company.legalForm || ""] || "all"

  const [checklistData, preferences] = await Promise.all([
    getChecklist({
      userId: user.id!,
      companyId: company.id,
      businessType,
      limit: 50,
    }),
    getGuidancePreferences(user.id!),
  ])

  return (
    <ChecklistPageClient
      initialItems={checklistData.items}
      initialStats={checklistData.stats}
      preferences={preferences}
      companyName={company.name}
    />
  )
}
