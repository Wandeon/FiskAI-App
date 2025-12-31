"use client"

import { useState, useEffect } from "react"
import { Modal, ModalFooter } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Loader2, Download, Printer, Copy, Check } from "lucide-react"
import { CROATIAN_MONTHS, OBLIGATION_LABELS } from "@/lib/pausalni/constants"

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

interface BatchSlip {
  type: "MIO_I" | "MIO_II" | "ZDRAVSTVENO"
  slip: PaymentSlip
  barcode: string
}

interface Props {
  month: number
  year: number
  onClose: () => void
}

export function BatchPaymentSlips({ month, year, onClose }: Props) {
  const [slips, setSlips] = useState<BatchSlip[]>([])
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  useEffect(() => {
    fetchBatchSlips()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year])

  async function fetchBatchSlips() {
    try {
      const res = await fetch("/api/pausalni/payment-slip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ month, year }),
      })

      const data = await res.json()
      setSlips(data.slips || [])
      setTotalAmount(data.totalAmount || 0)
    } catch (error) {
      console.error("Failed to fetch batch payment slips:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function copyToClipboard(slip: PaymentSlip, index: number) {
    const text = `Primatelj: ${slip.recipientName}
IBAN: ${slip.recipientIban}
Model: ${slip.model}
Poziv na broj: ${slip.reference}
Iznos: ${slip.amount.toFixed(2)} EUR
Opis: ${slip.description}`

    await navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  async function copyAllToClipboard() {
    const allText = slips
      .map(
        ({ slip }, index) => `
=== ${index + 1}. ${getTypeLabel(slips[index].type)} ===
Primatelj: ${slip.recipientName}
IBAN: ${slip.recipientIban}
Model: ${slip.model}
Poziv na broj: ${slip.reference}
Iznos: ${slip.amount.toFixed(2)} EUR
Opis: ${slip.description}
`
      )
      .join("\n")

    const text = `MJESEČNE UPLATNICE - ${CROATIAN_MONTHS[month - 1].toUpperCase()} ${year}
Ukupan iznos: ${totalAmount.toFixed(2)} EUR
${allText}
`

    await navigator.clipboard.writeText(text)
    setCopiedIndex(-1) // -1 indicates "all" was copied
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  function getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      MIO_I: OBLIGATION_LABELS.DOPRINOSI_MIO_I,
      MIO_II: OBLIGATION_LABELS.DOPRINOSI_MIO_II,
      ZDRAVSTVENO: OBLIGATION_LABELS.DOPRINOSI_ZDRAVSTVENO,
    }
    return labels[type] || type
  }

  function handlePrintAll() {
    window.print()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Mjesečne uplatnice za doprinose"
      description={`${CROATIAN_MONTHS[month - 1].charAt(0).toUpperCase() + CROATIAN_MONTHS[month - 1].slice(1)} ${year}`}
      size="xl"
      className="max-w-4xl"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : slips.length > 0 ? (
        <div className="space-y-6">
          {/* Total Amount Display */}
          <div className="bg-[var(--surface-secondary)] rounded-lg p-4 border border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--muted)]">Ukupan iznos za uplatu</p>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {totalAmount.toFixed(2)} EUR
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">({slips.length} uplatnice)</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyAllToClipboard}>
                  {copiedIndex === -1 ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Kopirano!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Kopiraj sve
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrintAll}>
                  <Printer className="h-4 w-4 mr-2" />
                  Ispiši sve
                </Button>
              </div>
            </div>
          </div>

          {/* Payment Slips Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {slips.map((item, index) => (
              <div
                key={item.type}
                className="border border-[var(--border)] rounded-lg p-4 space-y-4 bg-[var(--surface)]"
              >
                {/* Header */}
                <div className="border-b border-[var(--border)] pb-3">
                  <h3 className="font-semibold text-[var(--foreground)]">
                    {getTypeLabel(item.type)}
                  </h3>
                  <p className="text-sm text-[var(--muted)] mt-1">
                    {CROATIAN_MONTHS[month - 1].charAt(0).toUpperCase() +
                      CROATIAN_MONTHS[month - 1].slice(1)}{" "}
                    {year}
                  </p>
                </div>

                {/* Payment Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Primatelj:</span>
                    <span className="font-medium text-right text-xs">
                      {item.slip.recipientName}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-[var(--muted)]">IBAN:</span>
                    <code className="text-xs bg-[var(--surface-secondary)] px-2 py-1 rounded">
                      {item.slip.recipientIban}
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Model:</span>
                    <span className="font-medium">{item.slip.model}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-[var(--muted)]">Poziv:</span>
                    <code className="text-xs bg-[var(--surface-secondary)] px-2 py-1 rounded">
                      {item.slip.reference}
                    </code>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[var(--border)]">
                    <span className="text-[var(--muted)] font-medium">Iznos:</span>
                    <span className="font-bold text-lg">{item.slip.amount.toFixed(2)} EUR</span>
                  </div>
                </div>

                {/* Barcode */}
                <div className="border border-[var(--border)] rounded-lg p-3 bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.barcode} alt="HUB-3A Barcode" className="w-full h-auto" />
                  <p className="text-center text-xs text-[var(--muted)] mt-2">
                    Skenirajte s mBanking aplikacijom
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => copyToClipboard(item.slip, index)}
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Kopirano
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Kopiraj
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <ModalFooter>
            <Button variant="outline" onClick={onClose}>
              Zatvori
            </Button>
            <Button variant="outline" disabled>
              <Download className="h-4 w-4 mr-2" />
              Preuzmi PDF
            </Button>
          </ModalFooter>
        </div>
      ) : (
        <div className="text-center text-[var(--muted)] py-8">
          <p>Nije moguće generirati uplatnice za odabrani period.</p>
        </div>
      )}
    </Modal>
  )
}
