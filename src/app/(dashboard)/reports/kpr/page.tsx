import Link from "next/link"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { fetchKpr, kprToCsv, posdXml } from "@/lib/reports/kpr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Suspense } from "react"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(value || 0)
}

type SearchParams = { from?: string; to?: string }

export default async function KprPage({ searchParams }: { searchParams?: SearchParams }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const from = searchParams?.from ? new Date(searchParams.from) : undefined
  const to = searchParams?.to ? new Date(searchParams.to) : undefined

  const summary = await fetchKpr(company.id, from, to)
  const csvUrl = `/api/reports/kpr${buildRange(searchParams)}`
  const posdXmlString = posdXml(summary, from, to)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Paušalni obrt — knjiga prometa / PO-SD</p>
        <h1 className="text-2xl font-bold">KPR i PO-SD</h1>
        <p className="text-muted-foreground">
          Pregled uplaćenih računa po mjesecima i sažetak za PO-SD. Podaci su dostupni unutar aplikacije; izvoz je opcionalan.
        </p>
      </div>

      <Filters from={from} to={to} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Knjiga prometa (plaćeni računi)</CardTitle>
              <CardDescription>Grupirano po mjesecima prema datumu plaćanja</CardDescription>
            </div>
            <Badge variant="secondary">{summary.rows.length} stavki</Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(summary.byMonth).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nema plaćenih računa u odabranom periodu.</p>
            ) : (
              Object.entries(summary.byMonth).map(([month, group]) => (
                <div key={month} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{month}</p>
                      <Badge variant="outline">{group.rows.length} računa</Badge>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(group.totalGross)} (osnovica {formatCurrency(group.totalNet)}, PDV {formatCurrency(group.totalVat)})
                    </p>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-border bg-muted/40">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Datum plaćanja</th>
                          <th className="px-3 py-2 text-left">Datum izdavanja</th>
                          <th className="px-3 py-2 text-left">Broj računa</th>
                          <th className="px-3 py-2 text-left">Kupac</th>
                          <th className="px-3 py-2 text-right">Osnovica</th>
                          <th className="px-3 py-2 text-right">PDV</th>
                          <th className="px-3 py-2 text-right">Ukupno</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((r, idx) => (
                          <tr key={idx} className="border-t border-border/80">
                            <td className="px-3 py-2">{fmt(r.paidAt)}</td>
                            <td className="px-3 py-2">{fmt(r.issueDate)}</td>
                            <td className="px-3 py-2 font-mono text-xs text-foreground">{r.invoiceNumber}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.buyerName}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(r.netAmount)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(r.vatAmount)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(r.totalAmount)}</td>
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
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Plaćeni računi</p>
              <p className="text-lg font-semibold text-foreground">{summary.rows.length}</p>
              <p>{fmtRange(from, to)}</p>
            </div>
            <div className="space-y-1">
              <p>Osnovica: <span className="font-semibold text-foreground">{formatCurrency(summary.totalNet)}</span></p>
              <p>PDV: <span className="font-semibold text-foreground">{formatCurrency(summary.totalVat)}</span></p>
              <p>Ukupno: <span className="font-semibold text-foreground">{formatCurrency(summary.totalGross)}</span></p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">PO-SD (pregled)</p>
              <p>Broj računa: <span className="font-semibold text-foreground">{summary.rows.length}</span></p>
              <p>Ukupno: <span className="font-semibold text-foreground">{formatCurrency(summary.totalGross)}</span></p>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Preuzimanja (opcijski)</p>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline">
                  <Link href={csvUrl}>Preuzmi KPR (CSV)</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  download
                  href={`data:text/xml;charset=utf-8,${encodeURIComponent(posdXmlString)}`}
                >
                  <Link href="#">Preuzmi PO-SD (XML)</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">PO-SD XML je minimalan predložak; prilagodite ga ePorezna formatu po potrebi.</p>
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
        <CardDescription>Odaberite period za KPR/PO-SD</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
