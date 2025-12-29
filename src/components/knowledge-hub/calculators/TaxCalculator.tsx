// src/components/knowledge-hub/calculators/TaxCalculator.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getPausalTaxBracket } from "@/lib/knowledge-hub/constants"
import { calculatePausalAnnualCosts, formatEUR } from "@/lib/knowledge-hub/calculations"
import { useAnimatedNumber } from "@/hooks/use-animated-number"
import { BreakdownBars } from "@/components/knowledge-hub/charts/BreakdownBars"
import { THRESHOLDS } from "@/lib/fiscal-data"

interface Props {
  embedded?: boolean
}

export function TaxCalculator({ embedded = true }: Props) {
  const [revenue, setRevenue] = useState<number>(25000)

  const bracket = getPausalTaxBracket(revenue)
  const costs = calculatePausalAnnualCosts(revenue)

  const animatedTax = useAnimatedNumber(costs.tax, { durationMs: 650 })
  const animatedContributions = useAnimatedNumber(costs.contributions, { durationMs: 650 })
  const animatedHok = useAnimatedNumber(costs.hok, { durationMs: 650 })
  const animatedTotal = useAnimatedNumber(costs.total, { durationMs: 650 })

  const content = (
    <div className="space-y-4">
      <div className="grid gap-3">
        <label className="text-sm font-medium text-white">Očekivani godišnji prihod</label>
        <input
          type="range"
          min={0}
          max={THRESHOLDS.pausalni.value}
          step={100}
          value={revenue}
          onChange={(e) => setRevenue(Number(e.target.value))}
          className="w-full accent-cyan-400"
        />
        <div className="flex items-center gap-3">
          <Input
            type="number"
            value={revenue}
            onChange={(e) => {
              const next = Number(e.target.value)
              if (!Number.isFinite(next)) return
              setRevenue(Math.min(Math.max(next, 0), THRESHOLDS.pausalni.value))
            }}
            min={0}
            max={THRESHOLDS.pausalni.value}
            className="font-mono bg-slate-800 border-white/20 text-white placeholder:text-white/40"
          />
          <span className="text-xs text-white/50 whitespace-nowrap">
            max {formatEUR(THRESHOLDS.pausalni.value)}
          </span>
        </div>
        <p className="text-xs text-white/70">
          Paušalni obrt ima limit od {formatEUR(THRESHOLDS.pausalni.value)} godišnjeg prihoda.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h4 className="font-semibold text-white">Godišnji troškovi (procjena)</h4>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-white/70">Kvartalni porez (×4)</span>
            <span className="font-mono text-white">{formatEUR(animatedTax)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-white/70">Doprinosi (mjesečno × 12)</span>
            <span className="font-mono text-white">{formatEUR(animatedContributions)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-white/70">HOK članarina (kvartalno × 4)</span>
            <span className="font-mono text-white">{formatEUR(animatedHok)}</span>
          </div>
          <div className="flex justify-between gap-3 font-semibold pt-2 border-t border-white/20">
            <span className="text-white">Ukupno godišnje</span>
            <span className="font-mono text-lg text-white">{formatEUR(animatedTotal)}</span>
          </div>
        </div>

        <BreakdownBars
          className="pt-2"
          formatValue={formatEUR}
          items={[
            { label: "Porez", value: costs.tax, colorClassName: "bg-chart-7" },
            { label: "Doprinosi", value: costs.contributions, colorClassName: "bg-interactive" },
            { label: "HOK", value: costs.hok, colorClassName: "bg-chart-4" },
          ]}
        />
        <p className="text-xs text-white/70">
          Porezni razred: {formatEUR(bracket.min)} – {formatEUR(bracket.max)}
        </p>
      </div>

      {revenue >= THRESHOLDS.pausalni.value * 0.9 && (
        <div className="rounded-xl border border-amber-500/30 bg-warning/10 p-3 text-sm text-amber-300">
          Blizu ste limita {formatEUR(THRESHOLDS.pausalni.value)}. Ako očekujete rast, otvorite{" "}
          <Link
            href="/usporedba/preko-praga"
            className="font-semibold underline underline-offset-4 text-amber-200"
          >
            što kada prijeđem prag
          </Link>
          .
        </div>
      )}
    </div>
  )

  if (embedded) {
    return <div className="my-6">{content}</div>
  }

  return (
    <Card className="card">
      <CardHeader>
        <CardTitle>Kalkulator paušalnog poreza 2025.</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
