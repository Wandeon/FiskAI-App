"use client"

import { Button } from "@/components/ui/button"

interface Props {
  total: number
  disabled: boolean
  hasTerminal: boolean
  onCash: () => void
  onCard: () => void
  onClear: () => void
}

export function PaymentBar({ total, disabled, hasTerminal, onCash, onCard, onClear }: Props) {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  return (
    <div className="bg-[var(--surface)] border-t border-[var(--border)] p-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        {/* Clear button */}
        <Button
          variant="ghost"
          onClick={onClear}
          disabled={disabled}
          className="text-[var(--muted)]"
        >
          Očisti
        </Button>

        {/* Total */}
        <div className="text-center">
          <p className="text-sm text-[var(--muted)]">Za platiti</p>
          <p className="text-3xl font-bold">{formatPrice(total)}</p>
        </div>

        {/* Payment buttons */}
        <div className="flex gap-2">
          <Button
            size="lg"
            variant="outline"
            onClick={onCash}
            disabled={disabled}
            className="min-w-[120px]"
          >
            Gotovina
          </Button>
          <Button
            size="lg"
            onClick={onCard}
            disabled={disabled || !hasTerminal}
            className="min-w-[120px]"
            title={!hasTerminal ? "Terminal nije konfiguriran" : undefined}
          >
            Kartica
          </Button>
        </div>
      </div>
    </div>
  )
}
