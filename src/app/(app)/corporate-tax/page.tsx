import { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { CorporateTaxDashboard } from "@/components/corporate-tax/corporate-tax-dashboard"
import { fetchCorporateTaxBaseInputs } from "@/lib/reports/corporate-tax"

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

  const now = new Date()
  const periodFrom = new Date(now.getFullYear(), 0, 1)
  const periodTo = now
  const taxBaseInputs = await fetchCorporateTaxBaseInputs(company.id, periodFrom, periodTo)

  return <CorporateTaxDashboard companyName={company.name} taxBaseInputs={taxBaseInputs} />
}
