"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Calculator, FileText, TrendingUp, Calendar, Info, ExternalLink, Euro } from "lucide-react"
import { TAX_RATES, getCorporateTaxRate } from "@/lib/fiscal-data/data/tax-rates"

interface Props {
  companyName: string
  taxBaseInputs: {
    periodFrom: Date
    periodTo: Date
    revenue: number
    expenses: number
    glExpenses: number
    depreciation: number
    payroll: number
    nonDeductibleExpenses: number
    accountingProfit: number
    taxBase: number
  }
}

export function CorporateTaxDashboard({ companyName, taxBaseInputs }: Props) {
  const estimatedRevenue = taxBaseInputs.revenue
  const estimatedProfit = taxBaseInputs.taxBase

  const taxRate = getCorporateTaxRate(estimatedRevenue)
  const taxRatePercent = taxRate * 100
  const estimatedTax = estimatedProfit * taxRate

  const isSmallCompany = estimatedRevenue <= TAX_RATES.corporate.small.maxRevenue
  const threshold = TAX_RATES.corporate.small.maxRevenue

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Porez na dobit</h1>
          <p className="text-muted-foreground">Upravljanje porezom na dobit za {companyName}</p>
        </div>
        <Badge variant={isSmallCompany ? "default" : "secondary"}>
          {isSmallCompany ? "Mala tvrtka (10%)" : "Velika tvrtka (18%)"}
        </Badge>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Porez na dobit u Hrvatskoj</AlertTitle>
        <AlertDescription>
          Stopa poreza na dobit iznosi <strong>{TAX_RATES.corporate.small.rate * 100}%</strong> za
          tvrtke s prihodima do {threshold.toLocaleString("hr-HR")} EUR, ili{" "}
          <strong>{TAX_RATES.corporate.large.rate * 100}%</strong> za tvrtke s vecim prihodima.
          Porezna osnovica je ostvarena dobit nakon odbitka dopustenih rashoda.
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prihodi (procjena)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estimatedRevenue.toLocaleString("hr-HR")} EUR</div>
            <p className="text-xs text-muted-foreground">Prihodi iz glavne knjige</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dobit (procjena)</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estimatedProfit.toLocaleString("hr-HR")} EUR</div>
            <p className="text-xs text-muted-foreground">Oporeziva dobit (osnovica)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stopa poreza</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taxRatePercent}%</div>
            <p className="text-xs text-muted-foreground">
              {isSmallCompany ? "Mala tvrtka" : "Velika tvrtka"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Procjena poreza</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estimatedTax.toLocaleString("hr-HR")} EUR</div>
            <p className="text-xs text-muted-foreground">Godisnji porez na dobit</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Osnovica poreza na dobit</CardTitle>
          <CardDescription>
            Pregled ulaznih stavki iz glavne knjige za odabrani period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Prihodi</span>
            <span className="font-medium">{taxBaseInputs.revenue.toLocaleString("hr-HR")} EUR</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Rashodi (glavna knjiga)</span>
            <span className="font-medium">
              {taxBaseInputs.glExpenses.toLocaleString("hr-HR")} EUR
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Amortizacija</span>
            <span className="font-medium">
              {taxBaseInputs.depreciation.toLocaleString("hr-HR")} EUR
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Plaće</span>
            <span className="font-medium">{taxBaseInputs.payroll.toLocaleString("hr-HR")} EUR</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <span>Ukupni rashodi</span>
            <span className="font-semibold">
              {taxBaseInputs.expenses.toLocaleString("hr-HR")} EUR
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Nedopušteni rashodi</span>
            <span className="font-medium">
              {taxBaseInputs.nonDeductibleExpenses.toLocaleString("hr-HR")} EUR
            </span>
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <span>Računovodstvena dobit</span>
            <span className="font-semibold">
              {taxBaseInputs.accountingProfit.toLocaleString("hr-HR")} EUR
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Porezna osnovica</span>
            <span className="font-semibold">
              {taxBaseInputs.taxBase.toLocaleString("hr-HR")} EUR
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* PD Obrazac Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              PD obrazac
            </CardTitle>
            <CardDescription>Prijava poreza na dobit - godisnji porezni obrazac</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              PD obrazac se podnosi do kraja travnja za prethodnu kalendarsku godinu. FiskAI ce vam
              pomoci s pripremom podataka za obrazac.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled>
                <Calendar className="h-4 w-4 mr-2" />
                Pripremi PD obrazac
              </Button>
              <Button variant="ghost" asChild>
                <a
                  href="https://www.porezna-uprava.hr/HR_obrasci/Stranice/ObsceraZaPoslovneKorisnike.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  e-Porezna
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quarterly Prepayments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Tromjesecne akontacije
            </CardTitle>
            <CardDescription>Predujmovi poreza na dobit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Akontacije poreza na dobit placaju se tromjesecno, do kraja mjeseca koji slijedi nakon
              zavrsetka tromjesecja.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Q1 (sijecanj - ozujak)</span>
                <span className="text-muted-foreground">rok: 30.04.</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Q2 (travanj - lipanj)</span>
                <span className="text-muted-foreground">rok: 31.07.</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Q3 (srpanj - rujan)</span>
                <span className="text-muted-foreground">rok: 31.10.</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Q4 (listopad - prosinac)</span>
                <span className="text-muted-foreground">rok: 31.01.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Rates Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Stope poreza na dobit {TAX_RATES.corporate.year}</CardTitle>
          <CardDescription>Pregled vazecih poreznih stopa prema visini prihoda</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg bg-success-bg dark:bg-green-950 border-success-border dark:border-green-800">
              <div className="text-2xl font-bold text-success-text dark:text-green-300">
                {TAX_RATES.corporate.small.rate * 100}%
              </div>
              <div className="text-sm text-success-text dark:text-green-400">
                Za tvrtke s prihodima do {threshold.toLocaleString("hr-HR")} EUR
              </div>
            </div>
            <div className="p-4 border rounded-lg bg-info-bg dark:bg-blue-950 border-info-border dark:border-blue-800">
              <div className="text-2xl font-bold text-link dark:text-blue-300">
                {TAX_RATES.corporate.large.rate * 100}%
              </div>
              <div className="text-sm text-link dark:text-blue-400">
                Za tvrtke s prihodima iznad {threshold.toLocaleString("hr-HR")} EUR
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
