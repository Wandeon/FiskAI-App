// src/app/(dashboard)/accountant/page.tsx
// Accountant dashboard page providing comprehensive overview for accountants

import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Archive,
  FileArchive,
  Shield,
  Euro,
  Users,
  CreditCard,
  Settings,
  Receipt,
  DollarSign,
  Percent,
  BarChart3,
  Scale,
  Gauge,
  Activity,
  Download,
  Upload,
  Mail,
  Clock,
  CheckCircle,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Filter,
  Search,
} from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { logger } from "@/lib/logger"
import { calculateVatThresholdProgress } from "@/lib/reports/kpr-generator"

export default async function AccountantDashboardPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  // Get accountant-specific metrics
  const [
    pendingInvoices,
    pendingExpenses,
    pendingTickets,
    totalInvoices,
    totalExpenses,
    monthlyRevenue,
    vatThresholdProgress,
  ] = await Promise.all([
    // Invoices awaiting review (sent but not yet delivered/accepted)
    db.eInvoice.count({
      where: {
        companyId: company.id,
        status: { in: ["SENT", "DELIVERED"] },
      },
    }),
    // Expenses awaiting review (pending status)
    db.expense.count({
      where: {
        companyId: company.id,
        status: "PENDING",
      },
    }),
    // Support tickets assigned to accountants
    db.supportTicket.count({
      where: {
        companyId: company.id,
        assignedToId: user.id!, // Assigned to this accountant
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    }),
    // Total invoices
    db.eInvoice.count({
      where: {
        companyId: company.id,
        direction: "OUTBOUND",
      },
    }),
    // Total expenses
    db.expense.count({
      where: {
        companyId: company.id,
      },
    }),
    // Monthly revenue for current month (paid invoices)
    db.eInvoice.aggregate({
      where: {
        companyId: company.id,
        direction: "OUTBOUND",
        paidAt: { not: null },
        issueDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      },
      _sum: {
        totalAmount: true,
      },
    }),
    // VAT threshold progress (using the function we created)
    calculateVatThresholdProgress(company.id, new Date().getFullYear()).catch(() => ({
      annualRevenue: 0,
      vatThreshold: 40000,
      percentage: 0,
      status: "BELOW",
    })),
  ])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Radni prostor računovodstva</h1>
          <p className="text-muted-foreground">
            Kompletan pregled i alati za rad s računima, troškovima i poreskom dokumentacijom
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Izvoz
          </Button>
          <Button asChild size="sm">
            <Link href={`/reports?tab=kpr`}>
              <FileText className="h-4 w-4 mr-2" />
              Izvještaji
            </Link>
          </Button>
        </div>
      </div>

      {/* VAT Threshold Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Prag oporezivanja PDV-om
          </CardTitle>
          <CardDescription>
            Prag od 40.000 € za obvezu prijave PDV-a (godina: {new Date().getFullYear()})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Napredak</span>
              <span className="text-sm font-semibold">
                {vatThresholdProgress.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${
                  vatThresholdProgress.status === "EXCEEDED"
                    ? "bg-danger-bg0"
                    : vatThresholdProgress.status === "WARNING"
                      ? "bg-warning-bg0"
                      : "bg-interactive"
                }`}
                style={{ width: `${Math.min(vatThresholdProgress.percentage, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm">
              <span>{formatCurrency(vatThresholdProgress.annualRevenue, "EUR")}</span>
              <span>{formatCurrency(vatThresholdProgress.vatThreshold, "EUR")}</span>
            </div>
            <Badge
              variant={
                vatThresholdProgress.status === "EXCEEDED"
                  ? "destructive"
                  : vatThresholdProgress.status === "WARNING"
                    ? "secondary"
                    : "default"
              }
            >
              {vatThresholdProgress.status === "EXCEEDED"
                ? "PREKORAČENO"
                : vatThresholdProgress.status === "WARNING"
                  ? "POZOR"
                  : "ISPRAVNO"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Neobrađeni računi</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvoices}</div>
            <p className="text-xs text-muted-foreground">Čeka na odobrenje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Neobrađeni troškovi</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingExpenses}</div>
            <p className="text-xs text-muted-foreground">Čeka na obradu</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Otvorene kartice</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTickets}</div>
            <p className="text-xs text-muted-foreground">Dodeljene računovodstvu</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mjesečni prihod</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(Number(monthlyRevenue._sum?.totalAmount || 0), "EUR")}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleString("hr-HR", { month: "long", year: "numeric" })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pending Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Aktivnosti na čekanju
            </CardTitle>
            <CardDescription>Stavke koje zahtijevaju pažnju računovodstva</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-info-bg p-2">
                    <FileText className="h-4 w-4 text-link" />
                  </div>
                  <div>
                    <p className="font-medium">Računi na odobrenje</p>
                    <p className="text-sm text-muted-foreground">
                      Računi koje je izdao korisnik, ali treba potvrditi računovodstvo
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{pendingInvoices}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-success-bg p-2">
                    <Receipt className="h-4 w-4 text-success-text" />
                  </div>
                  <div>
                    <p className="font-medium">Troškovi na obradu</p>
                    <p className="text-sm text-muted-foreground">
                      Troškovi koje je unio korisnik, potrebna obrada i kategorizacija
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{pendingExpenses}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-chart-2/10 p-2">
                    <Mail className="h-4 w-4 text-chart-1" />
                  </div>
                  <div>
                    <p className="font-medium">Kartice računovodstva</p>
                    <p className="text-sm text-muted-foreground">
                      Zahtjevi korisnika za pomoć ili informacije
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{pendingTickets}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-warning-bg p-2">
                    <AlertTriangle className="h-4 w-4 text-warning-text" />
                  </div>
                  <div>
                    <p className="font-medium">Podsjetnici</p>
                    <p className="text-sm text-muted-foreground">
                      Ročni istekli računi, troškovi, ili očekivane aktivnosti
                    </p>
                  </div>
                </div>
                <Badge variant="outline">12</Badge>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/e-invoices?status=DELIVERED">
                  <Eye className="h-4 w-4 mr-2" />
                  Pregledaj račune
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/expenses?status=APPROVED">
                  <Edit className="h-4 w-4 mr-2" />
                  Obradi troškove
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Brzi izvještaji
            </CardTitle>
            <CardDescription>Često korišteni izvještaji i dokumenti</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/reports/kpr">
                  <FileText className="h-4 w-4 mr-2" />
                  Knjiga Prometa (KPR)
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/reports/posd">
                  <FileText className="h-4 w-4 mr-2" />
                  PO-SD Prijava
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/reports/vat">
                  <Percent className="h-4 w-4 mr-2" />
                  PDV Izvješće
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/reports/export">
                  <Archive className="h-4 w-4 mr-2" />
                  Arhivski paket
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/reports/aging">
                  <Clock className="h-4 w-4 mr-2" />
                  Starost obveznice
                </Link>
              </Button>
            </div>

            <div className="mt-6">
              <Button variant="outline" className="w-full" asChild>
                <Link href="/reports">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Svi izvještaji
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Important Links */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link href="/e-invoices">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-link" />
                E-fakture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pregledaj, odobri i arhiviraj izdane račune
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs">{totalInvoices} ukupno</span>
                <Badge variant="outline">{pendingInvoices} na čekanju</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/expenses">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-success-text" />
                Troškovi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pregledaj, kategoriziraj i odobri prijavljene troškove
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs">{totalExpenses} ukupno</span>
                <Badge variant="outline">{pendingExpenses} na čekanju</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-chart-1" />
                Sigurnost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Upravljanje pristupima, sigurnosnim ključevima i doprinosima
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs">Poslovni prostori</span>
                <Badge variant="outline">Konfigurirano</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
