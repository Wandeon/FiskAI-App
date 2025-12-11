'use client'

import { Trash2, GripVertical, Package } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface LineItemEditorProps {
  index: number
  line: {
    description: string
    quantity: number
    unit?: string
    unitPrice: number
    vatRate?: number
  }
  onChange: (field: string, value: string | number) => void
  onRemove: () => void
  canRemove: boolean
  error?: Record<string, string>
}

const unitOptions = [
  { value: "C62", label: "Komad" },
  { value: "HUR", label: "Sat" },
  { value: "DAY", label: "Dan" },
  { value: "MON", label: "Mjesec" },
  { value: "KGM", label: "Kilogram" },
  { value: "LTR", label: "Litra" },
  { value: "MTR", label: "Metar" },
  { value: "MTK", label: "m²" },
]

const vatOptions = [
  { value: 25, label: "25%" },
  { value: 13, label: "13%" },
  { value: 5, label: "5%" },
  { value: 0, label: "0%" },
]

export function LineItemEditor({
  index,
  line,
  onChange,
  onRemove,
  canRemove,
  error,
}: LineItemEditorProps) {
  const lineTotal = (line.quantity || 0) * (line.unitPrice || 0)
  const vatAmount = lineTotal * ((line.vatRate || 0) / 100)
  const unit = line.unit || "C62"
  const vatRate = line.vatRate || 25

  return (
    <div className="group rounded-card border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-shadow hover:shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <GripVertical className="h-4 w-4 cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
          <Package className="h-4 w-4" />
          <span>Stavka {index + 1}</span>
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-danger-500 hover:text-danger-700 hover:bg-danger-50 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
            Opis *
          </label>
          <Input
            value={line.description}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="Unesite opis stavke..."
            error={error?.description}
          />
        </div>

        {/* Grid: Qty, Unit, Price, VAT */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Količina
            </label>
            <Input
              type="number"
              step="0.001"
              min="0"
              value={line.quantity}
              onChange={(e) => onChange("quantity", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Jedinica
            </label>
            <select
              value={unit}
              onChange={(e) => onChange("unit", e.target.value)}
              className="w-full rounded-button border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {unitOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Cijena (€)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={line.unitPrice}
              onChange={(e) => onChange("unitPrice", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              PDV
            </label>
            <select
              value={vatRate}
              onChange={(e) => onChange("vatRate", parseInt(e.target.value))}
              className="w-full rounded-button border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {vatOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Line Total */}
        <div className="flex justify-end pt-2 border-t border-[var(--border)]">
          <div className="text-right">
            <p className="text-sm text-[var(--muted)]">
              Neto: {lineTotal.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} € |
              PDV: {vatAmount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €
            </p>
            <p className="font-semibold text-[var(--foreground)]">
              {(lineTotal + vatAmount).toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
