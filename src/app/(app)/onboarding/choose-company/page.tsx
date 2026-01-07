import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth-utils"
import { getUserCompanies } from "@/lib/actions/company-switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChooseCompanyClient } from "./choose-company-client"

export default async function ChooseCompanyPage() {
  await requireAuth()
  const companies = await getUserCompanies()

  if (!companies.length) {
    redirect("/onboarding")
  }

  const alreadyHasDefault = companies.some((company) => company.isDefault)
  if (alreadyHasDefault) {
    redirect("/dashboard")
  }

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">Odaberite tvrtku</h1>
        <p className="mt-2 text-secondary">
          Prije nastavka odaberite tvrtku u kojoj želite raditi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dostupne tvrtke</CardTitle>
        </CardHeader>
        <CardContent>
          <ChooseCompanyClient
            companies={companies.map((company) => ({
              id: company.id,
              name: company.name,
              oib: company.oib,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
