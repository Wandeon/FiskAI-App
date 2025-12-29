import { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { CorporateTaxDashboard } from "@/components/corporate-tax/corporate-tax-dashboard"

export const metadata: Metadata = {
  title: "Porez na dobit | FiskAI",
  description: "Upravljanje porezom na dobit za d.o.o. i j.d.o.o.",
}

export default async function CorporateTaxPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  // Only DOO and JDOO can access corporate tax
  if (company.legalForm !== "DOO" && company.legalForm !== "JDOO") {
    redirect("/dashboard")
  }

  return <CorporateTaxDashboard companyId={company.id} companyName={company.name} />
}
