import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Prisma } from "@prisma/client"
import Link from "next/link"

const Decimal = Prisma.Decimal

export default async function DashboardPage() {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
    redirect("/onboarding")
  }

  // Get counts and financial data
  const [
    eInvoiceCount,
    contactCount,
    productCount,
    draftInvoices,
    pendingInvoices,
    recentInvoices,
    totalRevenue,
  ] = await Promise.all([
    db.eInvoice.count({ where: { companyId: company.id } }),
    db.contact.count({ where: { companyId: company.id } }),
    db.product.count({ where: { companyId: company.id } }),
    db.eInvoice.count({
      where: { companyId: company.id, status: "DRAFT" },
    }),
    db.eInvoice.count({
      where: {
        companyId: company.id,
        status: { in: ["PENDING_FISCALIZATION", "SENT"] },
      },
    }),
    db.eInvoice.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        buyer: { select: { name: true } },
      },
    }),
    db.eInvoice.aggregate({
      where: {
        companyId: company.id,
        status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
      },
      _sum: { totalAmount: true },
    }),
  ])

  const totalRevenueValue = totalRevenue._sum.totalAmount || new Decimal(0)

  const statusLabels: Record<string, string> = {
    DRAFT: "Nacrt",
    PENDING_FISCALIZATION: "Fiskalizacija",
    FISCALIZED: "Fiskalizirano",
    SENT: "Poslano",
    DELIVERED: "Dostavljeno",
    ACCEPTED: "Prihvaceno",
    REJECTED: "Odbijeno",
    ERROR: "Greska",
  }

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    PENDING_FISCALIZATION: "bg-yellow-100 text-yellow-700",
    FISCALIZED: "bg-blue-100 text-blue-700",
    SENT: "bg-purple-100 text-purple-700",
    DELIVERED: "bg-green-100 text-green-700",
    ACCEPTED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    ERROR: "bg-red-100 text-red-700",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dobrodosli, {user.name || user.email}</h1>
          <p className="text-gray-600">{company.name}</p>
        </div>
        <Link
          href="/e-invoices/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Novi e-racun
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Ukupni prihod</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {totalRevenueValue.toFixed(2)} EUR
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">E-Racuni</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{eInvoiceCount}</p>
            {draftInvoices > 0 && (
              <p className="text-sm text-yellow-600">{draftInvoices} u nacrtu</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Kontakti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{contactCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Proizvodi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{productCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(draftInvoices > 0 || pendingInvoices > 0 || !company.eInvoiceProvider) && (
        <div className="space-y-2">
          {!company.eInvoiceProvider && (
            <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 p-4">
              <span className="text-red-600">!</span>
              <div className="flex-1">
                <p className="font-medium text-red-800">E-racuni nisu konfigurirani</p>
                <p className="text-sm text-red-600">Konfigurirajte posrednika u postavkama</p>
              </div>
              <Link
                href="/settings"
                className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
              >
                Postavke
              </Link>
            </div>
          )}
          {draftInvoices > 0 && (
            <div className="flex items-center gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-4">
              <span className="text-yellow-600">i</span>
              <div className="flex-1">
                <p className="font-medium text-yellow-800">{draftInvoices} racuna u nacrtu</p>
                <p className="text-sm text-yellow-600">Zavrssite ih i posaljite</p>
              </div>
              <Link
                href="/e-invoices?status=DRAFT"
                className="rounded bg-yellow-600 px-3 py-1 text-sm text-white hover:bg-yellow-700"
              >
                Pregledaj
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Nedavni e-racuni</span>
              <Link href="/e-invoices" className="text-sm font-normal text-blue-600 hover:underline">
                Vidi sve
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Nema e-racuna</p>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/e-invoices/${invoice.id}`}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-gray-500">{invoice.buyer?.name || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{Number(invoice.totalAmount).toFixed(2)} EUR</p>
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs ${
                          statusColors[invoice.status] || "bg-gray-100"
                        }`}
                      >
                        {statusLabels[invoice.status] || invoice.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fiskalizacija Status */}
        <Card>
          <CardHeader>
            <CardTitle>Fiskalizacija 2.0 Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border p-3">
                <span>PDV obveznik</span>
                <span
                  className={`rounded px-2 py-1 text-sm ${
                    company.isVatPayer ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {company.isVatPayer ? "Da" : "Ne"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span>Posrednik</span>
                <span
                  className={`rounded px-2 py-1 text-sm ${
                    company.eInvoiceProvider
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {company.eInvoiceProvider || "Nije konfiguriran"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span>OIB</span>
                <span className="font-mono text-sm">{company.oib}</span>
              </div>
              {company.vatNumber && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span>PDV broj</span>
                  <span className="font-mono text-sm">{company.vatNumber}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
