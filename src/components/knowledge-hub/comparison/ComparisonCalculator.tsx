"use client"

import { useState, useMemo } from "react"
import { calculatePausalAnnualCosts, calculateJdooCosts } from "@/lib/knowledge-hub/calculations"
import { INCOME_TAX_BRACKETS, MONTHLY_CONTRIBUTIONS, HOK } from "@/lib/knowledge-hub/constants"
import { cn } from "@/lib/utils"

interface CalculatorConfig {
  businessTypes: Array<"pausalni" | "obrt-dohodak" | "jdoo">
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
      yearlyTax += taxableInBracket * bracket.rate
    }
  }

  return {
    yearlyContributions,
    yearlyTax: Math.round(yearlyTax),
  }
}

export function ComparisonCalculator({ businessTypes, defaultRevenue = 35000 }: CalculatorConfig) {
  const [revenue, setRevenue] = useState(defaultRevenue)

  const results = useMemo((): CostBreakdown[] => {
    return businessTypes.map((type) => {
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
            isRecommended: revenue <= 40000,
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
            isRecommended: revenue > 40000 && revenue <= 60000,
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
            isRecommended: revenue > 60000,
          }
        }
        default:
          throw new Error(`Unknown business type: ${type}`)
      }
    })
  }, [revenue, businessTypes])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount)

  return (
    <div className="bg-white border rounded-lg p-6">
      {/* Revenue Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Očekivani godišnji prihod
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={10000}
            max={100000}
            step={5000}
            value={revenue}
            onChange={(e) => setRevenue(Number(e.target.value))}
            className="flex-1"
          />
          <div className="w-32 text-right font-mono text-lg">{formatCurrency(revenue)}</div>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left"></th>
              {results.map((r) => (
                <th
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50")}
                >
                  {r.label}
                  {r.isRecommended && (
                    <span className="block text-xs text-green-600">✓ Preporučeno</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="p-2 text-gray-600">Doprinosi</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50/50")}
                >
                  {formatCurrency(r.contributions)}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <td className="p-2 text-gray-600">Porez</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50/50")}
                >
                  {formatCurrency(r.tax)}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <td className="p-2 text-gray-600">Knjigovodstvo</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50/50")}
                >
                  {formatCurrency(r.bookkeeping)}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <td className="p-2 text-gray-600">Ostalo</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50/50")}
                >
                  {formatCurrency(r.other)}
                </td>
              ))}
            </tr>
            <tr className="border-b-2 border-gray-300 font-semibold">
              <td className="p-2">UKUPNO GODIŠNJE</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50/50")}
                >
                  {formatCurrency(r.total)}
                </td>
              ))}
            </tr>
            <tr className="font-semibold text-green-700">
              <td className="p-2">NETO OSTATAK</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-100")}
                >
                  {formatCurrency(r.netIncome)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Disclaimer */}
      <p className="mt-4 text-xs text-gray-500">
        * Procjene za 2025. Stvarni iznosi ovise o prirezima, dodatnim troškovima i specifičnoj
        situaciji.
      </p>
    </div>
  )
}
