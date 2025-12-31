import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { deriveCapabilities } from "@/lib/capabilities"
import { redirect } from "next/navigation"
import { protectRoute } from "@/lib/visibility/route-protection"

const REPORTS = [
  {
    href: "/reports/vat",
    title: "PDV obrazac",
    description: "Pregled ulaznog i izlaznog PDV-a",
    icon: "📊",
  },
  {
    href: "/reports/profit-loss",
    title: "Dobit i gubitak",
    description: "Prihodi vs rashodi po razdoblju",
    icon: "📈",
  },
  {
    href: "/reports/aging",
    title: "Starost potraživanja",
    description: "Pregled dospjelih računa (30/60/90 dana)",
    icon: "⏰",
  },
  {
    href: "/reports/expenses",
    title: "Troškovi po kategoriji",
    description: "Analiza rashoda po kategorijama",
    icon: "💰",
  },
  {
    href: "/reports/revenue",
    title: "Prihodi po kupcu",
    description: "Analiza prihoda po kupcima",
    icon: "👥",
  },
  {
    href: "/reports/export",
    title: "Izvoz za knjigovođu",
    description: "CSV izvoz računa i troškova (datum od-do)",
    icon: "📦",
  },
  {
    href: "/reports/kpr",
    title: "KPR / PO-SD",
    description: "Plaćeni računi po mjesecima i PO-SD sažetak",
    icon: "📘",
  },
]

export default async function ReportsPage() {
  // Visibility system route protection
  await protectRoute("page:reports")

  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const capabilities = deriveCapabilities(company)
  if (capabilities.modules["reports-basic"]?.enabled === false) {
    redirect("/settings?tab=plan")
  }

  setTenantContext({ companyId: company.id, userId: user.id! })

  // Quick stats
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [invoiceStats, expenseStats] = await Promise.all([
    db.eInvoice.aggregate({
      where: {
        companyId: company.id,
        issueDate: { gte: startOfMonth, lte: endOfMonth },
        status: { not: "DRAFT" },
      },
      _sum: { totalAmount: true, vatAmount: true },
      _count: true,
    }),
    db.expense.aggregate({
      where: {
        companyId: company.id,
        date: { gte: startOfMonth, lte: endOfMonth },
        status: "PAID",
      },
      _sum: { totalAmount: true, vatAmount: true },
      _count: true,
    }),
  ])

  const formatCurrency = (n: number | null) =>
    new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(n || 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Izvještaji</h1>
        <p className="text-tertiary">Financijski izvještaji i analize</p>
      </div>

      {/* Monthly Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sažetak mjeseca ({now.toLocaleDateString("hr-HR", { month: "long", year: "numeric" })})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-tertiary">Prihodi</p>
              <p className="text-xl font-bold text-success-text">
                {formatCurrency(Number(invoiceStats._sum.totalAmount))}
              </p>
            </div>
            <div>
              <p className="text-sm text-tertiary">Izlazni PDV</p>
              <p className="text-xl font-bold">
                {formatCurrency(Number(invoiceStats._sum.vatAmount))}
              </p>
            </div>
            <div>
              <p className="text-sm text-tertiary">Rashodi</p>
              <p className="text-xl font-bold text-danger-text">
                {formatCurrency(Number(expenseStats._sum.totalAmount))}
              </p>
            </div>
            <div>
              <p className="text-sm text-tertiary">Ulazni PDV</p>
              <p className="text-xl font-bold">
                {formatCurrency(Number(expenseStats._sum.vatAmount))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Links */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{report.icon}</span>
                  {report.title}
                </CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
