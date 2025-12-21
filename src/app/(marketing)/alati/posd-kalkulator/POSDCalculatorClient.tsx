"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle,
  ArrowRight,
  Landmark,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Info,
  Rocket,
  Upload,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { Reveal } from "@/components/motion/Reveal"
import { cn } from "@/lib/utils"
import { FAQ } from "@/components/content/FAQ"
import {
  parseBankXML,
  filterIncomeTransactions,
  type ParsedBankStatement,
  type BankTransaction,
} from "@/lib/posd/bank-xml-parser"
import {
  calculatePOSD,
  formatCurrency,
  MUNICIPALITY_RATES,
  getDaysUntilDeadline,
  type POSDResult,
} from "@/lib/posd/posd-calculator"
import { TAX_RATES, THRESHOLDS, formatPercentage } from "@/lib/fiscal-data"

type Step = "upload" | "review" | "results"

const supportedBanks = [
  { name: "Erste Bank", format: "camt.053" },
  { name: "PBZ", format: "camt.053 / XML" },
  { name: "Zagrebačka banka", format: "camt.053" },
  { name: "Raiffeisen (RBA)", format: "camt.053" },
  { name: "OTP banka", format: "camt.053" },
  { name: "Addiko Bank", format: "camt.053" },
]

export function POSDCalculatorClient() {
  const [step, setStep] = useState<Step>("upload")
  const [statement, setStatement] = useState<ParsedBankStatement | null>(null)
  const [incomeTransactions, setIncomeTransactions] = useState<BankTransaction[]>([])
  const [result, setResult] = useState<POSDResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [municipality, setMunicipality] = useState("other")
  const [hasSecondPillar, setHasSecondPillar] = useState(true)

  // Deadline info
  const deadlineInfo = getDaysUntilDeadline()
  const normativeExpenseRateLabel = formatPercentage(TAX_RATES.pausal.normativeExpenseRate)
  const pausalRateLabel = formatPercentage(TAX_RATES.pausal.rate)
  const vatThresholdLabel = formatCurrency(THRESHOLDS.pdv.value)
  const posdDeadlineExample = deadlineInfo.deadline.toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
  })

  const faq = [
    {
      q: "Što je PO-SD obrazac?",
      a: "Kvartalni obrazac kojim paušalni obrtnici prijavljuju primitke Poreznoj upravi.",
    },
    {
      q: "Koji je rok za predaju PO-SD?",
      a: `Do ${posdDeadlineExample} za zadnji obračunski kvartal.`,
    },
    {
      q: "Što ako propustim rok?",
      a: "Kazne ovise o prekršaju i mogu biti značajne, stoga je važno predati obrazac na vrijeme.",
    },
  ]

  const municipalityOptions = [
    { value: "zagreb", label: "Zagreb", rate: MUNICIPALITY_RATES.zagreb },
    { value: "split", label: "Split", rate: MUNICIPALITY_RATES.split },
    { value: "rijeka", label: "Rijeka", rate: MUNICIPALITY_RATES.rijeka },
    { value: "osijek", label: "Osijek", rate: MUNICIPALITY_RATES.osijek },
    { value: "zadar", label: "Zadar", rate: MUNICIPALITY_RATES.zadar },
    { value: "other", label: "Ostalo", rate: MUNICIPALITY_RATES.other },
    { value: "none", label: "Bez prireza", rate: MUNICIPALITY_RATES.none },
  ]

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)

    const file = e.dataTransfer.files[0]
    if (file) {
      processFile(file)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }, [])

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".xml")) {
      setError("Molimo učitajte XML datoteku bankovnog izvoda.")
      return
    }

    try {
      const content = await file.text()
      const parsed = parseBankXML(content)
      setStatement(parsed)

      // Filter income transactions
      const income = filterIncomeTransactions(parsed.transactions)
      setIncomeTransactions(income)

      setStep("review")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Greška pri parsiranju datoteke. Provjerite format."
      )
    }
  }

  const handleCalculate = () => {
    if (!incomeTransactions.length) {
      setError("Nema primitaka za izračun.")
      return
    }

    const year = statement?.periodStart.getFullYear() || new Date().getFullYear()

    const posdResult = calculatePOSD({
      year,
      incomeTransactions,
      businessType: "pausalni",
      hasSecondPensionPillar: hasSecondPillar,
      municipalityRate: MUNICIPALITY_RATES[municipality],
    })

    setResult(posdResult)
    setStep("results")
  }

  const handleReset = () => {
    setStep("upload")
    setStatement(null)
    setIncomeTransactions([])
    setResult(null)
    setError(null)
  }

  const toggleTransaction = (id: string) => {
    setIncomeTransactions((prev) => {
      const exists = prev.find((tx) => tx.id === id)
      if (exists) {
        return prev.filter((tx) => tx.id !== id)
      } else if (statement) {
        const tx = statement.transactions.find((t) => t.id === id)
        if (tx && tx.isIncome) {
          return [...prev, tx]
        }
      }
      return prev
    })
  }

  return (
    <SectionBackground>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-14">
        {/* Header */}
        <Reveal className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700">
            <Calculator className="h-4 w-4" />
            Besplatni alat
          </div>
          <h1 className="text-3xl font-bold text-white md:text-4xl">PO-SD Kalkulator</h1>
          <p className="mx-auto mt-3 max-w-2xl text-white/60">
            Učitaj XML izvod iz banke i automatski izračunaj primitke za PO-SD obrazac. Podržava
            Erste, PBZ, ZABA, RBA, OTP i druge banke.
          </p>
        </Reveal>

        {/* Deadline Banner */}
        <Reveal className="mb-8">
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border p-4",
              deadlineInfo.daysLeft <= 7
                ? "border-red-500/50 bg-red-500/10"
                : deadlineInfo.daysLeft <= 14
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-cyan-500/50 bg-cyan-500/10"
            )}
          >
            <div className="flex items-center gap-3">
              <Calendar
                className={cn(
                  "h-5 w-5",
                  deadlineInfo.daysLeft <= 7
                    ? "text-red-400"
                    : deadlineInfo.daysLeft <= 14
                      ? "text-amber-400"
                      : "text-cyan-400"
                )}
              />
              <div>
                <p className="font-medium text-white">
                  Sljedeći rok za PO-SD (Q{deadlineInfo.quarter})
                </p>
                <p className="text-sm text-white/70">
                  {deadlineInfo.deadline.toLocaleDateString("hr-HR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold",
                deadlineInfo.daysLeft <= 7
                  ? "bg-red-500/20 text-red-300"
                  : deadlineInfo.daysLeft <= 14
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-cyan-500/20 text-cyan-300"
              )}
            >
              {deadlineInfo.daysLeft} dana
            </div>
          </div>
        </Reveal>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Upload Zone */}
              <Card className="mb-8 overflow-hidden">
                <CardContent className="p-0">
                  <div
                    onDrop={handleFileDrop}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    className={cn(
                      "flex flex-col items-center justify-center border-2 border-dashed p-12 transition-colors",
                      isDragging
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-white/20 bg-white/5 hover:border-blue-400 hover:bg-blue-500/5"
                    )}
                  >
                    <div
                      className={cn(
                        "mb-4 flex h-16 w-16 items-center justify-center rounded-full",
                        isDragging ? "bg-blue-500/20" : "bg-white/10"
                      )}
                    >
                      <Upload
                        className={cn("h-8 w-8", isDragging ? "text-blue-400" : "text-white/60")}
                      />
                    </div>
                    <p className="mb-2 text-lg font-medium text-white">
                      Povuci i ispusti XML izvod
                    </p>
                    <p className="mb-4 text-sm text-white/60">ili</p>
                    <label className="cursor-pointer rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                      Odaberi datoteku
                      <input
                        type="file"
                        accept=".xml"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                    <p className="mt-4 text-xs text-white/40">
                      Podržani formati: camt.053 (ISO 20022), XML izvodi
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-3 border-t border-red-200 bg-red-50 p-4 text-red-700">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                      <p className="text-sm">{error}</p>
                      <button
                        onClick={() => setError(null)}
                        className="ml-auto text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Supported Banks */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Landmark className="h-5 w-5 text-white/60" />
                    Podržane banke
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {supportedBanks.map((bank) => (
                      <div
                        key={bank.name}
                        className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-white">{bank.name}</span>
                        <span className="ml-auto text-xs text-white/40">{bank.format}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-white/60">
                    <Info className="mr-1 inline h-4 w-4" />
                    Većina hrvatskih banaka nudi izvoz u camt.053 formatu kroz internet bankarstvo.
                  </p>
                </CardContent>
              </Card>

              {/* How to export */}
              <details className="mt-6 rounded-xl border border-white/20 bg-white/5">
                <summary className="flex cursor-pointer items-center justify-between p-4 font-medium text-white">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-white/60" />
                    Kako izvesti XML iz banke?
                  </span>
                  <ChevronDown className="h-5 w-5 text-white/40" />
                </summary>
                <div className="border-t border-white/20 p-4 text-sm text-white/80">
                  <ol className="list-decimal space-y-2 pl-4">
                    <li>Prijavi se u internet bankarstvo svoje banke</li>
                    <li>Pronađi opciju &quot;Izvodi&quot; ili &quot;Izvještaji&quot;</li>
                    <li>Odaberi period (npr. cijela godina)</li>
                    <li>
                      Odaberi format <strong>XML</strong> ili <strong>camt.053</strong>
                    </li>
                    <li>Preuzmi datoteku i učitaj je ovdje</li>
                  </ol>
                </div>
              </details>
            </motion.div>
          )}

          {step === "review" && statement && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Statement Info */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      Učitani izvod
                    </span>
                    <button
                      onClick={handleReset}
                      className="text-sm font-normal text-white/60 hover:text-white"
                    >
                      ← Učitaj drugi
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-xs text-white/60">Banka</p>
                      <p className="font-medium text-white">{statement.bankName}</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-xs text-white/60">IBAN</p>
                      <p className="font-mono text-sm text-white">{statement.accountIBAN}</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-xs text-white/60">Period</p>
                      <p className="font-medium text-white">
                        {statement.periodStart.toLocaleDateString("hr-HR")} —{" "}
                        {statement.periodEnd.toLocaleDateString("hr-HR")}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-xs text-white/60">Ukupno transakcija</p>
                      <p className="font-medium text-white">{statement.transactions.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Settings */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Postavke izračuna</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-white/80">
                        Općina (za prirez)
                      </label>
                      <select
                        value={municipality}
                        onChange={(e) => setMunicipality(e.target.value)}
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                      >
                        {municipalityOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label} ({formatPercentage(option.rate)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-white/80">
                        II. mirovinski stup
                      </label>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={hasSecondPillar}
                            onChange={() => setHasSecondPillar(true)}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="text-sm">Da</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={!hasSecondPillar}
                            onChange={() => setHasSecondPillar(false)}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="text-sm">Ne</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transactions Review */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span>
                      Primitci ({incomeTransactions.length} od{" "}
                      {statement.transactions.filter((tx) => tx.isIncome).length})
                    </span>
                    <span className="text-green-600">
                      {formatCurrency(incomeTransactions.reduce((sum, tx) => sum + tx.amount, 0))}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-white/60">
                    Označite samo primitke koji su dio vašeg paušalnog obrta. Isključite privatne
                    uplate, povrate i sl.
                  </p>

                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {statement.transactions
                      .filter((tx) => tx.isIncome)
                      .map((tx) => {
                        const isSelected = incomeTransactions.some((t) => t.id === tx.id)
                        return (
                          <div
                            key={tx.id}
                            onClick={() => toggleTransaction(tx.id)}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                              isSelected
                                ? "border-green-500/50 bg-green-500/10"
                                : "border-white/10 bg-white/5 opacity-60"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded border-2",
                                isSelected ? "border-green-500 bg-green-500" : "border-white/30"
                              )}
                            >
                              {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {tx.counterpartyName || tx.description}
                              </p>
                              <p className="truncate text-xs text-white/60">
                                {tx.date.toLocaleDateString("hr-HR")} •{" "}
                                {tx.description.slice(0, 50)}
                              </p>
                            </div>
                            <span className="font-medium text-green-500">
                              +{formatCurrency(tx.amount)}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>

              {/* Calculate Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-medium text-white hover:bg-white/10"
                >
                  Poništi
                </button>
                <button
                  onClick={handleCalculate}
                  disabled={incomeTransactions.length === 0}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:bg-white/10 disabled:cursor-not-allowed"
                >
                  Izračunaj PO-SD
                </button>
              </div>
            </motion.div>
          )}

          {step === "results" && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="mb-6 space-y-2">
                  {result.warnings.map((warning, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
                    >
                      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                      <p className="text-sm text-amber-800">{warning}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary Cards */}
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-green-700">Ukupni primitci</p>
                    <p className="text-2xl font-bold text-green-800">
                      {formatCurrency(result.totalIncome)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-blue-700">
                      Normativni rashodi ({normativeExpenseRateLabel})
                    </p>
                    <p className="text-2xl font-bold text-blue-800">
                      {formatCurrency(result.normativeExpenses)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-purple-700">Porezna osnovica</p>
                    <p className="text-2xl font-bold text-purple-800">
                      {formatCurrency(result.taxBase)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-amber-700">Porez + prirez</p>
                    <p className="text-2xl font-bold text-amber-800">
                      {formatCurrency(result.totalTax)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Quarterly Breakdown */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Primitci po kvartalima</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {result.quarterlyBreakdown.map((q) => (
                      <div
                        key={q.quarter}
                        className="rounded-lg border border-white/20 bg-white/5 p-4"
                      >
                        <p className="mb-1 text-sm font-medium text-white/60">{q.quarter}</p>
                        <p className="text-xl font-bold text-white">{formatCurrency(q.income)}</p>
                        <p className="mt-1 text-xs text-white/40">
                          {q.transactionCount} transakcija
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tax Details */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Detalji izračuna</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-white/70">Ukupni primitci</span>
                      <span className="font-medium text-white">
                        {formatCurrency(result.totalIncome)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-white/70">
                        - Normativni rashodi ({normativeExpenseRateLabel})
                      </span>
                      <span className="font-medium text-white/60">
                        -{formatCurrency(result.normativeExpenses)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-white/70">= Porezna osnovica</span>
                      <span className="font-medium text-white">
                        {formatCurrency(result.taxBase)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-white/70">Porez na dohodak ({pausalRateLabel})</span>
                      <span className="font-medium text-white">
                        {formatCurrency(result.incomeTax)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-white/70">Prirez</span>
                      <span className="font-medium text-white">
                        {formatCurrency(result.surtax)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/20 pb-2 pt-2">
                      <span className="font-medium text-white">Ukupno porez + prirez</span>
                      <span className="font-bold text-white">
                        {formatCurrency(result.totalTax)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2 pt-4">
                      <span className="text-white/70">
                        Doprinosi (godišnje, {formatCurrency(result.monthlyContributions)}
                        /mj)
                      </span>
                      <span className="font-medium text-white">
                        {formatCurrency(result.yearlyContributions)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="font-bold text-white">
                        Ukupne obveze (porez + doprinosi)
                      </span>
                      <span className="font-bold text-red-400">
                        {formatCurrency(result.totalObligations)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/20 pt-3">
                      <span className="font-bold text-white">Neto nakon obveza</span>
                      <span className="font-bold text-green-500">
                        {formatCurrency(result.netAfterTax)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* VAT Warning */}
              {result.isNearVATThreshold && (
                <Card className="mb-6 border-amber-200 bg-amber-50">
                  <CardContent className="flex items-start gap-3 pt-6">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">
                        Blizu PDV praga ({result.vatThresholdPercentage.toFixed(1)}% od{" "}
                        {vatThresholdLabel})
                      </p>
                      <p className="mt-1 text-sm text-amber-700">
                        Pratite prihode pažljivo. Ako prijeđete prag, morate se registrirati za PDV.
                      </p>
                      <Link
                        href="/alati/pdv-kalkulator"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-800 underline"
                      >
                        Otvori PDV kalkulator →
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ePorezna Guidance */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                    Sljedeći koraci
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        1
                      </span>
                      <div>
                        <p className="font-medium text-white">Prijavi se na ePorezna</p>
                        <p className="text-sm text-white/60">
                          <a
                            href="https://e-porezna.porezna-uprava.hr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            e-porezna.porezna-uprava.hr
                          </a>
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        2
                      </span>
                      <div>
                        <p className="font-medium text-white">
                          Odaberi &quot;Predaja obrazaca&quot; → &quot;PO-SD&quot;
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        3
                      </span>
                      <div>
                        <p className="font-medium text-white">
                          Unesi primitke po kvartalima iz izračuna iznad
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        4
                      </span>
                      <div>
                        <p className="font-medium text-white">Potpiši i pošalji</p>
                        <p className="text-sm text-white/60">
                          Rok: {deadlineInfo.deadline.toLocaleDateString("hr-HR")}
                        </p>
                      </div>
                    </li>
                  </ol>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-wrap justify-between gap-4">
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-medium text-white hover:bg-white/10"
                >
                  ← Novi izračun
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-medium text-white hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Isprintaj
                  </button>
                </div>
              </div>

              {/* Upsell */}
              <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600">
                    <Rocket className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white">Automatski PO-SD s FiskAI</h3>
                    <p className="mt-1 text-sm text-white/70">
                      Zaboravi na ručne izračune. FiskAI automatski prati primitke, generira PO-SD i
                      podsjeća te na rokove.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href="/register"
                        className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-cyan-700"
                      >
                        Započni besplatno
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link
                        href="/features"
                        className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/15"
                      >
                        Saznaj više
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <FAQ items={faq} />
      </div>
    </SectionBackground>
  )
}
