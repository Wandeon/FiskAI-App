"use client"

import { useState, useEffect, useCallback } from "react"
import { Modal, ModalFooter } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Loader2, Download, Copy, Mail, Check } from "lucide-react"
import { OBLIGATION_LABELS, CROATIAN_MONTHS } from "@/lib/pausalni/constants"

interface Obligation {
  id: string
  obligationType: string
  periodMonth: number
  periodYear: number
  amount: string
  dueDate: string
}

interface PaymentSlip {
  payerName: string
  payerAddress: string
  payerCity: string
  recipientName: string
  recipientAddress: string
  recipientCity: string
  recipientIban: string
  amount: number
  model: string
  reference: string
  description: string
}

interface Props {
  obligation: Obligation
  onClose: () => void
}

export function PaymentSlipModal({ obligation, onClose }: Props) {
  const [slip, setSlip] = useState<PaymentSlip | null>(null)
  const [barcode, setBarcode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchPaymentSlip = useCallback(async () => {
    try {
      // Map obligation type to payment slip type
      const typeMap: Record<string, string> = {
        DOPRINOSI_MIO_I: "MIO_I",
        DOPRINOSI_MIO_II: "MIO_II",
        DOPRINOSI_ZDRAVSTVENO: "ZDRAVSTVENO",
        PDV: "PDV",
        HOK: "HOK",
      }

      const slipType = typeMap[obligation.obligationType]
      if (!slipType) {
        console.error("Unknown obligation type:", obligation.obligationType)
        return
      }

      const params = new URLSearchParams({
        type: slipType,
        month: String(obligation.periodMonth),
        year: String(obligation.periodYear),
      })

      if (slipType === "PDV") {
        params.set("amount", obligation.amount)
      }

      const res = await fetch(`/api/pausalni/payment-slip?${params}`)
      const data = await res.json()

      setSlip(data.slip)
      setBarcode(data.barcode)
    } catch (error) {
      console.error("Failed to fetch payment slip:", error)
    } finally {
      setIsLoading(false)
    }
  }, [obligation])

  useEffect(() => {
    fetchPaymentSlip()
  }, [fetchPaymentSlip])

  async function copyToClipboard() {
    if (!slip) return

    const text = `Primatelj: ${slip.recipientName}
IBAN: ${slip.recipientIban}
Model: ${slip.model}
Poziv na broj: ${slip.reference}
Iznos: ${slip.amount.toFixed(2)} EUR
Opis: ${slip.description}`

    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={OBLIGATION_LABELS[obligation.obligationType] || obligation.obligationType}
      description={`${CROATIAN_MONTHS[obligation.periodMonth - 1]} ${obligation.periodYear}`}
      size="md"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : slip ? (
        <div className="space-y-4">
          {/* Payment Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Primatelj:</span>
              <span className="font-medium">{slip.recipientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">IBAN:</span>
              <code className="text-xs bg-[var(--surface-secondary)] px-2 py-1 rounded">
                {slip.recipientIban}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Model:</span>
              <span className="font-medium">{slip.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Poziv na broj:</span>
              <code className="text-xs bg-[var(--surface-secondary)] px-2 py-1 rounded">
                {slip.reference}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Iznos:</span>
              <span className="font-bold text-lg">{slip.amount.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Opis:</span>
              <span className="text-right max-w-[200px]">{slip.description}</span>
            </div>
          </div>

          {/* Barcode */}
          {barcode && (
            <div className="border border-[var(--border)] rounded-lg p-4 bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={barcode} alt="HUB-3A Barcode" className="w-full h-auto" />
              <p className="text-center text-xs text-[var(--muted)] mt-2">
                Skenirajte s mBanking aplikacijom
              </p>
            </div>
          )}

          {/* Actions */}
          <ModalFooter>
            <Button variant="outline" onClick={copyToClipboard}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Kopirano!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Kopiraj
                </>
              )}
            </Button>
            <Button variant="outline" disabled>
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" disabled>
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
          </ModalFooter>
        </div>
      ) : (
        <p className="text-center text-[var(--muted)] py-8">Nije moguće generirati uplatnicu</p>
      )}
    </Modal>
  )
}
