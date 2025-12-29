import { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { PosdWizard } from "@/components/pausalni/posd-wizard"
import { FileText, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "PO-SD Godišnja Prijava | FiskAI",
  description: "Pripremite i podnesite PO-SD obrazac za paušalni obrt",
}

export default async function PoSDPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  if (company.legalForm !== "OBRT_PAUSAL") {
    redirect("/dashboard")
  }

  const currentYear = new Date().getFullYear()
  const deadlineDate = new Date(currentYear, 0, 15) // January 15
  const today = new Date()
  const isBeforeDeadline = today < deadlineDate

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-6 w-6 text-link" />
          <h1 className="text-2xl font-bold">PO-SD Godišnja Prijava</h1>
        </div>
        <p className="text-muted-foreground">
          Pripremite godišnju prijavu za paušalno oporezivanje
        </p>
      </div>

      {/* Deadline Alert */}
      <Card
        className={`${
          isBeforeDeadline
            ? "border-amber-500/50 bg-amber-500/10"
            : "border-focus/50 bg-blue-500/10"
        }`}
      >
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Calendar
              className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                isBeforeDeadline ? "text-amber-600" : "text-link"
              }`}
            />
            <div>
              <p
                className={`font-semibold ${
                  isBeforeDeadline
                    ? "text-amber-900 dark:text-amber-200"
                    : "text-blue-900 dark:text-blue-200"
                }`}
              >
                {isBeforeDeadline ? "Nadolazeći rok!" : "Važna informacija"}
              </p>
              <p
                className={`text-sm mt-1 ${
                  isBeforeDeadline
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-info-text dark:text-blue-300"
                }`}
              >
                PO-SD obrazac za {currentYear - 1}. godinu mora biti podnesen do{" "}
                <strong>15. siječnja {currentYear}.</strong> godine. Ova prijava određuje vaše
                mjesečne doprinose za {currentYear}. godinu.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What is PO-SD */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-3">Što je PO-SD obrazac?</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              PO-SD (Prijava za oporezivanje po paušalnom načinu oporezivanja) je godišnja prijava
              koju podnose vlasnici paušalnih obrta. Na temelju ove prijave, Porezna uprava
              određuje:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Osnovicu za obračun doprinosa (MIO I, MIO II, zdravstveno osiguranje)</li>
              <li>Vaše mjesečne obveze za narednu godinu</li>
              <li>Eventualne porezne olakšice na koje imate pravo</li>
            </ul>
            <p className="pt-2">
              Obrazac se popunjava temeljem ukupnog prihoda iz prethodne godine i stope priznatih
              troškova koja ovisi o vašoj djelatnosti.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Wizard */}
      <PosdWizard companyId={company.id} />
    </div>
  )
}
