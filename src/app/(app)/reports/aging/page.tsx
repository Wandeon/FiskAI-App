import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AgingReportTable } from "./aging-report-table"

export default async function AgingReportPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({ companyId: company.id, userId: user.id! })

  const now = new Date()
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const day60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // Get unpaid invoices
  const unpaidInvoices = await db.eInvoice.findMany({
    where: { companyId: company.id, status: { in: ["SENT", "DELIVERED"] }, dueDate: { not: null } },
    include: { buyer: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  })

  const aging = {
    current: unpaidInvoices.filter((i) => i.dueDate && i.dueDate >= now),
    days30: unpaidInvoices.filter((i) => i.dueDate && i.dueDate < now && i.dueDate >= day30),
    days60: unpaidInvoices.filter((i) => i.dueDate && i.dueDate < day30 && i.dueDate >= day60),
    days90: unpaidInvoices.filter((i) => i.dueDate && i.dueDate < day60 && i.dueDate >= day90),
    over90: unpaidInvoices.filter((i) => i.dueDate && i.dueDate < day90),
  }

  const totals = {
    current: aging.current.reduce((sum, i) => sum + Number(i.totalAmount), 0),
    days30: aging.days30.reduce((sum, i) => sum + Number(i.totalAmount), 0),
    days60: aging.days60.reduce((sum, i) => sum + Number(i.totalAmount), 0),
    days90: aging.days90.reduce((sum, i) => sum + Number(i.totalAmount), 0),
    over90: aging.over90.reduce((sum, i) => sum + Number(i.totalAmount), 0),
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Starost potraživanja</h1>
          <p className="text-gray-500">Pregled neplaćenih računa po dospjelosti</p>
        </div>
        <Link href="/reports">
          <Button variant="outline">← Natrag</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Tekući</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totals.current)}</p>
            <p className="text-xs text-gray-400">{aging.current.length} računa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">1-30 dana</p>
            <p className="text-xl font-bold text-yellow-600">{formatCurrency(totals.days30)}</p>
            <p className="text-xs text-gray-400">{aging.days30.length} računa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">31-60 dana</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(totals.days60)}</p>
            <p className="text-xs text-gray-400">{aging.days60.length} računa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">61-90 dana</p>
            <p className="text-xl font-bold text-red-500">{formatCurrency(totals.days90)}</p>
            <p className="text-xs text-gray-400">{aging.days90.length} računa</p>
          </CardContent>
        </Card>
        <Card className="border-red-500">
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">90+ dana</p>
            <p className="text-xl font-bold text-red-700">{formatCurrency(totals.over90)}</p>
            <p className="text-xs text-gray-400">{aging.over90.length} računa</p>
          </CardContent>
        </Card>
      </div>

      {unpaidInvoices.length > 0 && (
        <AgingReportTable invoices={unpaidInvoices} />
      )}
    </div>
  )
}
