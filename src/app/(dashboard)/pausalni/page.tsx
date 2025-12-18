import { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { ObligationTimeline } from "@/components/pausalni/obligation-timeline"

export const metadata: Metadata = {
  title: "Paušalni Compliance Hub | FiskAI",
  description: "Upravljajte svim obvezama vašeg paušalnog obrta na jednom mjestu",
}

export default async function PausalniDashboardPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  if (company.legalForm !== "OBRT_PAUSAL") {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paušalni Compliance Hub</h1>
          <p className="text-muted-foreground">Sve obveze vašeg paušalnog obrta na jednom mjestu</p>
        </div>
      </div>

      <ObligationTimeline companyId={company.id} />
    </div>
  )
}
