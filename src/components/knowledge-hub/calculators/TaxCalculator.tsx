// src/components/knowledge-hub/calculators/TaxCalculator.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getPausalTaxBracket, PAUSAL_TAX_BRACKETS } from "@/lib/knowledge-hub/constants"
import { calculatePausalAnnualCosts, formatEUR } from "@/lib/knowledge-hub/calculations"

interface Props {
  embedded?: boolean
}

export function TaxCalculator({ embedded = true }: Props) {
  const [revenue, setRevenue] = useState<number>(25000)
  const [showResults, setShowResults] = useState(false)

  const bracket = getPausalTaxBracket(revenue)
  const costs = calculatePausalAnnualCosts(revenue)

  const handleCalculate = () => {
    setShowResults(true)
  }

  const content = (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Očekivani godišnji prihod (EUR)</label>
          <Input
            type="number"
            value={revenue}
            onChange={(e) => {
              setRevenue(Number(e.target.value))
              setShowResults(false)
            }}
            min={0}
            max={60000}
            className="font-mono"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={handleCalculate}>Izračunaj</Button>
        </div>
      </div>

      {showResults && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <h4 className="font-semibold">Godišnji troškovi</h4>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span>Kvartalni porez (x4)</span>
              <span className="font-mono">{formatEUR(costs.tax)}</span>
            </div>
            <div className="flex justify-between">
              <span>Doprinosi (262,51 x 12)</span>
              <span className="font-mono">{formatEUR(costs.contributions)}</span>
            </div>
            <div className="flex justify-between">
              <span>HOK članarina (34,20 x 4)</span>
              <span className="font-mono">{formatEUR(costs.hok)}</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Ukupno godišnje</span>
              <span className="font-mono text-lg">{formatEUR(costs.total)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Porezni razred: {formatEUR(bracket.min)} - {formatEUR(bracket.max)}
          </p>
        </div>
      )}

      {revenue > 60000 && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded">
          ⚠️ Paušalni obrt ima limit od 60.000 EUR godišnje. Za veće prihode razmotrite obrt na
          dohodak ili d.o.o.
        </p>
      )}
    </div>
  )

  if (embedded) {
    return <div className="my-6">{content}</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kalkulator paušalnog poreza 2025.</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
