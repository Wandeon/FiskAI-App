import Link from "next/link"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { fetchKpr, kprToCsv, posdXml } from "@/lib/reports/kpr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Suspense } from "react"
import { FileSpreadsheet, FileText, Download } from "lucide-react"
import { protectRoute } from "@/lib/visibility/route-protection"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(value || 0)
}

type SearchParams = { from?: string; to?: string; preset?: string }

export default async function KprPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  // Visibility system route protection - KPR is for pausalni obrt
  await protectRoute("page:reports")

  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const resolvedSearchParams = await searchParams

  // Handle date presets
  let from: Date | undefined
  let to: Date | undefined

  const preset = resolvedSearchParams?.preset
  const now = new Date()

  if (preset === "thisMonth") {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  } else if (preset === "lastMonth") {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    to = new Date(now.getFullYear(), now.getMonth(), 0)
  } else if (preset === "thisQuarter") {
    const quarter = Math.floor(now.getMonth() / 3)
    from = new Date(now.getFullYear(), quarter * 3, 1)
    to = new Date(now.getFullYear(), quarter * 3 + 3, 0)
  } else if (preset === "lastQuarter") {
    const quarter = Math.floor(now.getMonth() / 3) - 1
    const year = quarter < 0 ? now.getFullYear() - 1 : now.getFullYear()
    const adjustedQuarter = quarter < 0 ? 3 : quarter
    from = new Date(year, adjustedQuarter * 3, 1)
    to = new Date(year, adjustedQuarter * 3 + 3, 0)
  } else if (preset === "thisYear") {
    from = new Date(now.getFullYear(), 0, 1)
    to = new Date(now.getFullYear(), 11, 31)
  } else if (preset === "lastYear") {
    from = new Date(now.getFullYear() - 1, 0, 1)
    to = new Date(now.getFullYear() - 1, 11, 31)
  } else {
    from = resolvedSearchParams?.from ? new Date(resolvedSearchParams.from) : undefined
    to = resolvedSearchParams?.to ? new Date(resolvedSearchParams.to) : undefined
  }

  const summary = await fetchKpr(company.id, from, to)
  const rangeParams = buildRange({
    from: from?.toISOString().slice(0, 10),
    to: to?.toISOString().slice(0, 10),
  })
  const csvUrl = `/api/reports/kpr${rangeParams}`
  const pdfUrl = `/api/reports/kpr/pdf${rangeParams}`
  const excelUrl = `/api/reports/kpr/excel${rangeParams}`
  const posdXmlString = posdXml(summary, from, to)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Paušalni obrt — knjiga prometa / PO-SD</p>
        <h1 className="text-2xl font-bold">KPR i PO-SD</h1>
        <p className="text-muted-foreground">
          Pregled uplaćenih računa po mjesecima i sažetak za PO-SD. Podaci su dostupni unutar
          aplikacije; izvoz je opcionalan.
        </p>
      </div>

      <Filters from={from} to={to} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Knjiga Primitaka i Izdataka (KPR)</CardTitle>
              <CardDescription>Prihodi i troškovi s računanjem salda</CardDescription>
            </div>
            <Badge variant="secondary">{summary.rows.length} stavki</Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(summary.byMonth).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nema transakcija u odabranom periodu.</p>
            ) : (
              Object.entries(summary.byMonth).map(([month, group]) => (
                <div key={month} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{getMonthName(month)}</p>
                      <Badge variant="outline">{group.rows.length} transakcija</Badge>
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      <span className="text-success-icon">
                        +{formatCurrency(group.totalIncome)}
                      </span>
                      {" / "}
                      <span className="text-danger-text">
                        -{formatCurrency(group.totalExpense)}
                      </span>
                      {" = "}
                      <span
                        className={group.netIncome >= 0 ? "text-success-icon" : "text-danger-text"}
                      >
                        {formatCurrency(group.netIncome)}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-border bg-muted/40">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Rb.</th>
                          <th className="px-3 py-2 text-left">Datum</th>
                          <th className="px-3 py-2 text-left">Dokument</th>
                          <th className="px-3 py-2 text-left">Opis</th>
                          <th className="px-3 py-2 text-right">Primitak</th>
                          <th className="px-3 py-2 text-right">Izdatak</th>
                          <th className="px-3 py-2 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((r, idx) => (
                          <tr key={idx} className="border-t border-border/80">
                            <td className="px-3 py-2 text-muted-foreground">
                              {summary.rows.indexOf(r) + 1}
                            </td>
                            <td className="px-3 py-2">{fmt(r.date)}</td>
                            <td className="px-3 py-2 font-mono text-xs text-foreground">
                              {r.documentNumber}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{r.description}</td>
                            <td className="px-3 py-2 text-right text-success-icon">
                              {r.income > 0 ? formatCurrency(r.income) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-danger-text">
                              {r.expense > 0 ? formatCurrency(r.expense) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {formatCurrency(r.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sažetak</CardTitle>
            <CardDescription>Ukupno prema odabranom periodu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Period</p>
              <p className="text-sm font-medium text-foreground">{fmtRange(from, to)}</p>
              <p className="text-xs text-muted-foreground">{summary.rows.length} transakcija</p>
            </div>

            <div className="space-y-2 rounded-lg border border-success-border bg-success-bg px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-success-text">
                Primitak (Prihod)
              </p>
              <p className="text-2xl font-bold text-success-text">
                {formatCurrency(summary.totalIncome)}
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-danger-text">
                Izdatak (Trošak)
              </p>
              <p className="text-2xl font-bold text-danger-text">
                {formatCurrency(summary.totalExpense)}
              </p>
            </div>

            <div
              className={`space-y-2 rounded-lg border px-3 py-2 ${
                summary.netIncome >= 0
                  ? "border-info-border bg-info-bg"
                  : "border-warning-border bg-warning-bg"
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  summary.netIncome >= 0 ? "text-link" : "text-warning-text"
                }`}
              >
                Neto {summary.netIncome >= 0 ? "Dobit" : "Gubitak"}
              </p>
              <p
                className={`text-2xl font-bold ${
                  summary.netIncome >= 0 ? "text-link" : "text-warning-text"
                }`}
              >
                {formatCurrency(Math.abs(summary.netIncome))}
              </p>
            </div>

            {summary.byQuarter && Object.keys(summary.byQuarter).length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Kvartalni pregled
                </p>
                {Object.entries(summary.byQuarter).map(([quarter, data]) => (
                  <div key={quarter} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{quarter}</span>
                    <span
                      className={data.netIncome >= 0 ? "text-success-icon" : "text-danger-text"}
                    >
                      {formatCurrency(data.netIncome)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t pt-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Izvoz izvješća
              </p>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={pdfUrl}>
                    <FileText className="h-4 w-4 mr-2" />
                    PDF izvoz
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={excelUrl}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel izvoz
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={csvUrl}>
                    <Download className="h-4 w-4 mr-2" />
                    CSV izvoz
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`data:text/xml;charset=utf-8,${encodeURIComponent(posdXmlString)}`}
                    download="posd-report.xml"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PO-SD XML
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                PDF i Excel uključuju potpuni pregled s mjesečnim i kvartalnim sažetkom.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function buildRange(params?: SearchParams): string {
  if (!params) return ""
  const qs = new URLSearchParams()
  if (params.from) qs.set("from", params.from)
  if (params.to) qs.set("to", params.to)
  const query = qs.toString()
  return query ? `?${query}` : ""
}

function fmt(date: Date | null | undefined) {
  if (!date) return "—"
  return date.toLocaleDateString("hr-HR")
}

function fmtRange(from?: Date, to?: Date) {
  if (!from && !to) return "Cijeli period"
  const parts = []
  if (from) parts.push(`od ${fmt(from)}`)
  if (to) parts.push(`do ${fmt(to)}`)
  return parts.join(" ")
}

function Filters({ from, to }: { from?: Date; to?: Date }) {
  const fromVal = from ? from.toISOString().slice(0, 10) : ""
  const toVal = to ? to.toISOString().slice(0, 10) : ""

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filteri</CardTitle>
        <CardDescription>Odaberite period za KPR izvješće</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick presets */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Brzi odabir</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports/kpr?preset=thisMonth">Ovaj mjesec</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports/kpr?preset=lastMonth">Prošli mjesec</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports/kpr?preset=thisQuarter">Ovaj kvartal</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports/kpr?preset=lastQuarter">Prošli kvartal</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports/kpr?preset=thisYear">Ova godina</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports/kpr?preset=lastYear">Prošla godina</Link>
            </Button>
          </div>
        </div>

        {/* Custom date range */}
        <div className="border-t pt-4">
          <form className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="from">
                Od datuma
              </label>
              <input
                id="from"
                type="date"
                name="from"
                defaultValue={fromVal}
                className="h-10 w-full rounded-md border border-border bg-background px-3"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="to">
                Do datuma
              </label>
              <input
                id="to"
                type="date"
                name="to"
                defaultValue={toVal}
                className="h-10 w-full rounded-md border border-border bg-background px-3"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Primijeni</Button>
              <Button type="reset" variant="outline" asChild>
                <Link href="/reports/kpr">Poništi</Link>
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

function getMonthName(monthKey: string): string {
  if (monthKey === "unknown") return "Nepoznati period"
  const [year, month] = monthKey.split("-")
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
  return `${monthNames[parseInt(month) - 1]} ${year}`
}
