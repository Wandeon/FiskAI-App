import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AccountingExportForm } from "@/components/reports/accounting-export-form"
import Link from "next/link"

export default async function ExportPage() {
  const user = await requireAuth()
  await requireCompany(user.id!)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Paušalni obrt — handoff za knjigovođu</p>
        <h1 className="text-2xl font-bold">Izvoz podataka</h1>
        <p className="text-muted-foreground">
          Preuzmite CSV datoteke s računima i troškovima za odabrano razdoblje. Dodali smo linkove na skenirane račune kako bi knjigovođa imala sve dokaze.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Izvoz za knjigovođu</CardTitle>
            <CardDescription>CSV za račune i troškove s filterom datuma</CardDescription>
          </CardHeader>
          <CardContent>
            <AccountingExportForm />
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Što je uključeno</CardTitle>
            <CardDescription>Poklapa se s “definition of done” za prve korisnike</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Računi: broj, datumi, kupac, status, osnovica/PDV/ukupno, plaćeno, reference.</p>
            <p>• Troškovi: dobavljač, kategorija, status plaćanja, iznosi, link na skenirani račun.</p>
            <p>• Datum od/do za brzi “Q1/Q2” ili godišnji export.</p>
            <p>
              Ako trebate PDF ili prilagođeni format, javite se na{" "}
              <Link className="font-medium text-foreground underline" href="/contact">
                /contact
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
