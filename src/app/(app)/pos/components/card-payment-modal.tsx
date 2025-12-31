// src/app/(dashboard)/pos/components/card-payment-modal.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { processPosSale } from "@/app/actions/pos"
import { toast } from "@/lib/toast"
import type { CartItem } from "../types"
import type { ProcessPosSaleResult } from "@/types/pos"

interface Props {
  items: CartItem[]
  total: number
  readerId: string
  onClose: () => void
  onComplete: (result: ProcessPosSaleResult) => void
}

type PaymentState = "creating" | "waiting_for_card" | "processing" | "success" | "error"

export function CardPaymentModal({ items, total, readerId, onClose, onComplete }: Props) {
  const [state, setState] = useState<PaymentState>("creating")
  const [error, setError] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  useEffect(() => {
    startPayment()
  }, [])

  async function startPayment() {
    try {
      setState("creating")

      // Create payment intent
      const intentRes = await fetch("/api/terminal/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total }),
      })

      if (!intentRes.ok) {
        throw new Error("Failed to create payment intent")
      }

      const { paymentIntentId: piId } = await intentRes.json()
      setPaymentIntentId(piId)

      // Process on reader
      setState("waiting_for_card")

      const processRes = await fetch("/api/terminal/payment-intent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readerId, paymentIntentId: piId }),
      })

      const processResult = await processRes.json()

      if (!processResult.success) {
        throw new Error(processResult.error || "Payment failed")
      }

      // Payment succeeded, create invoice
      setState("processing")

      const saleResult = await processPosSale({
        items: items.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
        })),
        paymentMethod: "CARD",
        stripePaymentIntentId: piId,
      })

      if (saleResult.success) {
        setState("success")
        onComplete(saleResult)
      } else {
        throw new Error(saleResult.error || "Failed to create invoice")
      }
    } catch (err) {
      setState("error")
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }

  async function handleCancel() {
    // Cancel payment on reader if in progress
    if (paymentIntentId && state === "waiting_for_card") {
      try {
        await fetch(`/api/terminal/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ readerId }),
        })
      } catch {
        // Ignore cancel errors
      }
    }
    onClose()
  }

  return (
    <Modal isOpen={true} title="Kartično plaćanje" onClose={handleCancel}>
      <div className="text-center space-y-6 py-4">
        {/* Total */}
        <div>
          <p className="text-sm text-secondary">Za platiti</p>
          <p className="text-4xl font-bold">{formatPrice(total)}</p>
        </div>

        {/* Status */}
        {state === "creating" && (
          <div className="py-8">
            <div className="animate-spin h-12 w-12 border-4 border-info-border border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-secondary">Priprema plaćanja...</p>
          </div>
        )}

        {state === "waiting_for_card" && (
          <div className="py-8">
            <div className="text-6xl mb-4">💳</div>
            <p className="text-lg font-medium">Prislonite ili umetnite karticu</p>
            <p className="text-sm text-secondary mt-2">Čekanje na terminal...</p>
          </div>
        )}

        {state === "processing" && (
          <div className="py-8">
            <div className="animate-spin h-12 w-12 border-4 border-success border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-secondary">Obrada plaćanja...</p>
          </div>
        )}

        {state === "error" && (
          <div className="py-4">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-lg font-medium text-danger-text">Plaćanje nije uspjelo</p>
            <p className="text-sm text-secondary mt-2">{error}</p>
            <div className="flex justify-center gap-2 mt-6">
              <Button variant="outline" onClick={handleCancel}>
                Odustani
              </Button>
              <Button onClick={startPayment}>Pokušaj ponovno</Button>
            </div>
          </div>
        )}

        {state !== "error" && (
          <Button variant="ghost" onClick={handleCancel}>
            Odustani
          </Button>
        )}
      </div>
    </Modal>
  )
}
