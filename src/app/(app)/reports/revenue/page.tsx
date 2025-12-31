import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function RevenueByCustomerPage({
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

  // Get invoices with buyer info
  const invoices = await db.eInvoice.findMany({
    where: {
      companyId: company.id,
      issueDate: { gte: dateFrom, lte: dateTo },
      status: { not: "DRAFT" },
    },
    include: {
      buyer: {
        select: { id: true, name: true, oib: true },
      },
    },
  })

  // Group revenue by customer
  const customerMap = new Map<
    string,
    {
      name: string
      oib: string | null
      netAmount: number
      vatAmount: number
      totalAmount: number
      count: number
    }
  >()

  for (const invoice of invoices) {
    const customerId = invoice.buyerId || "unknown"
    const existing = customerMap.get(customerId)

    if (existing) {
      existing.netAmount += Number(invoice.netAmount)
      existing.vatAmount += Number(invoice.vatAmount)
      existing.totalAmount += Number(invoice.totalAmount)
      existing.count += 1
    } else {
      customerMap.set(customerId, {
        name: invoice.buyer?.name || "Nepoznati kupac",
        oib: invoice.buyer?.oib || null,
        netAmount: Number(invoice.netAmount),
        vatAmount: Number(invoice.vatAmount),
        totalAmount: Number(invoice.totalAmount),
        count: 1,
      })
    }
  }

  // Convert to array and sort by total amount descending
  const customerStats = Array.from(customerMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount
  )

  const totalRevenue = customerStats.reduce((sum, cust) => sum + cust.totalAmount, 0)
  const totalNet = customerStats.reduce((sum, cust) => sum + cust.netAmount, 0)
  const totalVat = customerStats.reduce((sum, cust) => sum + cust.vatAmount, 0)

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(n)

  const formatPercent = (n: number) =>
    totalRevenue > 0 ? ((n / totalRevenue) * 100).toFixed(1) : "0.0"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prihodi po kupcu</h1>
          <p className="text-secondary">
            {dateFrom.toLocaleDateString("hr-HR")} - {dateTo.toLocaleDateString("hr-HR")}
          </p>
        </div>
        <Link href="/reports">
          <Button variant="outline">Natrag</Button>
        </Link>
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

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-secondary">Ukupno neto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono">{formatCurrency(totalNet)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-secondary">Ukupno PDV</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono">{formatCurrency(totalVat)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-success-icon">Ukupno prihodi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono text-success-icon">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-sm text-secondary">{invoices.length} računa</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prihodi po kupcima</CardTitle>
        </CardHeader>
        <CardContent>
          {customerStats.length === 0 ? (
            <p className="text-secondary text-center py-8">Nema prihoda u odabranom razdoblju</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Kupac</th>
                    <th className="pb-2 font-medium text-right">Broj računa</th>
                    <th className="pb-2 font-medium text-right">Neto</th>
                    <th className="pb-2 font-medium text-right">PDV</th>
                    <th className="pb-2 font-medium text-right">Ukupno</th>
                    <th className="pb-2 font-medium text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {customerStats.map((cust, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-3">
                        <span className="font-medium">{cust.name}</span>
                        {cust.oib && (
                          <span className="text-secondary text-sm ml-2">(OIB: {cust.oib})</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-secondary">{cust.count}</td>
                      <td className="py-3 text-right font-mono">
                        {formatCurrency(cust.netAmount)}
                      </td>
                      <td className="py-3 text-right font-mono text-secondary">
                        {formatCurrency(cust.vatAmount)}
                      </td>
                      <td className="py-3 text-right font-mono font-medium">
                        {formatCurrency(cust.totalAmount)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-surface-2 rounded-full h-2">
                            <div
                              className="bg-success h-2 rounded-full"
                              style={{ width: `${formatPercent(cust.totalAmount)}%` }}
                            />
                          </div>
                          <span className="text-sm text-secondary w-12 text-right">
                            {formatPercent(cust.totalAmount)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="pt-3">Ukupno</td>
                    <td className="pt-3 text-right">{invoices.length}</td>
                    <td className="pt-3 text-right font-mono">{formatCurrency(totalNet)}</td>
                    <td className="pt-3 text-right font-mono">{formatCurrency(totalVat)}</td>
                    <td className="pt-3 text-right font-mono">{formatCurrency(totalRevenue)}</td>
                    <td className="pt-3 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
