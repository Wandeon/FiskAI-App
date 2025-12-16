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
  return <span className={cn("font-mono font-bold", className)}>{formatEUR(animated)}</span>
}

export function ContributionCalculator({ embedded = true }: Props) {
  const breakdown = calculateContributions()

  const content = (
    <div className="space-y-4">
      <div className="grid gap-3">
        <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
          <div>
            <p className="font-medium">MIO I. stup (mirovinsko)</p>
            <p className="text-sm text-[var(--muted)]">15% od osnovice</p>
          </div>
          <AnimatedCurrency value={breakdown.mioI} />
        </div>
        <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
          <div>
            <p className="font-medium">MIO II. stup (kapitalizirano)</p>
            <p className="text-sm text-[var(--muted)]">5% od osnovice</p>
          </div>
          <AnimatedCurrency value={breakdown.mioII} />
        </div>
        <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
          <div>
            <p className="font-medium">HZZO (zdravstveno)</p>
            <p className="text-sm text-[var(--muted)]">16,5% od osnovice</p>
          </div>
          <AnimatedCurrency value={breakdown.hzzo} />
        </div>
        <div className="flex justify-between items-center py-2 bg-[var(--surface-secondary)] px-3 rounded-lg border border-[var(--border)]">
          <p className="font-bold">Ukupno mjesečno</p>
          <AnimatedCurrency value={breakdown.total} className="text-lg" />
        </div>
      </div>

      <BreakdownBars
        formatValue={formatEUR}
        items={[
          { label: "MIO I.", value: breakdown.mioI, colorClassName: "bg-blue-600" },
          { label: "MIO II.", value: breakdown.mioII, colorClassName: "bg-indigo-600" },
          { label: "HZZO", value: breakdown.hzzo, colorClassName: "bg-emerald-600" },
        ]}
      />
      <p className="text-sm text-[var(--muted)]">
        Osnovica za izračun: {formatEUR(breakdown.base)} (minimalna osnovica 2025.)
      </p>

      <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          IBAN-ovi za uplatu (HUB3)
        </summary>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[var(--muted)]">MIO I. stup (državni proračun)</span>
            <span className="font-mono">{PAYMENT_IBANS.STATE_BUDGET}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-[var(--muted)]">MIO II. stup</span>
            <span className="font-mono">{PAYMENT_IBANS.MIO_II}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-[var(--muted)]">HZZO</span>
            <span className="font-mono">{PAYMENT_IBANS.HZZO}</span>
          </div>
          <p className="pt-2 text-xs text-[var(--muted)]">Model: {PAYMENT_MODEL}</p>
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
