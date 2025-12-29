// src/app/(dashboard)/pos/components/cash-modal.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal, ModalFooter } from "@/components/ui/modal"
import { processPosSale } from "@/app/actions/pos"
import { toast } from "@/lib/toast"
import { queueOfflineSale, isOnline } from "@/lib/pos/offline-queue"
import type { CartItem } from "../types"
import type { ProcessPosSaleResult } from "@/types/pos"

interface Props {
  items: CartItem[]
  total: number
  onClose: () => void
  onComplete: (result: ProcessPosSaleResult) => void
}

export function CashModal({ items, total, onClose, onComplete }: Props) {
  const [received, setReceived] = useState("")
  const [processing, setProcessing] = useState(false)

  const receivedAmount = parseFloat(received) || 0
  const change = receivedAmount - total

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  // Quick amount buttons
  const quickAmounts = [10, 20, 50, 100].filter((a) => a >= total)

  async function handleSubmit() {
    if (receivedAmount < total) {
      toast.error("Primljeni iznos je manji od ukupnog")
      return
    }

    setProcessing(true)

    try {
      // Check if we're online
      if (!isOnline()) {
        // Queue for later sync
        await queueOfflineSale({
          items,
          paymentMethod: "CASH",
          total,
        })
        toast.success("Prodaja spremljena za sinkronizaciju")
        // Return a complete result for offline mode
        onComplete({
          success: true,
          invoice: {
            id: `offline-${Date.now()}`,
            invoiceNumber: "Na cekanju",
            totalAmount: total,
            issueDate: new Date().toISOString(),
            paymentMethod: "CASH",
            items: items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              vatRate: item.vatRate,
            })),
          },
        })
        return
      }

      const result = await processPosSale({
        items: items.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
        })),
        paymentMethod: "CASH",
      })

      if (result.success) {
        onComplete(result)
      } else {
        // If server error, offer to queue offline
        const shouldQueue = window.confirm(
          `${result.error}\n\nZelite li spremiti prodaju za kasniju sinkronizaciju?`
        )
        if (shouldQueue) {
          await queueOfflineSale({
            items,
            paymentMethod: "CASH",
            total,
          })
          toast.success("Prodaja spremljena za sinkronizaciju")
          onComplete({
            success: true,
            invoice: {
              id: `offline-${Date.now()}`,
              invoiceNumber: "Na cekanju",
              totalAmount: total,
              issueDate: new Date().toISOString(),
              paymentMethod: "CASH",
              items: items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
                vatRate: item.vatRate,
              })),
            },
          })
        } else {
          toast.error(result.error || "Greska pri obradi")
        }
      }
    } catch (error) {
      // Network error - queue for offline
      await queueOfflineSale({
        items,
        paymentMethod: "CASH",
        total,
      })
      toast.success("Nema veze - prodaja spremljena za sinkronizaciju")
      onComplete({
        success: true,
        invoice: {
          id: `offline-${Date.now()}`,
          invoiceNumber: "Na cekanju",
          totalAmount: total,
          issueDate: new Date().toISOString(),
          paymentMethod: "CASH",
          items: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            vatRate: item.vatRate,
          })),
        },
      })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Gotovinska uplata" size="md">
      <div className="space-y-6">
        {/* Total due */}
        <div className="text-center">
          <p className="text-sm text-secondary">Za platiti</p>
          <p className="text-4xl font-bold">{formatPrice(total)}</p>
        </div>

        {/* Quick amounts */}
        {quickAmounts.length > 0 && (
          <div className="flex justify-center gap-2">
            {quickAmounts.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                onClick={() => setReceived(amount.toString())}
              >
                {amount} €
              </Button>
            ))}
          </div>
        )}

        {/* Amount received */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Primljeno (EUR)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            placeholder="0.00"
            className="text-2xl text-center"
            autoFocus
          />
        </div>

        {/* Change */}
        {receivedAmount >= total && (
          <div className="text-center p-4 bg-success-bg rounded-lg">
            <p className="text-sm text-success-text">Vraćeno kupcu</p>
            <p className="text-3xl font-bold text-success-text">
              {formatPrice(change)}
            </p>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={processing}>
          Odustani
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={receivedAmount < total || processing}
        >
          {processing ? "Obrada..." : "Završi prodaju"}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
