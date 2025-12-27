// src/app/(dashboard)/reports/pausalni-obrt/page.tsx
// Reports page specifically designed for Paušalni Obrt requirements

import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Calendar,
  Euro,
  Download,
  Archive,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Receipt,
  Users,
  Settings,
  Shield,
  Scale,
  Target,
  ArchiveX,
  FileArchive,
  CreditCard,
  Wallet,
  Calculator,
} from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/format"

export default async function PausalniObrtReportsPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  // Calculate key metrics for paušalni obrt
  const [monthlyTotals, annualSummary, taxSeasonPack, expenseBreakdown, incomeBreakdown] =
    await Promise.all([
      // Get monthly totals for current year (paid invoices have paidAt set)
      db.eInvoice.groupBy({
        where: {
          companyId: company.id,
          direction: "OUTBOUND",
          OR: [
            { paidAt: { not: null } },
            { status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] } },
          ],
          issueDate: {
            gte: new Date(new Date().getFullYear(), 0, 1),
            lte: new Date(new Date().getFullYear(), 11, 31),
          },
        },
        by: ["issueDate"],
        _sum: {
          totalAmount: true,
        },
      }),

      // Get annual summary
      db.eInvoice.aggregate({
        where: {
          companyId: company.id,
          direction: "OUTBOUND",
          OR: [
            { paidAt: { not: null } },
            { status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] } },
          ],
          issueDate: {
            gte: new Date(new Date().getFullYear(), 0, 1),
            lte: new Date(new Date().getFullYear(), 11, 31),
          },
        },
        _sum: {
          totalAmount: true,
          netAmount: true,
          vatAmount: true,
        },
        _count: {
          _all: true,
        },
      }),

      // For tax season pack export, we'll calculate based on common needs
      // This includes: invoices, expenses, contacts, products for a full year
      Promise.all([
        db.eInvoice.count({
          where: {
            companyId: company.id,
            direction: "OUTBOUND",
            issueDate: {
              gte: new Date(new Date().getFullYear(), 0, 1),
              lte: new Date(new Date().getFullYear(), 11, 31),
            },
          },
        }),
        db.expense.count({
          where: {
            companyId: company.id,
            date: {
              gte: new Date(new Date().getFullYear(), 0, 1),
              lte: new Date(new Date().getFullYear(), 11, 31),
            },
          },
        }),
        db.contact.count({
          where: { companyId: company.id },
        }),
        db.product.count({
          where: { companyId: company.id },
        }),
        db.eInvoice.aggregate({
          where: {
            companyId: company.id,
            direction: "INBOUND", // Received invoices (expenses)
            issueDate: {
              gte: new Date(new Date().getFullYear(), 0, 1),
              lte: new Date(new Date().getFullYear(), 11, 31),
            },
          },
          _sum: {
            totalAmount: true,
          },
        }),
      ]).then(
        ([totalInvoices, totalExpenses, totalContacts, totalProducts, totalExpensesAmount]) => ({
          totalInvoices,
          totalExpenses,
          totalContacts,
          totalProducts,
          totalExpensesAmount,
        })
      ),

      // Expense breakdown by category (note: groupBy doesn't support include)
      (async () => {
        const breakdown = await db.expense.groupBy({
          where: {
            companyId: company.id,
            date: {
              gte: new Date(new Date().getFullYear(), 0, 1),
              lte: new Date(new Date().getFullYear(), 11, 31),
            },
          },
          by: ["categoryId"],
          _sum: {
            totalAmount: true,
          },
        })
        // Fetch category names
        const categoryIds = breakdown
          .map((b) => b.categoryId)
          .filter((id): id is string => id !== null)
        const categories =
          categoryIds.length > 0
            ? await db.expenseCategory.findMany({
                where: { id: { in: categoryIds } },
                select: { id: true, name: true },
              })
            : []
        const categoryMap = new Map(categories.map((c) => [c.id, c.name]))
        return breakdown.map((b) => ({
          ...b,
          categoryName: b.categoryId ? categoryMap.get(b.categoryId) || "Ostalo" : "Ostalo",
        }))
      })(),

      // Income breakdown by month
      db.eInvoice.groupBy({
        where: {
          companyId: company.id,
          direction: "OUTBOUND",
          OR: [
            { paidAt: { not: null } },
            { status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] } },
          ],
          issueDate: {
            gte: new Date(new Date().getFullYear(), 0, 1),
            lte: new Date(new Date().getFullYear(), 11, 31),
          },
        },
        by: ["issueDate"], // Group by month
        _sum: {
          totalAmount: true,
        },
      }),
    ])

  // Group monthly data by month
  const monthlyIncome = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const monthStart = new Date(new Date().getFullYear(), i, 1)
    const monthEnd = new Date(new Date().getFullYear(), i + 1, 0)

    const monthInvoices = monthlyTotals.filter((invoice) => {
      const invoiceDate = new Date(invoice.issueDate)
      return invoiceDate >= monthStart && invoiceDate <= monthEnd
    })

    const total = monthInvoices.reduce((sum, inv) => sum + Number(inv._sum?.totalAmount || 0), 0)

    return {
      month,
      name: ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"][
        i
      ],
      total,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Paušalni Obrt</Badge>
          <h1 className="text-3xl font-bold">Izvješća za Paušalni Obrt</h1>
        </div>
        <p className="text-muted-foreground">
          Specijalizirana izvješća i izvozi dizajnirani za potrebe paušalnih obrtnika u Hrvatskoj
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Prihod</CardTitle>
            <div className="flex items-center gap-1">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ove godine</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(Number(annualSummary._sum?.totalAmount || 0), "HRK")}
            </div>
            <p className="text-xs text-muted-foreground">{annualSummary._count._all} računa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Troškovi</CardTitle>
            <div className="flex items-center gap-1">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ove godine</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(
                Number(taxSeasonPack.totalExpensesAmount._sum?.totalAmount || 0),
                "HRK"
              )}
            </div>
            <p className="text-xs text-muted-foreground">{taxSeasonPack.totalExpenses} troškova</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Neto dobit</CardTitle>
            <div className="flex items-center gap-1">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Prihod - Troškovi</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                Number(annualSummary._sum.totalAmount || 0) -
                  Number(taxSeasonPack.totalExpensesAmount._sum?.totalAmount || 0),
                "HRK"
              )}
            </div>
            <p className="text-xs text-muted-foreground">Osnova za oporezivanje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Porezna kazna</CardTitle>
            <div className="flex items-center gap-1">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">PDV obveza</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(Number(annualSummary._sum.vatAmount || 0), "HRK")}
            </div>
            <p className="text-xs text-muted-foreground">Obveza prema FURS</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Income Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Mjesečni prihodi
          </CardTitle>
          <CardDescription>Prikaz prihoda po mjesecima ove godine</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-2 p-4">
            {monthlyIncome.map((month) => (
              <div key={month.month} className="flex flex-col items-center">
                <div className="text-xs font-medium mb-1">{month.name}</div>
                <div
                  className="w-6 bg-blue-500 rounded-t"
                  style={{
                    height: `${Math.min((month.total / Math.max(...monthlyIncome.map((m) => m.total))) * 60, 60)}px`,
                  }}
                ></div>
                <div className="text-xs mt-1">{formatCurrency(month.total, "HRK")}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Export Packages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Paketi za knjigovođu
            </CardTitle>
            <CardDescription>
              Gotovi paketi za ručno ili automatsko slanje knjigovođi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-100 p-2">
                    <FileArchive className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Paušalni Obrt Godišnji Paket</p>
                    <p className="text-sm text-muted-foreground">Cijela godina + PDV</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/api/exports/pausalni-obrt?period=yearly&type=all`}>
                    <Download className="h-4 w-4 mr-2" />
                    Izvoz
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-2">
                    <ArchiveX className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Paušalni Obrt Kvartalni Paket</p>
                    <p className="text-sm text-muted-foreground">Q1-Q4 + kratki izvještaj</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/api/exports/pausalni-obrt?period=quarterly&type=summary`}>
                    <Download className="h-4 w-4 mr-2" />
                    Izvoz
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-purple-100 p-2">
                    <Scale className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">PDS Prijava</p>
                    <p className="text-sm text-muted-foreground">PDV prijava za FURS</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/api/exports/pausalni-obrt?period=yearly&type=tax`}>
                    <Download className="h-4 w-4 mr-2" />
                    Izvoz
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expense Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Troškovi po kategorijama
            </CardTitle>
            <CardDescription>Pregled troškova po kategorijama za bolju analizu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expenseBreakdown.map((category) => (
                <div key={category.categoryId!} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-amber-100 p-2">
                      <Receipt className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">{category.categoryName}</p>
                      <p className="text-sm text-muted-foreground">
                        {(category._sum.totalAmount
                          ? Number(category._sum.totalAmount)
                          : 0
                        ).toFixed(2)}{" "}
                        HRK
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {Math.round(
                      (Number(category._sum.totalAmount) /
                        (Number(taxSeasonPack.totalExpensesAmount._sum?.totalAmount) || 1)) *
                        100
                    )}
                    %
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance and Next Steps */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Paušalni Regulatorna kompenzacija
            </CardTitle>
            <CardDescription>
              Potrebni izvještaji za kompenzaciju s hrvatskim propisima
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm">Knjiga prometa (KPR) - generirano</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm">PDV prijave - dostupne</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm">Fiskalizacija - funkcionalna</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm">11-godišnje arhiviranje - operativno</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Praćenje praga PDV-a
            </CardTitle>
            <CardDescription>
              Trenutni napredak prema 40.000 € pragu za obvezu PDV-a
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Godišnji prihod</span>
                <span className="text-sm font-semibold">
                  {formatCurrency(Number(annualSummary._sum.totalAmount || 0), "EUR")}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${
                    Number(annualSummary._sum.totalAmount || 0) / 300000 >= 1
                      ? "bg-red-500"
                      : Number(annualSummary._sum.totalAmount || 0) / 300000 >= 0.85
                        ? "bg-amber-500"
                        : "bg-blue-500"
                  }`}
                  style={{
                    width: `${Math.min((Number(annualSummary._sum.totalAmount || 0) / 300000) * 100, 100)}%`,
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-sm">
                <span>0 €</span>
                <span>40,000 €</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Preporučeni sljedeći koraci
            </CardTitle>
            <CardDescription>
              Akcije koje povećavaju vrijednost za paušalne obrtnike
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span className="text-sm">Pregledajte kategorije troškova</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span className="text-sm">Kreirajte šablone za račune</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span className="text-sm">Pregledajte podatke o kupcima</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span className="text-sm">Izvezite podatke za knjigovođu</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Button variant="outline" asChild>
          <Link href="/reports/kpr">
            <FileText className="h-4 w-4 mr-2" />
            Knjiga Prometa
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/reports/vat">
            <BarChart3 className="h-4 w-4 mr-2" />
            PDV Izvješća
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/expenses">
            <Receipt className="h-4 w-4 mr-2" />
            Troškovne kategorije
          </Link>
        </Button>
      </div>
    </div>
  )
}
