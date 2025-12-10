import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default async function DashboardPage() {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
    redirect("/onboarding")
  }

  // Get counts
  const [eInvoiceCount, contactCount] = await Promise.all([
    db.eInvoice.count({ where: { companyId: company.id } }),
    db.contact.count({ where: { companyId: company.id } }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dobrodošli, {user.name || user.email}</h1>
        <p className="text-gray-600">{company.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">
              E-Računi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{eInvoiceCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">
              Kontakti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{contactCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">
              OIB
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-mono">{company.oib}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fiskalizacija 2.0 Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={company.isVatPayer ? "text-green-500" : "text-yellow-500"}>
                {company.isVatPayer ? "✓" : "○"}
              </span>
              <span>PDV obveznik: {company.isVatPayer ? "Da" : "Ne"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={company.eInvoiceProvider ? "text-green-500" : "text-red-500"}>
                {company.eInvoiceProvider ? "✓" : "✗"}
              </span>
              <span>
                Informacijski posrednik:{" "}
                {company.eInvoiceProvider || "Nije konfiguriran"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
