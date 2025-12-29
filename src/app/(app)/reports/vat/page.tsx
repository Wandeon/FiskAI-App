import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { protectRoute } from "@/lib/visibility/route-protection"

export default async function VatReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  // Visibility system route protection - VAT reports require VAT visibility
  await protectRoute("page:vat")

  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const params = await searchParams

  setTenantContext({ companyId: company.id, userId: user.id! })

  // Default to current quarter
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3)
  const defaultFrom = new Date(now.getFullYear(), quarter * 3, 1)
  const defaultTo = new Date(now.getFullYear(), quarter * 3 + 3, 0)

  const dateFrom = params.from ? new Date(params.from) : defaultFrom
  const dateTo = params.to ? new Date(params.to) : defaultTo

  // Get invoices (output VAT)
  const invoices = await db.eInvoice.findMany({
    where: {
      companyId: company.id,
      issueDate: { gte: dateFrom, lte: dateTo },
      status: { not: "DRAFT" },
    },
    select: { netAmount: true, vatAmount: true, totalAmount: true },
  })

  // Get expenses (input VAT)
  const expenses = await db.expense.findMany({
    where: {
      companyId: company.id,
      date: { gte: dateFrom, lte: dateTo },
      status: { in: ["PAID", "PENDING"] },
    },
    select: { netAmount: true, vatAmount: true, totalAmount: true, vatDeductible: true },
  })

  // Calculate totals
  const outputVat = {
    net: invoices.reduce((sum, i) => sum + Number(i.netAmount), 0),
    vat: invoices.reduce((sum, i) => sum + Number(i.vatAmount), 0),
    total: invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0),
  }

  const inputVat = {
    deductible: expenses
      .filter((e) => e.vatDeductible)
      .reduce((sum, e) => sum + Number(e.vatAmount), 0),
    nonDeductible: expenses
      .filter((e) => !e.vatDeductible)
      .reduce((sum, e) => sum + Number(e.vatAmount), 0),
    total: expenses.reduce((sum, e) => sum + Number(e.vatAmount), 0),
  }

  const vatPayable = outputVat.vat - inputVat.deductible

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PDV obrazac</h1>
          <p className="text-gray-500">
            Razdoblje: {dateFrom.toLocaleDateString("hr-HR")} - {dateTo.toLocaleDateString("hr-HR")}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/reports/vat/xml?from=${dateFrom.toISOString().split("T")[0]}&to=${dateTo.toISOString().split("T")[0]}`}
            download
          >
            <Button variant="default">Preuzmi XML za ePorezna</Button>
          </a>
          <Link href="/reports">
            <Button variant="outline">Natrag</Button>
          </Link>
        </div>
      </div>

      {/* Date filter */}
      <Card>
        <CardContent className="pt-4">
          <form className="flex gap-4 items-end" method="GET">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Od</label>
              <input
                type="date"
                name="from"
                defaultValue={dateFrom.toISOString().split("T")[0]}
                className="rounded-md border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Do</label>
              <input
                type="date"
                name="to"
                defaultValue={dateTo.toISOString().split("T")[0]}
                className="rounded-md border-gray-300"
              />
            </div>
            <Button type="submit">Primijeni</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Output VAT */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Izlazni PDV (iz računa)</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-500">Osnovica:</dt>
                <dd className="font-mono">{formatCurrency(outputVat.net)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">PDV:</dt>
                <dd className="font-mono font-bold">{formatCurrency(outputVat.vat)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2">
                <dt className="text-gray-500">Ukupno računi:</dt>
                <dd className="font-mono">{formatCurrency(outputVat.total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Input VAT */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ulazni PDV (iz troškova)</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-500">Priznati PDV:</dt>
                <dd className="font-mono font-bold text-green-600">
                  {formatCurrency(inputVat.deductible)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Nepriznati PDV:</dt>
                <dd className="font-mono text-gray-400">
                  {formatCurrency(inputVat.nonDeductible)}
                </dd>
              </div>
              <div className="flex justify-between border-t pt-2">
                <dt className="text-gray-500">Ukupno PDV:</dt>
                <dd className="font-mono">{formatCurrency(inputVat.total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card
        className={vatPayable >= 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}
      >
        <CardHeader>
          <CardTitle className="text-base">Obveza PDV-a</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt>Izlazni PDV:</dt>
              <dd className="font-mono">{formatCurrency(outputVat.vat)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Ulazni PDV (priznati):</dt>
              <dd className="font-mono">- {formatCurrency(inputVat.deductible)}</dd>
            </div>
            <div className="flex justify-between text-xl border-t pt-2">
              <dt className="font-medium">{vatPayable >= 0 ? "Za uplatu:" : "Za povrat:"}</dt>
              <dd
                className={`font-bold font-mono ${vatPayable >= 0 ? "text-red-600" : "text-green-600"}`}
              >
                {formatCurrency(Math.abs(vatPayable))}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
