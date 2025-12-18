"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Download,
  Printer,
  Info,
  AlertCircle,
} from "lucide-react"
import { formatCurrency } from "@/lib/format"

interface Props {
  companyId: string
}

interface YearSummary {
  totalIncome: number
  expenseBracket: number
  calculatedExpenses: number
  netIncome: number
}

// Expense brackets for paušalni obrt (based on Croatian tax law)
const EXPENSE_BRACKETS = [
  { value: 25, label: "25% - Uslužne djelatnosti" },
  { value: 30, label: "30% - Proizvodne i trgovačke djelatnosti" },
  { value: 34, label: "34% - Trgovina na malo" },
  { value: 40, label: "40% - Promet na veliko" },
]

export function PosdWizard({ companyId }: Props) {
  const [currentStep, setCurrentStep] = useState(1)
  const [yearSummary, setYearSummary] = useState<YearSummary | null>(null)
  const [selectedBracket, setSelectedBracket] = useState<number>(25)
  const [year, setYear] = useState(new Date().getFullYear() - 1)

  // Step 1: Income Summary
  function renderIncomeSummary() {
    // In a real implementation, this would fetch actual income data
    const mockIncome = 48500.0

    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <p className="font-medium mb-1">O PO-SD obrascu</p>
              <p>
                PO-SD obrazac je godišnja prijava za paušalne obrte. Rok za podnošenje je 15.
                siječnja za prethodnu godinu. Na temelju prijavljenog prihoda, porezna uprava će
                utvrditi vaše mjesečne obveze za narednu godinu.
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pregled prihoda za {year}. godinu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Ukupan godišnji prihod</p>
                  <p className="text-3xl font-bold">{formatCurrency(mockIncome)}</p>
                </div>
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Detalji po mjesecima:</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {Array.from({ length: 12 }, (_, i) => {
                  const monthIncome = mockIncome / 12
                  return (
                    <div
                      key={i}
                      className="rounded border border-border bg-surface-secondary p-2 text-center"
                    >
                      <p className="text-xs text-muted-foreground mb-1">
                        {new Date(year, i).toLocaleDateString("hr-HR", { month: "short" })}
                      </p>
                      <p className="font-medium">{formatCurrency(monthIncome)}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-200 mb-1">Napomena</p>
                  <p className="text-amber-800 dark:text-amber-300">
                    Ako ne vodite evidenciju prihoda, procjenite ukupan prihod na temelju izdanih
                    računa i primitaka. Budite realni - prema ovom prihodu će se odrediti vaši
                    doprinosi.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={() => {
              setYearSummary({
                totalIncome: mockIncome,
                expenseBracket: selectedBracket,
                calculatedExpenses: mockIncome * (selectedBracket / 100),
                netIncome: mockIncome * (1 - selectedBracket / 100),
              })
              setCurrentStep(2)
            }}
          >
            Nastavi
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    )
  }

  // Step 2: Expense Bracket Selection
  function renderExpenseBracket() {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Odabir stope priznatih troškova</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-200">
                  <p>
                    Odaberite stopu priznatih troškova koja odgovara vašoj djelatnosti. Ova stopa će
                    se koristiti za izračun neto prihoda na koji se plaćaju doprinosi i porezi.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {EXPENSE_BRACKETS.map((bracket) => (
                <button
                  key={bracket.value}
                  onClick={() => setSelectedBracket(bracket.value)}
                  className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                    selectedBracket === bracket.value
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-border bg-surface-secondary hover:border-blue-500/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-lg">{bracket.value}%</p>
                      <p className="text-sm text-muted-foreground">{bracket.label}</p>
                    </div>
                    {selectedBracket === bracket.value && (
                      <CheckCircle2 className="h-6 w-6 text-blue-600" />
                    )}
                  </div>
                  {yearSummary && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Priznati troškovi</p>
                          <p className="font-medium">
                            {formatCurrency(yearSummary.totalIncome * (bracket.value / 100))}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Neto prihod</p>
                          <p className="font-medium">
                            {formatCurrency(yearSummary.totalIncome * (1 - bracket.value / 100))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep(1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Natrag
          </Button>
          <Button
            onClick={() => {
              if (yearSummary) {
                setYearSummary({
                  ...yearSummary,
                  expenseBracket: selectedBracket,
                  calculatedExpenses: yearSummary.totalIncome * (selectedBracket / 100),
                  netIncome: yearSummary.totalIncome * (1 - selectedBracket / 100),
                })
              }
              setCurrentStep(3)
            }}
          >
            Nastavi
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    )
  }

  // Step 3: Summary Preview
  function renderSummary() {
    if (!yearSummary) return null

    // Calculate estimated monthly contributions based on net income
    const monthlyNetIncome = yearSummary.netIncome / 12
    const estimatedMonthlyBase = Math.min(monthlyNetIncome * 0.4, 753.82) // 40% of net, max at Croatian average
    const estimatedMIO1 = estimatedMonthlyBase * 0.2
    const estimatedMIO2 = estimatedMonthlyBase * 0.15
    const estimatedHealth = estimatedMonthlyBase * 0.165
    const estimatedTotal = estimatedMIO1 + estimatedMIO2 + estimatedHealth

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pregled PO-SD prijave za {year}. godinu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Income Summary */}
            <div>
              <h3 className="font-semibold mb-3">Godišnji prihodi</h3>
              <div className="grid gap-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">Ukupan prihod</span>
                  <span className="font-semibold">{formatCurrency(yearSummary.totalIncome)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">
                    Priznati troškovi ({yearSummary.expenseBracket}%)
                  </span>
                  <span className="font-semibold">
                    -{formatCurrency(yearSummary.calculatedExpenses)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/50">
                  <span className="font-medium">Neto prihod (porezna osnovica)</span>
                  <span className="font-bold text-lg">{formatCurrency(yearSummary.netIncome)}</span>
                </div>
              </div>
            </div>

            {/* Estimated Monthly Contributions */}
            <div>
              <h3 className="font-semibold mb-3">Procjena mjesečnih obveza za {year + 1}.</h3>
              <div className="grid gap-2">
                <div className="flex justify-between items-center p-2 rounded bg-surface-secondary text-sm">
                  <span className="text-muted-foreground">
                    Osnovica (40% neto, max {formatCurrency(753.82)})
                  </span>
                  <span className="font-medium">{formatCurrency(estimatedMonthlyBase)}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-surface-secondary text-sm">
                  <span className="text-muted-foreground">MIO I. stup (20%)</span>
                  <span className="font-medium">{formatCurrency(estimatedMIO1)}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-surface-secondary text-sm">
                  <span className="text-muted-foreground">MIO II. stup (15%)</span>
                  <span className="font-medium">{formatCurrency(estimatedMIO2)}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-surface-secondary text-sm">
                  <span className="text-muted-foreground">Zdravstveno (16.5%)</span>
                  <span className="font-medium">{formatCurrency(estimatedHealth)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded bg-amber-500/10 border border-amber-500/50 font-semibold">
                  <span>Ukupno mjesečno</span>
                  <span>{formatCurrency(estimatedTotal)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-200">
                  <p className="font-medium mb-1">Napomena</p>
                  <p>
                    Ovo su samo procjene za planiranje. Stvarni iznos doprinosa će odrediti porezna
                    uprava temeljem vaše PO-SD prijave i drugih faktora. Obveze će biti poznate
                    nakon obrade prijave.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep(2)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Natrag
          </Button>
          <Button onClick={() => setCurrentStep(4)}>
            Nastavi na upute
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    )
  }

  // Step 4: Download/Print Instructions
  function renderInstructions() {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              Upute za podnošenje PO-SD obrasca
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-green-500/10 border border-green-500/50 p-4">
              <p className="font-medium text-green-900 dark:text-green-200">
                Pripremili smo za vas sve potrebne podatke za podnošenje PO-SD obrasca!
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Koraci za podnošenje:</h3>
              <ol className="space-y-3 list-decimal list-inside">
                <li className="text-sm">
                  <span className="font-medium">Pristupite ePorezna sustavu</span>
                  <p className="ml-6 mt-1 text-muted-foreground">
                    Prijavite se na{" "}
                    <a
                      href="https://eporezna.porezna-uprava.hr"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      ePorezna portal
                    </a>{" "}
                    s vašim korisničkim podacima ili FINA certifikatom.
                  </p>
                </li>
                <li className="text-sm">
                  <span className="font-medium">Pronađite PO-SD obrazac</span>
                  <p className="ml-6 mt-1 text-muted-foreground">
                    U izborniku odaberite: Obrasci → Prijave → PO-SD (Prijava za oporezivanje po
                    paušalnom načinu oporezivanja)
                  </p>
                </li>
                <li className="text-sm">
                  <span className="font-medium">Unesite podatke</span>
                  <p className="ml-6 mt-1 text-muted-foreground">
                    Popunite obrazac s prihodima i stopom priznatih troškova iz donjeg sažetka.
                  </p>
                </li>
                <li className="text-sm">
                  <span className="font-medium">Pregledajte i pošaljite</span>
                  <p className="ml-6 mt-1 text-muted-foreground">
                    Pregledajte sve podatke, prihvatite elektronički potpis i pošaljite prijavu.
                  </p>
                </li>
                <li className="text-sm">
                  <span className="font-medium">Sačuvajte potvrdu</span>
                  <p className="ml-6 mt-1 text-muted-foreground">
                    Spremite potvrdu o primitku prijave za vašu evidenciju.
                  </p>
                </li>
              </ol>
            </div>

            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <h4 className="font-semibold text-sm">Podaci za unos:</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Porezno razdoblje:</span>
                  <span className="font-medium">{year}. godina</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ukupan prihod:</span>
                  <span className="font-medium">
                    {yearSummary ? formatCurrency(yearSummary.totalIncome) : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stopa troškova:</span>
                  <span className="font-medium">{selectedBracket}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Neto prihod:</span>
                  <span className="font-medium">
                    {yearSummary ? formatCurrency(yearSummary.netIncome) : "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-200 mb-1">Važan rok!</p>
                  <p className="text-amber-800 dark:text-amber-300">
                    PO-SD obrazac mora biti podnesen do <strong>15. siječnja {year + 1}.</strong>{" "}
                    godine. Kašnjenje može rezultirati kaznama.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1">
                <Printer className="h-4 w-4 mr-2" />
                Ispiši sažetak
              </Button>
              <Button variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Preuzmi PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep(3)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Natrag
          </Button>
          <Button
            onClick={() => {
              // Reset wizard
              setCurrentStep(1)
              setYearSummary(null)
            }}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Završi
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {[
          { num: 1, label: "Prihodi" },
          { num: 2, label: "Troškovi" },
          { num: 3, label: "Pregled" },
          { num: 4, label: "Upute" },
        ].map((step, index) => (
          <div key={step.num} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  currentStep >= step.num
                    ? "bg-blue-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.num ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <span>{step.num}</span>
                )}
              </div>
              <span className="text-xs mt-2 text-center">{step.label}</span>
            </div>
            {index < 3 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-colors ${
                  currentStep > step.num ? "bg-blue-600" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 1 && renderIncomeSummary()}
      {currentStep === 2 && renderExpenseBracket()}
      {currentStep === 3 && renderSummary()}
      {currentStep === 4 && renderInstructions()}
    </div>
  )
}
