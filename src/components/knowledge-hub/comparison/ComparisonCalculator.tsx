"use client"

import { useState, useMemo } from "react"
import { calculatePausalAnnualCosts, calculateJdooCosts } from "@/lib/knowledge-hub/calculations"
import { INCOME_TAX_BRACKETS, MONTHLY_CONTRIBUTIONS, HOK } from "@/lib/knowledge-hub/constants"
import { THRESHOLDS } from "@/lib/fiscal-data"
import { cn } from "@/lib/utils"
import { useAnimatedNumber } from "@/hooks/use-animated-number"

interface CalculatorConfig {
  businessTypes?: Array<"pausalni" | "obrt-dohodak" | "jdoo" | "doo" | "freelancer">
  types?: Array<"pausalni" | "obrt-dohodak" | "jdoo" | "doo" | "freelancer">
  defaultRevenue?: number
}

interface CostBreakdown {
  type: string
  label: string
  contributions: number
  tax: number
  bookkeeping: number
  other: number
  total: number
  netIncome: number
  isRecommended: boolean
}

// Helper function for obrt-dohodak calculations
function calculateObrtDohodakCosts(revenue: number, expenses: number) {
  const yearlyContributions = MONTHLY_CONTRIBUTIONS.TOTAL * 12
  const taxableIncome = revenue - expenses

  // Apply progressive income tax
  let yearlyTax = 0
  for (const bracket of INCOME_TAX_BRACKETS) {
    if (taxableIncome > bracket.min) {
      const taxableInBracket = Math.min(
        taxableIncome - bracket.min,
        bracket.max === Infinity ? taxableIncome - bracket.min : bracket.max - bracket.min
      )
      yearlyTax += taxableInBracket * (bracket.rate ?? 0)
    }
  }

  return {
    yearlyContributions,
    yearlyTax: Math.round(yearlyTax),
  }
}

export function ComparisonCalculator({
  businessTypes,
  types,
  defaultRevenue = 35000,
}: CalculatorConfig) {
  const [revenue, setRevenue] = useState(defaultRevenue)

  // Support both prop names, memoized to avoid dependency issues
  const businessTypeList = useMemo(
    () => businessTypes || types || ["pausalni", "obrt-dohodak", "jdoo"],
    [businessTypes, types]
  )

  const results = useMemo((): CostBreakdown[] => {
    return businessTypeList.map((type) => {
      switch (type) {
        case "pausalni": {
          const costs = calculatePausalAnnualCosts(revenue)
          return {
            type: "pausalni",
            label: "Paušalni obrt",
            contributions: costs.contributions,
            tax: costs.tax,
            bookkeeping: 0,
            other: costs.hok,
            total: costs.total,
            netIncome: revenue - costs.total,
            isRecommended: revenue <= (THRESHOLDS.pausalni.previousValue ?? 40000),
          }
        }
        case "obrt-dohodak": {
          const costs = calculateObrtDohodakCosts(revenue, revenue * 0.3) // 30% expenses
          const bookkeeping = 600
          const hok = HOK.ANNUAL
          const total = costs.yearlyContributions + costs.yearlyTax + bookkeeping + hok
          return {
            type: "obrt-dohodak",
            label: "Obrt na dohodak",
            contributions: costs.yearlyContributions,
            tax: costs.yearlyTax,
            bookkeeping: bookkeeping,
            other: hok,
            total: total,
            netIncome: revenue - total,
            isRecommended:
              revenue > (THRESHOLDS.pausalni.previousValue ?? 40000) &&
              revenue <= THRESHOLDS.pausalni.value,
          }
        }
        case "jdoo": {
          const costs = calculateJdooCosts(revenue, false) // no other employment
          const bookkeeping = 1200
          const total = costs.yearlyContributions + costs.yearlyTax + bookkeeping
          return {
            type: "jdoo",
            label: "J.D.O.O.",
            contributions: costs.yearlyContributions,
            tax: costs.yearlyTax,
            bookkeeping: bookkeeping,
            other: 0,
            total: total,
            netIncome: revenue - total,
            isRecommended: revenue > THRESHOLDS.pausalni.value,
          }
        }
        case "doo": {
          const costs = calculateJdooCosts(revenue, false) // same as jdoo
          const bookkeeping = 1500
          const total = costs.yearlyContributions + costs.yearlyTax + bookkeeping
          return {
            type: "doo",
            label: "D.O.O.",
            contributions: costs.yearlyContributions,
            tax: costs.yearlyTax,
            bookkeeping: bookkeeping,
            other: 0,
            total: total,
            netIncome: revenue - total,
            isRecommended: false,
          }
        }
        case "freelancer": {
          // Freelancer is similar to paušalni but with different tax treatment
          const costs = calculatePausalAnnualCosts(revenue)
          return {
            type: "freelancer",
            label: "Freelancer",
            contributions: costs.contributions,
            tax: costs.tax,
            bookkeeping: 0,
            other: costs.hok,
            total: costs.total,
            netIncome: revenue - costs.total,
            isRecommended: false,
          }
        }
        default:
          // Return a default for unknown types instead of throwing
          return {
            type: String(type),
            label: String(type),
            contributions: 0,
            tax: 0,
            bookkeeping: 0,
            other: 0,
            total: 0,
            netIncome: revenue,
            isRecommended: false,
          }
      }
    })
  }, [revenue, businessTypeList])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount)

  function AnimatedAmount({ value, className }: { value: number; className?: string }) {
    const animated = useAnimatedNumber(value, { durationMs: 520 })
    return <span className={cn("font-mono", className)}>{formatCurrency(animated)}</span>
  }

  return (
    <div className="bg-slate-800/80 border border-white/20 rounded-lg p-4 sm:p-6">
      {/* Revenue Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-white/90 mb-2">
          Očekivani godišnji prihod
        </label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <input
            type="range"
            min={10000}
            max={100000}
            step={5000}
            value={revenue}
            onChange={(e) => setRevenue(Number(e.target.value))}
            className="flex-1 h-11 sm:h-auto"
            style={{ minHeight: "44px" }}
          />
          <div className="w-full sm:w-32 text-center sm:text-right font-mono text-lg bg-white/5 sm:bg-transparent p-2 sm:p-0 rounded text-white">
            <AnimatedAmount value={revenue} className="text-lg" />
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/20">
              <th className="p-2 text-left text-white"></th>
              {results.map((r) => (
                <th
                  key={r.type}
                  className={cn(
                    "p-2 text-center text-white",
                    r.isRecommended && "bg-chart-4/20"
                  )}
                >
                  {r.label}
                  {r.isRecommended && (
                    <span className="block text-xs text-emerald-400">✓ Preporučeno</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/10">
              <td className="p-2 text-white/70">Doprinosi</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn(
                    "p-2 text-center text-white",
                    r.isRecommended && "bg-chart-4/10"
                  )}
                >
                  <AnimatedAmount value={r.contributions} />
                </td>
              ))}
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2 text-white/70">Porez</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn(
                    "p-2 text-center text-white",
                    r.isRecommended && "bg-chart-4/10"
                  )}
                >
                  <AnimatedAmount value={r.tax} />
                </td>
              ))}
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2 text-white/70">Knjigovodstvo</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn(
                    "p-2 text-center text-white",
                    r.isRecommended && "bg-chart-4/10"
                  )}
                >
                  <AnimatedAmount value={r.bookkeeping} />
                </td>
              ))}
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2 text-white/70">Ostalo</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn(
                    "p-2 text-center text-white",
                    r.isRecommended && "bg-chart-4/10"
                  )}
                >
                  <AnimatedAmount value={r.other} />
                </td>
              ))}
            </tr>
            <tr className="border-b-2 border-white/20 font-semibold">
              <td className="p-2 text-white">UKUPNO GODIŠNJE</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn(
                    "p-2 text-center text-white",
                    r.isRecommended && "bg-chart-4/10"
                  )}
                >
                  <AnimatedAmount value={r.total} />
                </td>
              ))}
            </tr>
            <tr className="font-semibold text-emerald-400">
              <td className="p-2">NETO OSTATAK</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-chart-4/20")}
                >
                  <AnimatedAmount value={r.netIncome} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards */}
      <div className="md:hidden space-y-4">
        {results.map((r) => (
          <div
            key={r.type}
            className={cn(
              "border rounded-lg p-4",
              r.isRecommended
                ? "border-emerald-500 bg-chart-4/10"
                : "border-white/20 bg-white/5"
            )}
          >
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/20">
              <h3 className="font-semibold text-base text-white">{r.label}</h3>
              {r.isRecommended && (
                <span className="text-xs px-2 py-1 bg-chart-4 text-white rounded">
                  ✓ Preporučeno
                </span>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center min-h-[44px] py-1">
                <span className="text-white/70">Doprinosi</span>
                <span className="font-medium text-white">
                  <AnimatedAmount value={r.contributions} />
                </span>
              </div>
              <div className="flex justify-between items-center min-h-[44px] py-1">
                <span className="text-white/70">Porez</span>
                <span className="font-medium text-white">
                  <AnimatedAmount value={r.tax} />
                </span>
              </div>
              <div className="flex justify-between items-center min-h-[44px] py-1">
                <span className="text-white/70">Knjigovodstvo</span>
                <span className="font-medium text-white">
                  <AnimatedAmount value={r.bookkeeping} />
                </span>
              </div>
              <div className="flex justify-between items-center min-h-[44px] py-1">
                <span className="text-white/70">Ostalo</span>
                <span className="font-medium text-white">
                  <AnimatedAmount value={r.other} />
                </span>
              </div>
              <div className="flex justify-between items-center min-h-[44px] py-2 border-t-2 border-white/20 font-semibold mt-2 text-white">
                <span>UKUPNO GODIŠNJE</span>
                <span>
                  <AnimatedAmount value={r.total} />
                </span>
              </div>
              <div className="flex justify-between items-center min-h-[44px] py-2 bg-chart-4/20 -mx-4 px-4 -mb-4 rounded-b font-semibold text-emerald-400">
                <span>NETO OSTATAK</span>
                <span>
                  <AnimatedAmount value={r.netIncome} />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="mt-4 text-xs text-white/50">
        * Procjene za 2025. Stvarni iznosi ovise o prirezima, dodatnim troškovima i specifičnoj
        situaciji.
      </p>
    </div>
  )
}
