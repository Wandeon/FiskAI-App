// src/components/knowledge-hub/calculators/ContributionCalculator.tsx
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateContributions, formatEUR } from "@/lib/knowledge-hub/calculations"
import { PAYMENT_IBANS, PAYMENT_MODEL } from "@/lib/knowledge-hub/constants"
import { useAnimatedNumber } from "@/hooks/use-animated-number"
import { BreakdownBars } from "@/components/knowledge-hub/charts/BreakdownBars"
import { cn } from "@/lib/utils"

interface Props {
  embedded?: boolean
}

function AnimatedCurrency({ value, className }: { value: number; className?: string }) {
  const [target, setTarget] = useState(0)

  useEffect(() => {
    setTarget(value)
  }, [value])

  const animated = useAnimatedNumber(target, { durationMs: 520 })
  return (
    <span className={cn("font-mono font-bold text-white", className)}>{formatEUR(animated)}</span>
  )
}

export function ContributionCalculator({ embedded = true }: Props) {
  const breakdown = calculateContributions()

  const content = (
    <div className="space-y-4">
      <div className="grid gap-3">
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <div>
            <p className="font-medium text-white">MIO I. stup (mirovinsko)</p>
            <p className="text-sm text-white/70">15% od osnovice</p>
          </div>
          <AnimatedCurrency value={breakdown.mioI} />
        </div>
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <div>
            <p className="font-medium text-white">MIO II. stup (kapitalizirano)</p>
            <p className="text-sm text-white/70">5% od osnovice</p>
          </div>
          <AnimatedCurrency value={breakdown.mioII} />
        </div>
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <div>
            <p className="font-medium text-white">HZZO (zdravstveno)</p>
            <p className="text-sm text-white/70">16,5% od osnovice</p>
          </div>
          <AnimatedCurrency value={breakdown.hzzo} />
        </div>
        <div className="flex justify-between items-center py-2 bg-surface/10 px-3 rounded-lg border border-white/20">
          <p className="font-bold text-white">Ukupno mjesečno</p>
          <AnimatedCurrency value={breakdown.total} className="text-lg" />
        </div>
      </div>

      <BreakdownBars
        formatValue={formatEUR}
        items={[
          { label: "MIO I.", value: breakdown.mioI, colorClassName: "bg-chart-7" },
          { label: "MIO II.", value: breakdown.mioII, colorClassName: "bg-interactive" },
          { label: "HZZO", value: breakdown.hzzo, colorClassName: "bg-chart-4" },
        ]}
      />
      <p className="text-sm text-white/70">
        Osnovica za izračun: {formatEUR(breakdown.base)} (minimalna osnovica 2025.)
      </p>

      <details className="rounded-xl border border-white/10 bg-surface/5 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white">
          IBAN-ovi za uplatu (HUB3)
        </summary>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-white/70">MIO I. stup (državni proračun)</span>
            <span className="font-mono text-white">{PAYMENT_IBANS.STATE_BUDGET}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-white/70">MIO II. stup</span>
            <span className="font-mono text-white">{PAYMENT_IBANS.MIO_II}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-white/70">HZZO</span>
            <span className="font-mono text-white">{PAYMENT_IBANS.HZZO}</span>
          </div>
          <p className="pt-2 text-xs text-white/50">Model: {PAYMENT_MODEL}</p>
        </div>
      </details>
    </div>
  )

  if (embedded) {
    return <div className="my-6">{content}</div>
  }

  return (
    <Card className="card">
      <CardHeader>
        <CardTitle>Kalkulator doprinosa 2025.</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
