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
        <label className="text-sm font-medium">Očekivani godišnji prihod</label>
        <input
          type="range"
          min={0}
          max={60000}
          step={100}
          value={revenue}
          onChange={(e) => setRevenue(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex items-center gap-3">
          <Input
            type="number"
            value={revenue}
            onChange={(e) => {
              const next = Number(e.target.value)
              if (!Number.isFinite(next)) return
              setRevenue(Math.min(Math.max(next, 0), 60000))
            }}
            min={0}
            max={60000}
            className="font-mono"
          />
          <span className="text-xs text-[var(--muted)] whitespace-nowrap">max 60.000€</span>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Paušalni obrt ima limit od 60.000€ godišnjeg prihoda.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
        <h4 className="font-semibold">Godišnji troškovi (procjena)</h4>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-[var(--muted)]">Kvartalni porez (×4)</span>
            <span className="font-mono">{formatEUR(animatedTax)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[var(--muted)]">Doprinosi (mjesečno × 12)</span>
            <span className="font-mono">{formatEUR(animatedContributions)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[var(--muted)]">HOK članarina (kvartalno × 4)</span>
            <span className="font-mono">{formatEUR(animatedHok)}</span>
          </div>
          <div className="flex justify-between gap-3 font-semibold pt-2 border-t border-[var(--border)]">
            <span>Ukupno godišnje</span>
            <span className="font-mono text-lg">{formatEUR(animatedTotal)}</span>
          </div>
        </div>

        <BreakdownBars
          className="pt-2"
          formatValue={formatEUR}
          items={[
            { label: "Porez", value: costs.tax, colorClassName: "bg-blue-600" },
            { label: "Doprinosi", value: costs.contributions, colorClassName: "bg-indigo-600" },
            { label: "HOK", value: costs.hok, colorClassName: "bg-emerald-600" },
          ]}
        />
        <p className="text-xs text-[var(--muted)]">
          Porezni razred: {formatEUR(bracket.min)} – {formatEUR(bracket.max)}
        </p>
      </div>

      {revenue >= 55000 && (
        <div className="rounded-xl border border-warning-100 bg-warning-50 p-3 text-sm text-warning-700">
          Blizu ste limita 60.000€. Ako očekujete rast, otvorite{" "}
          <Link
            href="/usporedba/preko-praga"
            className="font-semibold underline underline-offset-4"
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
