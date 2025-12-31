import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function ExpensesByCategoryPage({
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

  // Get expenses grouped by category
  const expenses = await db.expense.findMany({
    where: {
      companyId: company.id,
      date: { gte: dateFrom, lte: dateTo },
      status: { in: ["PAID", "PENDING"] },
    },
    include: {
      category: {
        select: { id: true, name: true, code: true },
      },
    },
  })

  // Group expenses by category
  const categoryMap = new Map<
    string,
    {
      name: string
      code: string
      netAmount: number
      vatAmount: number
      totalAmount: number
      count: number
    }
  >()

  for (const expense of expenses) {
    const categoryId = expense.category.id
    const existing = categoryMap.get(categoryId)

    if (existing) {
      existing.netAmount += Number(expense.netAmount)
      existing.vatAmount += Number(expense.vatAmount)
      existing.totalAmount += Number(expense.totalAmount)
      existing.count += 1
    } else {
      categoryMap.set(categoryId, {
        name: expense.category.name,
        code: expense.category.code,
        netAmount: Number(expense.netAmount),
        vatAmount: Number(expense.vatAmount),
        totalAmount: Number(expense.totalAmount),
        count: 1,
      })
    }
  }

  // Convert to array and sort by total amount descending
  const categoryStats = Array.from(categoryMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount
  )

  const totalExpenses = categoryStats.reduce((sum, cat) => sum + cat.totalAmount, 0)
  const totalNet = categoryStats.reduce((sum, cat) => sum + cat.netAmount, 0)
  const totalVat = categoryStats.reduce((sum, cat) => sum + cat.vatAmount, 0)

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(n)

  const formatPercent = (n: number) =>
    totalExpenses > 0 ? ((n / totalExpenses) * 100).toFixed(1) : "0.0"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Troškovi po kategoriji</h1>
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
            <CardTitle className="text-base text-danger-text">Ukupno rashodi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono text-danger-text">
              {formatCurrency(totalExpenses)}
            </p>
            <p className="text-sm text-secondary">{expenses.length} troškova</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rashodi po kategorijama</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryStats.length === 0 ? (
            <p className="text-secondary text-center py-8">Nema troškova u odabranom razdoblju</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Kategorija</th>
                    <th className="pb-2 font-medium text-right">Broj</th>
                    <th className="pb-2 font-medium text-right">Neto</th>
                    <th className="pb-2 font-medium text-right">PDV</th>
                    <th className="pb-2 font-medium text-right">Ukupno</th>
                    <th className="pb-2 font-medium text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryStats.map((cat) => (
                    <tr key={cat.code} className="border-b last:border-0">
                      <td className="py-3">
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-secondary text-sm ml-2">({cat.code})</span>
                      </td>
                      <td className="py-3 text-right text-secondary">{cat.count}</td>
                      <td className="py-3 text-right font-mono">{formatCurrency(cat.netAmount)}</td>
                      <td className="py-3 text-right font-mono text-secondary">
                        {formatCurrency(cat.vatAmount)}
                      </td>
                      <td className="py-3 text-right font-mono font-medium">
                        {formatCurrency(cat.totalAmount)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-surface-2 rounded-full h-2">
                            <div
                              className="bg-interactive h-2 rounded-full"
                              style={{ width: `${formatPercent(cat.totalAmount)}%` }}
                            />
                          </div>
                          <span className="text-sm text-secondary w-12 text-right">
                            {formatPercent(cat.totalAmount)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="pt-3">Ukupno</td>
                    <td className="pt-3 text-right">{expenses.length}</td>
                    <td className="pt-3 text-right font-mono">{formatCurrency(totalNet)}</td>
                    <td className="pt-3 text-right font-mono">{formatCurrency(totalVat)}</td>
                    <td className="pt-3 text-right font-mono">{formatCurrency(totalExpenses)}</td>
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
