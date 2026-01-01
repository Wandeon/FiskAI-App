// src/app/(dashboard)/pos/components/cart.tsx
"use client"

import { Button } from "@/components/ui/button"
import { calculateLineDisplay } from "@/interfaces/invoicing/InvoiceDisplayAdapter"
import type { CartItem } from "../types"

interface Props {
  items: CartItem[]
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
}

export function Cart({ items, onUpdateQuantity, onRemove }: Props) {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  // Use domain-layer adapter for all VAT calculations
  const displayItems = items.map((item) => ({
    ...item,
    display: calculateLineDisplay({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
    }),
  }))

  // Calculate totals using adapter results
  const subtotal = displayItems.reduce((sum, item) => sum + item.display.netAmount, 0)

  // Group VAT by rate (using adapter-calculated VAT amounts)
  const vatByRate = displayItems.reduce(
    (acc, item) => {
      acc[item.vatRate] = (acc[item.vatRate] || 0) + item.display.vatAmount
      return acc
    },
    {} as Record<number, number>
  )

  const totalVat = Object.values(vatByRate).reduce((sum, v) => sum + v, 0)
  const total = subtotal + totalVat

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="font-bold">Košarica</h2>
        <p className="text-sm text-secondary">{items.length} stavki</p>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {displayItems.length === 0 ? (
          <p className="text-center text-tertiary py-8">Košarica je prazna</p>
        ) : (
          displayItems.map((item) => (
            <div key={item.id} className="bg-surface-1 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.description}</p>
                  <p className="text-sm text-secondary">
                    {formatPrice(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <p className="font-bold">{formatPrice(item.display.netAmount)}</p>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                >
                  -
                </Button>
                <span className="w-8 text-center">{item.quantity}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                >
                  +
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-danger-text"
                  onClick={() => onRemove(item.id)}
                >
                  ×
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      <div className="p-4 border-t bg-surface-1 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-secondary">Osnovica:</span>
          <span>{formatPrice(subtotal)}</span>
        </div>

        {Object.entries(vatByRate).map(([rate, amount]) => (
          <div key={rate} className="flex justify-between text-sm">
            <span className="text-secondary">PDV {rate}%:</span>
            <span>{formatPrice(amount)}</span>
          </div>
        ))}

        <div className="flex justify-between text-lg font-bold pt-2 border-t">
          <span>Ukupno:</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  )
}
