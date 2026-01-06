// src/app/(dashboard)/reports/vat-threshold/page.tsx
// VAT threshold monitoring page for Croatian compliance

import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/ui/progress-bar"
import {
  TrendingUp,
  AlertTriangle,
  Shield,
  Euro,
  BarChart3,
  Target,
  Scale,
  CheckCircle,
  XCircle,
  FileText,
  Download,
} from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/format"
import { logger } from "@/lib/logger"
import { calculateVatThresholdProgress } from "@/lib/reports/kpr-generator"
import { protectRoute } from "@/lib/visibility/route-protection"

interface VatThresholdData {
  annualRevenue: number
  vatThreshold: number // 40,000 EUR
  percentage: number
  status: "BELOW" | "WARNING" | "EXCEEDED"
  monthlyBreakdown: Array<{
    month: number
    monthName: string
    revenue: number
    percentageOfThreshold: number
  }>
  projectedAnnualRevenue: number
  remainingUntilThreshold: number
  daysLeftInYear: number
  estimatedDailyRevenueNeeded: number
}

export default async function VatThresholdReportPage() {
  // Visibility system route protection - VAT threshold reports
  await protectRoute("page:reports")

  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  // Get VAT threshold data for current year
  const currentYear = new Date().getFullYear()
  const vatThresholdData = await calculateVatThresholdProgress(company.id, currentYear)

  // Calculate monthly breakdown
  const monthlyRevenue = await db.eInvoice.groupBy({
    where: {
      companyId: company.id,
      direction: "OUTBOUND",
      status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
      issueDate: {
        gte: new Date(currentYear, 0, 1),
        lte: new Date(currentYear, 11, 31),
      },
    },
    by: ["issueDate"],
    _sum: {
      totalAmount: true,
    },
  })

  // Group revenue by month
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const monthNames = [
    "Siječanj",
    "Veljača",
    "Ožujak",
    "Travanj",
    "Svibanj",
    "Lipanj",
    "Srpanj",
    "Kolovoz",
    "Rujan",
    "Listopad",
    "Studeni",
    "Prosinac",
  ]

  const monthlyBreakdown = months.map((month) => {
    const monthStart = new Date(currentYear, month - 1, 1)
    const monthEnd = new Date(currentYear, month, 0) // Last day of month

    const monthRevenue = monthlyRevenue
      .filter((item) => item.issueDate >= monthStart && item.issueDate <= monthEnd)
      .reduce((sum, item) => sum + Number(item._sum.totalAmount!), 0)

    return {
      month,
      monthName: monthNames[month - 1],
      revenue: Number(monthRevenue.toFixed(2)),
      percentageOfThreshold: Number(
        ((monthRevenue / vatThresholdData.vatThreshold) * 100).toFixed(2)
      ),
    }
  })

  // Calculate projections
  const currentDate = new Date()
  const daysIntoYear = Math.floor(
    (currentDate.getTime() - new Date(currentYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)
  )
  const daysInYear = 365 // Simplified for leap year
  const daysLeftInYear = Math.max(0, daysInYear - daysIntoYear)

  const projectedAnnualRevenue =
    daysIntoYear > 0 ? (vatThresholdData.annualRevenue / daysIntoYear) * daysInYear : 0

  const remainingUntilThreshold = Math.max(
    0,
    vatThresholdData.vatThreshold - vatThresholdData.annualRevenue
  )
  const estimatedDailyRevenueNeeded =
    daysLeftInYear > 0 ? remainingUntilThreshold / daysLeftInYear : 0

  const reportData: VatThresholdData = {
    annualRevenue: vatThresholdData.annualRevenue,
    vatThreshold: vatThresholdData.vatThreshold,
    percentage: vatThresholdData.percentage,
    status: vatThresholdData.status,
    monthlyBreakdown,
    projectedAnnualRevenue: Number(projectedAnnualRevenue.toFixed(2)),
    remainingUntilThreshold: Number(remainingUntilThreshold.toFixed(2)),
    daysLeftInYear,
    estimatedDailyRevenueNeeded: Number(estimatedDailyRevenueNeeded.toFixed(2)),
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VAT Prag Praćenje</h1>
          <p className="text-muted-foreground">
            Praćenje prihoda prema 40.000 € pragu za obvezu prijave PDV-a (godina: {currentYear})
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports">
              <BarChart3 className="h-4 w-4 mr-2" />
              Svi izvještaji
            </Link>
          </Button>
          <Button asChild>
            <Link href="/settings/premises">
              <Shield className="h-4 w-4 mr-2" />
              Postavke PDV-a
            </Link>
          </Button>
        </div>
      </div>

      {/* Threshold Progress Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Trenutni prihod</CardTitle>
            <div className="flex items-center gap-1">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Godišnje</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success-icon">
              {formatCurrency(reportData.annualRevenue, "EUR")}
            </div>
            <p className="text-xs text-muted-foreground">
              {reportData.percentage.toFixed(2)}% od 40.000 €
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Prag PDV-a</CardTitle>
            <div className="flex items-center gap-1">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Obveza prijave</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-link">
              {formatCurrency(reportData.vatThreshold, "EUR")}
            </div>
            <p className="text-xs text-muted-foreground">Prema Zakonu o PDV-u</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Preostalo do praga</CardTitle>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Za ostvarenje</span>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                reportData.remainingUntilThreshold > 0 ? "text-warning-text" : "text-success-icon"
              }`}
            >
              {formatCurrency(reportData.remainingUntilThreshold, "EUR")}
            </div>
            <p className="text-xs text-muted-foreground">
              {reportData.daysLeftInYear} dana preostalo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Projekcija</CardTitle>
            <div className="flex items-center gap-1">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Procjena za godinu</span>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                reportData.projectedAnnualRevenue >= reportData.vatThreshold
                  ? "text-danger-text"
                  : "text-chart-1"
              }`}
            >
              {formatCurrency(reportData.projectedAnnualRevenue, "EUR")}
            </div>
            <p className="text-xs text-muted-foreground">
              {reportData.projectedAnnualRevenue >= reportData.vatThreshold
                ? "PREKO PRAGA"
                : "ISPRAVNO"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Napredak prema pragu PDV-a
          </CardTitle>
          <CardDescription>
            {currentYear} godina - {formatCurrency(reportData.vatThreshold, "EUR")} prag za obvezu
            PDV-a
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Napredak</span>
              <span className="text-sm font-semibold">{reportData.percentage.toFixed(2)}%</span>
            </div>
            <ProgressBar value={Math.min(reportData.percentage, 100)} className="h-3" />
            <div className="flex justify-between text-sm">
              <span>{formatCurrency(reportData.annualRevenue, "EUR")} prihoda</span>
              <span>{formatCurrency(reportData.vatThreshold, "EUR")} prag</span>
            </div>

            <div className="mt-4 pt-4 border-t">
              <h3 className="font-medium mb-2">Status</h3>
              <Badge
                variant={
                  reportData.status === "EXCEEDED"
                    ? "destructive"
                    : reportData.status === "WARNING"
                      ? "secondary"
                      : "default"
                }
                className="text-sm"
              >
                {reportData.status === "EXCEEDED" ? (
                  <>
                    <XCircle className="h-4 w-4 mr-1" />
                    PREKORAČENO - Obvezan PDV
                  </>
                ) : reportData.status === "WARNING" ? (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    POZOR - Blizu praga
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    ISPRAVNO - Ispod praga
                  </>
                )}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Mjesečni prikaz prihoda
          </CardTitle>
          <CardDescription>
            Distribucija prihoda po mjesecima za {currentYear}. godinu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reportData.monthlyBreakdown.map((month, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{month.monthName}</span>
                  <span>
                    {formatCurrency(month.revenue, "EUR")} ({month.percentageOfThreshold}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-interactive"
                    style={{
                      width: `${Math.min(month.percentageOfThreshold * 2.5, 100)}%`,
                      backgroundColor:
                        month.percentageOfThreshold >= 100
                          ? "var(--danger)" // Red if over threshold
                          : month.percentageOfThreshold >= 85
                            ? "var(--warning)" // Amber if approaching
                            : "var(--interactive)", // Blue if normal
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations and Actions */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Preporuke
            </CardTitle>
            <CardDescription>Akcije koje možete poduzeti na temelju statusa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportData.status === "EXCEEDED" && (
                <div className="p-3 bg-danger-bg border border-danger-border rounded-lg">
                  <h4 className="font-medium text-danger-text flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    Obvezan PDV
                  </h4>
                  <p className="text-sm text-danger-text mt-1">
                    Prekoračili ste prag od 40.000 €. Obvezni ste prijaviti PDV.
                  </p>
                  <Button variant="outline" size="sm" className="mt-2" asChild>
                    <Link href="/settings?tab=vat">Postavi PDV status</Link>
                  </Button>
                </div>
              )}

              {reportData.status === "WARNING" && (
                <div className="p-3 bg-warning-bg border border-warning-border rounded-lg">
                  <h4 className="font-medium text-warning-text flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Opasna zona
                  </h4>
                  <p className="text-sm text-warning-text mt-1">
                    Na putu ste da prekoračite prag od 40.000 €. Procijenjeno{" "}
                    {formatCurrency(reportData.projectedAnnualRevenue, "EUR")}
                  </p>
                  <Button variant="outline" size="sm" className="mt-2" asChild>
                    <Link href="/settings?tab=vat">Planiraj promjene</Link>
                  </Button>
                </div>
              )}

              {reportData.status === "BELOW" && (
                <div className="p-3 bg-success-bg border border-success-border rounded-lg">
                  <h4 className="font-medium text-success-text flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Ispravan status
                  </h4>
                  <p className="text-sm text-success-text mt-1">
                    Ispod praga PDV-a. Trenutno ste izuzeći od obveze PDV-a.
                  </p>
                  <p className="text-sm text-success-icon mt-1">
                    Ako nastavite trenutnom stopom, procijenjeno je{" "}
                    {formatCurrency(reportData.projectedAnnualRevenue, "EUR")}
                  </p>
                </div>
              )}

              <div className="p-3 bg-info-bg border border-info-border rounded-lg">
                <h4 className="font-medium text-info-text flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Procjena za preostatak godine
                </h4>
                <p className="text-sm text-link mt-1">
                  Još {formatCurrency(reportData.remainingUntilThreshold, "EUR")} do praga
                </p>
                <p className="text-sm text-link">
                  Trebate {formatCurrency(reportData.estimatedDailyRevenueNeeded, "EUR")} dnevno za
                  ostvarenje praga do kraja godine (ako želite)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Poslovni savjeti
            </CardTitle>
            <CardDescription>Informacije za poslovne odluke na temelju praga</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-info-bg p-1">
                  <Scale className="h-4 w-4 text-link" />
                </div>
                <div>
                  <h4 className="font-medium">PDV registracija</h4>
                  <p className="text-sm text-muted-foreground">
                    Ako prekoračite prag, morate se registrirati kod Porezne uprave u roku od 5 dana
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-success-bg p-1">
                  <CheckCircle className="h-4 w-4 text-success-icon" />
                </div>
                <div>
                  <h4 className="font-medium">Paušalni obrt status</h4>
                  <p className="text-sm text-muted-foreground">
                    Paušalni obrtnici su oslobođeni PDV-a do praga od 40.000 € godišnje
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-chart-2/10 p-1">
                  <Target className="h-4 w-4 text-chart-1" />
                </div>
                <div>
                  <h4 className="font-medium">Planiranje rasta</h4>
                  <p className="text-sm text-muted-foreground">
                    Koristite ovaj izvještaj za strategijsko planiranje rasta i poslovanja
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-warning-bg p-1">
                  <AlertTriangle className="h-4 w-4 text-warning-text" />
                </div>
                <div>
                  <h4 className="font-medium">Revizija poslovanja</h4>
                  <p className="text-sm text-muted-foreground">
                    Prije prekoračenja praga razmotrite promjenu oblika poslovanja
                  </p>
                </div>
              </div>
            </div>

            <Button variant="outline" className="w-full mt-4" asChild>
              <Link href="/docs/tax-compliance">
                <FileText className="h-4 w-4 mr-2" />
                Croatian Tax Guidelines
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Izvoz izvješća
          </CardTitle>
          <CardDescription>
            Preuzmite izvješće u različitim formatima za arhivu ili računovodstvo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" asChild>
              <Link href={`/api/exports/vat-threshold?year=${currentYear}&format=pdf`}>
                <FileText className="h-4 w-4 mr-2" />
                PDF Izvješće
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/api/exports/vat-threshold?year=${currentYear}&format=excel`}>
                <FileText className="h-4 w-4 mr-2" />
                Excel Izvoz
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/api/exports/vat-threshold?year=${currentYear}&format=json`}>
                <FileText className="h-4 w-4 mr-2" />
                JSON Podaci
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
