import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const params = await searchParams

  setTenantContext({ companyId: company.id, userId: user.id! })

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), 0, 1) // Start of year
  const defaultTo = now

  const dateFrom = params.from ? new Date(params.from) : defaultFrom
  const dateTo = params.to ? new Date(params.to) : defaultTo

  const [invoices, expenses] = await Promise.all([
    db.eInvoice.findMany({
      where: {
        companyId: company.id,
        issueDate: { gte: dateFrom, lte: dateTo },
        status: { not: "DRAFT" },
      },
      select: { netAmount: true },
    }),
    db.expense.findMany({
      where: {
        companyId: company.id,
        date: { gte: dateFrom, lte: dateTo },
        status: { in: ["PAID", "PENDING"] },
      },
      select: { netAmount: true },
    }),
  ])

  const revenue = invoices.reduce((sum, i) => sum + Number(i.netAmount), 0)
  const costs = expenses.reduce((sum, e) => sum + Number(e.netAmount), 0)
  const profit = revenue - costs

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dobit i gubitak</h1>
          <p className="text-secondary">
            {dateFrom.toLocaleDateString("hr-HR")} - {dateTo.toLocaleDateString("hr-HR")}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/reports/profit-loss/pdf?from=${dateFrom.toISOString().split("T")[0]}&to=${dateTo.toISOString().split("T")[0]}`}
            download
          >
            <Button variant="outline">Preuzmi PDF</Button>
          </a>
          <Link href="/reports">
            <Button variant="outline">← Natrag</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <form className="flex gap-4 items-end" method="GET">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Od</label>
              <input
                type="date"
                name="from"
                defaultValue={dateFrom.toISOString().split("T")[0]}
                className="rounded-md border-default"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Do</label>
              <input
                type="date"
                name="to"
                defaultValue={dateTo.toISOString().split("T")[0]}
                className="rounded-md border-default"
              />
            </div>
            <Button type="submit">Primijeni</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-success-icon">Prihodi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono">{formatCurrency(revenue)}</p>
            <p className="text-sm text-secondary">{invoices.length} računa</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-danger-text">Rashodi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono">{formatCurrency(costs)}</p>
            <p className="text-sm text-secondary">{expenses.length} troškova</p>
          </CardContent>
        </Card>
        <Card className={profit >= 0 ? "border-green-500 bg-success-bg" : "border-red-500 bg-danger-bg"}>
          <CardHeader>
            <CardTitle className="text-base">{profit >= 0 ? "Dobit" : "Gubitak"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-bold font-mono ${profit >= 0 ? "text-success-icon" : "text-danger-text"}`}
            >
              {formatCurrency(Math.abs(profit))}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
