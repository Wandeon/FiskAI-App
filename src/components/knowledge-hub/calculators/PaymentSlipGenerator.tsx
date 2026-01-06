// src/components/knowledge-hub/calculators/PaymentSlipGenerator.tsx
"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PAYMENT_IBANS, PAYMENT_MODEL, MONTHLY_CONTRIBUTIONS } from "@/lib/knowledge-hub/constants"
import { BadgeCheck, CreditCard, Landmark, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

type PaymentType = "MIO_I" | "MIO_II" | "HZZO" | "HOK"

type PaymentOption = {
  value: PaymentType
  label: string
  description: string
  amount: number
  iban: string
  icon: typeof CreditCard
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    value: "MIO_I",
    label: "MIO I. stup",
    description: "Mirovinsko osiguranje (I. stup)",
    amount: MONTHLY_CONTRIBUTIONS.MIO_I.amount,
    iban: PAYMENT_IBANS.STATE_BUDGET,
    icon: ShieldCheck,
  },
  {
    value: "MIO_II",
    label: "MIO II. stup",
    description: "Kapitalizirana štednja (II. stup)",
    amount: MONTHLY_CONTRIBUTIONS.MIO_II.amount,
    iban: PAYMENT_IBANS.MIO_II,
    icon: BadgeCheck,
  },
  {
    value: "HZZO",
    label: "Zdravstveno (HZZO)",
    description: "Obvezno zdravstveno osiguranje",
    amount: MONTHLY_CONTRIBUTIONS.HZZO.amount,
    iban: PAYMENT_IBANS.HZZO,
    icon: Landmark,
  },
  {
    value: "HOK",
    label: "HOK članarina",
    description: "Hrvatska obrtnička komora (kvartalno)",
    amount: 34.2,
    iban: PAYMENT_IBANS.HOK,
    icon: CreditCard,
  },
]

interface Props {
  embedded?: boolean
}

export function PaymentSlipGenerator({ embedded = true }: Props) {
  const [oib, setOib] = useState("")
  const [selectedPayment, setSelectedPayment] = useState<PaymentType>("MIO_I")
  const [amount, setAmount] = useState<number>(PAYMENT_OPTIONS[0].amount)
  const [payerName, setPayerName] = useState("")
  const [payerAddress, setPayerAddress] = useState("")
  const [payerCity, setPayerCity] = useState("")
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string | null>(null)
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [barcodeError, setBarcodeError] = useState<string | null>(null)

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

  const validateOib = (value: string) => {
    if (!/^\d{11}$/.test(value)) return false
    let a = 10
    for (let i = 0; i < 10; i++) {
      a = (a + parseInt(value[i], 10)) % 10
      if (a === 0) a = 10
      a = (a * 2) % 11
    }
    const controlDigit = (11 - a) % 10
    return controlDigit === parseInt(value[10], 10)
  }

  const reference = generateReference()
  const oibError =
    oib.length === 0
      ? undefined
      : oib.length < 11
        ? "OIB mora imati 11 znamenki"
        : validateOib(oib)
          ? undefined
          : "Neispravan OIB"

  const handleGenerate = async () => {
    if (!reference || !!oibError) {
      setBarcodeError("Molimo provjerite OIB prije generiranja barkoda.")
      return
    }

    setBarcodeLoading(true)
    setBarcodeError(null)

    try {
      const response = await fetch("/api/knowledge-hub/hub3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oib,
          paymentType: selectedPayment,
          amount,
          payerName,
          payerAddress,
          payerCity,
        }),
      })

      const data = (await response.json()) as { dataUrl?: string; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Ne mogu generirati barkod.")
      }

      if (!data.dataUrl) throw new Error("Barkod nije generiran.")
      setBarcodeDataUrl(data.dataUrl)
    } catch (error) {
      setBarcodeDataUrl(null)
      setBarcodeError(
        error instanceof Error ? error.message : "Greška prilikom generiranja barkoda."
      )
    } finally {
      setBarcodeLoading(false)
    }
  }

  const content = (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block text-white">Vaš OIB</label>
        <Input
          type="text"
          value={oib}
          onChange={(e) => {
            setBarcodeDataUrl(null)
            setBarcodeError(null)
            setOib(e.target.value.replace(/\D/g, "").slice(0, 11))
          }}
          placeholder="12345678901"
          maxLength={11}
          className="font-mono bg-surface-elevated border-white/20 text-white placeholder:text-white/40"
          error={oibError}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block text-white">Vrsta uplate</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAYMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setSelectedPayment(option.value)
                setAmount(option.amount)
                setBarcodeDataUrl(null)
                setBarcodeError(null)
              }}
              className={cn(
                "p-3 rounded-xl border text-left transition-colors",
                selectedPayment === option.value
                  ? "border-accent-light/50 bg-chart-7/20"
                  : "border-white/10 bg-surface/5 hover:bg-surface/10"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-chart-7/20 text-accent">
                  <option.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">{option.label}</p>
                  <p className="text-xs text-white/70">{option.description}</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {option.amount.toFixed(2)} EUR
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium mb-1 block text-white">Iznos (EUR)</label>
          <Input
            type="number"
            inputMode="decimal"
            value={Number.isFinite(amount) ? amount : ""}
            onChange={(e) => {
              setBarcodeDataUrl(null)
              setBarcodeError(null)
              setAmount(Number(e.target.value))
            }}
            min={0}
            step={0.01}
            className="bg-surface-elevated border-white/20 text-white placeholder:text-white/40"
          />
          <p className="mt-1 text-xs text-white/70">
            Predloženo prema 2025. iznosima. Možete prilagoditi prije generiranja.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block text-white">Poziv na broj</label>
          <Input
            type="text"
            value={reference}
            readOnly
            className="font-mono bg-surface-elevated/50 border-white/20 text-white"
          />
          <p className="mt-1 text-xs text-white/70">Format: OIB-GGGGMM</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="text-sm font-medium mb-1 block text-white">
            Ime / naziv (opcionalno)
          </label>
          <Input
            type="text"
            value={payerName}
            onChange={(e) => {
              setBarcodeDataUrl(null)
              setBarcodeError(null)
              setPayerName(e.target.value)
            }}
            placeholder="Npr. Ivan Horvat / Obrt Horvat"
            className="bg-surface-elevated border-white/20 text-white placeholder:text-white/40"
          />
        </div>
        <div className="md:col-span-1">
          <label className="text-sm font-medium mb-1 block text-white">Adresa (opcionalno)</label>
          <Input
            type="text"
            value={payerAddress}
            onChange={(e) => {
              setBarcodeDataUrl(null)
              setBarcodeError(null)
              setPayerAddress(e.target.value)
            }}
            placeholder="Npr. Radnička cesta 80"
            className="bg-surface-elevated border-white/20 text-white placeholder:text-white/40"
          />
        </div>
        <div className="md:col-span-1">
          <label className="text-sm font-medium mb-1 block text-white">Mjesto (opcionalno)</label>
          <Input
            type="text"
            value={payerCity}
            onChange={(e) => {
              setBarcodeDataUrl(null)
              setBarcodeError(null)
              setPayerCity(e.target.value)
            }}
            placeholder="Npr. 10000 Zagreb"
            className="bg-surface-elevated border-white/20 text-white placeholder:text-white/40"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-surface/5 p-4">
        <h4 className="text-sm font-semibold text-white">Podaci za uplatu</h4>
        <div className="mt-3 grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/70">Primatelj IBAN</span>
            <span className="font-mono text-white">{selected.iban}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/70">Model</span>
            <span className="font-mono text-white">{PAYMENT_MODEL}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/70">Poziv na broj</span>
            <span className="font-mono text-white">{reference || "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/70">Iznos</span>
            <span className="font-mono text-white">
              {Number.isFinite(amount) ? `${amount.toFixed(2)} EUR` : "—"}
            </span>
          </div>
        </div>

        {barcodeError && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-chart-8/10 p-3 text-sm text-danger">
            {barcodeError}
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={
              barcodeLoading || !!oibError || !reference || !Number.isFinite(amount) || amount <= 0
            }
          >
            {barcodeLoading ? "Generiram barkod..." : "Generiraj HUB3 barkod"}
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              setBarcodeDataUrl(null)
              setBarcodeError(null)
            }}
            disabled={!barcodeDataUrl && !barcodeError}
          >
            Očisti rezultat
          </Button>
        </div>
      </div>

      {barcodeDataUrl && (
        <div className="rounded-2xl border border-white/10 bg-surface/5 p-4">
          <h4 className="text-sm font-semibold text-white">Barkod (PDF417)</h4>
          <div className="mt-4 flex flex-col items-center gap-4">
            <Image
              src={barcodeDataUrl}
              alt="HUB3 barkod za uplatu (PDF417)"
              width={1040}
              height={320}
              unoptimized
              className="h-auto w-full max-w-[520px] rounded-lg border border-white/20 bg-surface p-3"
            />
            <a
              href={barcodeDataUrl}
              download={`hub3-${selectedPayment}-${oib}.png`}
              className="inline-flex items-center justify-center rounded-md bg-interactive px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark min-h-[44px] md:min-h-0"
            >
              Preuzmi PNG
            </a>
            <p className="text-xs text-white/70 text-center">
              U mobilnom bankarstvu otvorite &quot;Skeniraj barkod&quot; i usmjerite kameru na kod.
            </p>
          </div>
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
        <CardTitle>Generator uplatnica</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
