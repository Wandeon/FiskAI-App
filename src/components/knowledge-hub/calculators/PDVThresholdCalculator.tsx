"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useAnimatedNumber } from "@/hooks/use-animated-number"
import { formatEUR } from "@/lib/knowledge-hub/calculations"
import { THRESHOLDS } from "@/lib/fiscal-data"

const PDV_THRESHOLD = THRESHOLDS.pdv.value

export function PDVThresholdCalculator() {
  const [currentRevenue, setCurrentRevenue] = useState(35000)
  const [monthlyAverage, setMonthlyAverage] = useState(4000)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  const analysis = useMemo(() => {
    const remainingMonths = 12 - currentMonth
    const projectedYearEnd = currentRevenue + monthlyAverage * remainingMonths
    const percentageOfThreshold = (currentRevenue / PDV_THRESHOLD) * 100
    const willCrossThreshold = projectedYearEnd > PDV_THRESHOLD

    let monthToCross: number | null = null
    if (willCrossThreshold) {
      const revenueNeeded = PDV_THRESHOLD - currentRevenue
      const monthsToThreshold = Math.ceil(revenueNeeded / monthlyAverage)
      monthToCross = Math.min(currentMonth + monthsToThreshold, 12)
    }

    return {
      projectedYearEnd,
      percentageOfThreshold: Math.min(percentageOfThreshold, 100),
      willCrossThreshold,
      monthToCross,
      safeMonthlyRevenue:
        remainingMonths > 0 ? (PDV_THRESHOLD - currentRevenue) / remainingMonths : 0,
    }
  }, [currentRevenue, monthlyAverage, currentMonth])

  const animatedPercentage = useAnimatedNumber(analysis.percentageOfThreshold, { durationMs: 600 })
  const animatedProjected = useAnimatedNumber(analysis.projectedYearEnd, { durationMs: 750 })
  const animatedSafeMonthly = useAnimatedNumber(analysis.safeMonthlyRevenue, { durationMs: 750 })

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

  return (
    <div className="card p-6 space-y-6">
      {/* Inputs */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">Trenutni prihod (YTD)</label>
          <input
            type="range"
            min={0}
            max={80000}
            step={100}
            value={currentRevenue}
            onChange={(e) => setCurrentRevenue(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              value={currentRevenue}
              onChange={(e) => setCurrentRevenue(Number(e.target.value))}
              className="w-full rounded-md border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-white/40 min-h-[44px] md:min-h-0"
            />
            <span className="text-xs text-white/50 whitespace-nowrap">max 80k</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">Prosječni mjesečni prihod</label>
          <input
            type="range"
            min={0}
            max={20000}
            step={100}
            value={monthlyAverage}
            onChange={(e) => setMonthlyAverage(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              value={monthlyAverage}
              onChange={(e) => setMonthlyAverage(Number(e.target.value))}
              className="w-full rounded-md border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-white/40 min-h-[44px] md:min-h-0"
            />
            <span className="text-xs text-white/50 whitespace-nowrap">max 20k</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">Trenutni mjesec</label>
          <select
            value={currentMonth}
            onChange={(e) => setCurrentMonth(Number(e.target.value))}
            className="w-full rounded-md border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white min-h-[44px] md:min-h-0"
          >
            {monthNames.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <p className="text-xs text-white/70">Preostali mjeseci se računaju do prosinca.</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-sm mb-1 text-white">
          <span>Napredak prema pragu</span>
          <span>{animatedPercentage.toFixed(1)}%</span>
        </div>
        <div className="h-4 bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              analysis.percentageOfThreshold > 90
                ? "bg-chart-8"
                : analysis.percentageOfThreshold > 70
                  ? "bg-warning"
                  : "bg-chart-4"
            )}
            style={{ width: `${Math.min(animatedPercentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/70 mt-1">
          <span>{formatEUR(0)}</span>
          <span>{formatEUR(PDV_THRESHOLD)}</span>
        </div>
      </div>

      {/* Results */}
      <div
        key={analysis.willCrossThreshold ? "cross" : "safe"}
        className={cn(
          "p-4 rounded-xl transition-colors animate-fade-in",
          analysis.willCrossThreshold
            ? "bg-warning/10 border border-amber-500/30"
            : "bg-chart-4/10 border border-emerald-500/30"
        )}
      >
        {analysis.willCrossThreshold ? (
          <>
            <h3 className="font-semibold text-amber-300 mb-2">Prelazite prag!</h3>
            <p className="text-sm text-amber-200">
              Projekcija do kraja godine: <strong>{formatEUR(animatedProjected)}</strong>
              {analysis.monthToCross && (
                <span className="block mt-1">
                  Očekivani prelazak praga: <strong>{monthNames[analysis.monthToCross - 1]}</strong>
                </span>
              )}
            </p>
          </>
        ) : (
          <>
            <h3 className="font-semibold text-emerald-300 mb-2">Ispod praga</h3>
            <p className="text-sm text-emerald-200">
              Projekcija do kraja godine: <strong>{formatEUR(animatedProjected)}</strong>
              {analysis.safeMonthlyRevenue > 0 && (
                <span className="block mt-1">
                  Sigurni ste ako održite prosječni prihod ispod{" "}
                  <strong>{formatEUR(Math.floor(animatedSafeMonthly))}/mj</strong>
                </span>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
