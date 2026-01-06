import { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { PausalniDashboard } from "@/components/pausalni/pausalni-dashboard"

export const metadata: Metadata = {
  title: "Paušalni Compliance Hub | FiskAI",
  description: "Upravljajte svim obvezama vašeg paušalnog obrta na jednom mjestu",
}

export default async function PausalniDashboardPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  if (company.legalForm !== "OBRT_PAUSAL") {
    redirect("/")
  }

  return <PausalniDashboard companyId={company.id} />
}
