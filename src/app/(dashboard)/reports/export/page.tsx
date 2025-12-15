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
          Preuzmite kompletne podatke za knjigovođu u CSV ili ZIP formatu. Izvoz uključuje račune, troškove,
          KPR (Knjiga Primitaka i Izdataka) i sažetak s poveznicama na skenirane račune.
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
            <CardDescription>Kompletni izvoz za "tax season" handoff</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>Računi</strong>: broj, datumi, kupac, OIB, status, osnovica/PDV/ukupno, plaćeno, reference.</p>
            <p>• <strong>Troškovi</strong>: datum, dobavljač, kategorija, iznosi, PDV, link na skenirani račun.</p>
            <p>• <strong>KPR</strong>: Knjiga Primitaka i Izdataka - samo plaćeni računi (za paušalni obrt).</p>
            <p>• <strong>Sažetak</strong>: ukupni prihodi, rashodi i neto rezultat za razdoblje.</p>
            <p>• <strong>Tax Season ZIP</strong>: sve gore navedeno u jednom paketu s README uputama.</p>
            <p className="pt-2 border-t mt-2">
              Sve datoteke su u CSV formatu optimiziranom za Excel. Datum od/do omogućava brzi Q1/Q2 ili godišnji izvoz.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
