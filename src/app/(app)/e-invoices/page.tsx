import Link from "next/link"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { getEInvoices } from "@/app/actions/invoice"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { EInvoicesTable } from "./e-invoices-table"
import { deriveCapabilities } from "@/lib/capabilities"
import { redirect } from "next/navigation"
import { FileText } from "lucide-react"
import { VisibleButton } from "@/lib/visibility"

export default async function EInvoicesPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const capabilities = deriveCapabilities(company)
  if (capabilities.modules["e-invoicing"]?.enabled === false) {
    redirect("/settings?tab=plan")
  }

  const { items: eInvoices } = await getEInvoices()

  // Calculate summary stats
  const stats = {
    total: eInvoices.length,
    drafts: eInvoices.filter((i) => i.status === "DRAFT").length,
    sent: eInvoices.filter((i) => ["SENT", "DELIVERED", "ACCEPTED"].includes(i.status)).length,
    totalAmount: eInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">E-Računi</h1>
        <VisibleButton id="action:create-invoice" asChild>
          <Button asChild>
            <Link href="/e-invoices/new">Novi E-Račun</Link>
          </Button>
        </VisibleButton>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary">Ukupno računa</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary">Nacrti</p>
            <p className="text-2xl font-bold">{stats.drafts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary">Poslano</p>
            <p className="text-2xl font-bold">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary">Ukupni iznos</p>
            <p className="text-2xl font-bold">{stats.totalAmount.toFixed(2)} EUR</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      <Card>
        <CardContent className="p-0">
          {eInvoices.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="Nemate još nijedan e-račun"
                description="E-računi omogućuju brzu i sigurnu razmjenu dokumenata s kupcima. Kreirajte račun, fiskalizirajte ga i pošaljite u par klikova."
                action={
                  <VisibleButton id="action:create-invoice" asChild>
                    <Button asChild>
                      <Link href="/e-invoices/new">Kreiraj prvi e-račun</Link>
                    </Button>
                  </VisibleButton>
                }
              />
            </div>
          ) : (
            <EInvoicesTable data={eInvoices} hasProvider={!!company.eInvoiceProvider} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
