// src/components/knowledge-hub/calculators/PaymentSlipGenerator.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PAYMENT_IBANS, PAYMENT_MODEL, MONTHLY_CONTRIBUTIONS } from "@/lib/knowledge-hub/constants"

type PaymentType = "MIO_I" | "MIO_II" | "HZZO" | "HOK"

const PAYMENT_OPTIONS: { value: PaymentType; label: string; amount: number; iban: string }[] = [
  { value: "MIO_I", label: "MIO I. stup", amount: 107.88, iban: PAYMENT_IBANS.STATE_BUDGET },
  { value: "MIO_II", label: "MIO II. stup", amount: 35.96, iban: PAYMENT_IBANS.MIO_II },
  { value: "HZZO", label: "Zdravstveno (HZZO)", amount: 118.67, iban: PAYMENT_IBANS.HZZO },
  { value: "HOK", label: "HOK članarina", amount: 34.2, iban: PAYMENT_IBANS.HOK },
]

interface Props {
  embedded?: boolean
}

export function PaymentSlipGenerator({ embedded = true }: Props) {
  const [oib, setOib] = useState("")
  const [selectedPayment, setSelectedPayment] = useState<PaymentType>("MIO_I")

  const selected = PAYMENT_OPTIONS.find((p) => p.value === selectedPayment)!

  // Generate poziv na broj (reference number) based on payment type
  const generateReference = () => {
    if (!oib || oib.length !== 11) return ""
    // Format: OIB-godina-mjesec for contributions
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    return `${oib}-${year}${month}`
  }

  const content = (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">Vaš OIB</label>
        <Input
          type="text"
          value={oib}
          onChange={(e) => setOib(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="12345678901"
          maxLength={11}
          className="font-mono"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Vrsta uplate</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAYMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedPayment(option.value)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                selectedPayment === option.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="font-medium">{option.label}</p>
              <p className="text-sm text-gray-500">{option.amount.toFixed(2)} EUR</p>
            </button>
          ))}
        </div>
      </div>

      {oib.length === 11 && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <h4 className="font-semibold">Podaci za uplatu</h4>
          <div className="grid gap-2 text-sm font-mono">
            <div>
              <span className="text-gray-500">IBAN:</span>
              <span className="ml-2">{selected.iban}</span>
            </div>
            <div>
              <span className="text-gray-500">Model:</span>
              <span className="ml-2">{PAYMENT_MODEL}</span>
            </div>
            <div>
              <span className="text-gray-500">Poziv na broj:</span>
              <span className="ml-2">{generateReference()}</span>
            </div>
            <div>
              <span className="text-gray-500">Iznos:</span>
              <span className="ml-2">{selected.amount.toFixed(2)} EUR</span>
            </div>
          </div>
          <Button className="w-full mt-3" variant="outline">
            Generiraj Hub3 barkod
          </Button>
        </div>
      )}
    </div>
  )

  if (embedded) {
    return <div className="my-6">{content}</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generator uplatnica</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
