// src/components/knowledge-hub/guide/PersonalizedSection.tsx
"use client"

import { useSearchParams } from "next/navigation"
import { Lightbulb, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { calculatePausalMonthlyCosts, formatEUR } from "@/lib/knowledge-hub/calculations"
import { getPausalTaxBracket } from "@/lib/knowledge-hub/constants"

export function PersonalizedSection() {
  const searchParams = useSearchParams()

  const prihod = searchParams.get("prihod")
  const gotovina = searchParams.get("gotovina")
  const zaposlenje = searchParams.get("zaposlenje")

  if (!prihod) return null

  const annualRevenue = parseInt(prihod, 10)
  const costs = calculatePausalMonthlyCosts(annualRevenue)
  const bracket = getPausalTaxBracket(annualRevenue)

  return (
    <Card className="mb-8 border-focus/20 bg-interactive/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-interactive/20 text-link">
            <Target className="h-5 w-5" />
          </span>
          <span className="text-white">Vaš personalizirani pregled</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-white/70 mb-4">Na temelju vaših odgovora iz čarobnjaka:</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-surface/10 p-4 rounded-lg border border-white/10">
            <p className="text-sm text-white/70">Očekivani godišnji prihod</p>
            <p className="text-xl font-bold text-white">{formatEUR(annualRevenue)}</p>
          </div>
          <div className="bg-surface/10 p-4 rounded-lg border border-white/10">
            <p className="text-sm text-white/70">Kvartalni porez</p>
            <p className="text-xl font-bold text-white">{formatEUR(bracket.quarterlyTax)}</p>
          </div>
          <div className="bg-surface/10 p-4 rounded-lg border border-white/10">
            <p className="text-sm text-white/70">Mjesečni doprinosi</p>
            <p className="text-xl font-bold text-white">{formatEUR(costs.contributions)}</p>
          </div>
          <div className="bg-surface/10 p-4 rounded-lg border border-white/10">
            <p className="text-sm text-white/70">Fiskalizacija</p>
            <p className="text-xl font-bold text-white">
              {gotovina === "da" ? "Potrebna" : "Nije potrebna"}
            </p>
          </div>
        </div>
        {zaposlenje === "da" && (
          <div className="mt-4 flex gap-3 rounded border border-warning/20 bg-warning/10 p-3 text-sm text-white/90">
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning-text">
              <Lightbulb className="h-4 w-4" />
            </span>
            <p className="m-0">
              <strong>Napomena:</strong> Uz zaposlenje kod drugog poslodavca, i dalje plaćate pune
              doprinose za obrt.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
