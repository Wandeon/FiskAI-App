"use client"

import { useState, useEffect, useRef } from "react"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { UNIT_CODES, type EInvoiceLineInput } from "@fiskai/shared"

interface LineItemRowProps {
  line: EInvoiceLineInput
  index: number
  onUpdate: (index: number, updates: Partial<EInvoiceLineInput>) => void
  onDelete: (index: number) => void
  canDelete: boolean
}

const VAT_OPTIONS = [
  { value: 25, label: "25%" },
  { value: 13, label: "13%" },
  { value: 5, label: "5%" },
  { value: 0, label: "0%" },
]

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " EUR"

// Number input that formats on blur, not while typing
function NumberInput({
  value,
  onChange,
  className,
  min = 0,
}: {
  value: number
  onChange: (value: number) => void
  className?: string
  min?: number
}) {
  const [localValue, setLocalValue] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  const formatDisplay = (num: number) => {
    if (!Number.isFinite(num) || num === 0) return ""
    return num.toFixed(2).replace(".", ",")
  }

  const parseInput = (val: string): number => {
    if (!val.trim()) return 0
    const normalized = val.replace(/\s+/g, "").replace(",", ".")
    const num = parseFloat(normalized)
    return Number.isFinite(num) ? Math.max(num, min) : 0
  }

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(formatDisplay(value))
    }
  }, [value, isFocused])

  const handleFocus = () => {
    setIsFocused(true)
    if (value > 0) {
      setLocalValue(String(value).replace(".", ","))
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    const parsed = parseInput(localValue)
    onChange(parsed)
    setLocalValue(formatDisplay(parsed))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (/^[\d,.\s]*$/.test(val)) {
      setLocalValue(val)
      onChange(parseInput(val))
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
      }}
    />
  )
}

// Auto-resizing textarea component
function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      const newHeight = Math.max(44, textarea.scrollHeight)
      textarea.style.height = newHeight + "px"
    }
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={className}
      style={{ resize: "none", overflow: "hidden" }}
    />
  )
}

export function LineItemRow({
  line,
  index,
  onUpdate,
  onDelete,
  canDelete,
}: LineItemRowProps) {
  const lineTotal = line.quantity * line.unitPrice

  const inputClasses = cn(
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white text-sm",
    "placeholder:text-white/30",
    "focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20",
    "transition-colors"
  )

  const selectClasses = cn(
    inputClasses,
    "cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%239ca3af%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat pr-8"
  )

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      {/* Row header with delete button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/40">
          Stavka {index + 1}
        </span>
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="rounded-lg p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label={`Ukloni stavku ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-white/60 mb-1">
          Opis <span className="text-cyan-400">*</span>
        </label>
        <AutoResizeTextarea
          value={line.description}
          onChange={(value) => onUpdate(index, { description: value })}
          placeholder="Opis proizvoda ili usluge..."
          className={cn(inputClasses, "min-h-[44px]")}
        />
      </div>

      {/* Quantity, Unit, Unit Price, VAT - Grid layout */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Quantity */}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">
            Kolicina
          </label>
          <NumberInput
            value={line.quantity}
            onChange={(value) => onUpdate(index, { quantity: value })}
            className={cn(inputClasses, "text-right tabular-nums")}
            min={0.01}
          />
        </div>

        {/* Unit */}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">
            Jedinica
          </label>
          <select
            value={line.unit}
            onChange={(e) => onUpdate(index, { unit: e.target.value })}
            className={selectClasses}
          >
            {Object.entries(UNIT_CODES).map(([code, label]) => (
              <option key={code} value={code} className="bg-slate-900">
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Unit Price */}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">
            Cijena
          </label>
          <NumberInput
            value={line.unitPrice}
            onChange={(value) => onUpdate(index, { unitPrice: value })}
            className={cn(inputClasses, "text-right tabular-nums")}
          />
        </div>

        {/* VAT Rate */}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">
            PDV
          </label>
          <select
            value={line.vatRate}
            onChange={(e) => {
              const vatRate = parseInt(e.target.value)
              const vatCategory = vatRate === 25 ? "S" : vatRate === 0 ? "Z" : "AA"
              onUpdate(index, { vatRate, vatCategory })
            }}
            className={selectClasses}
          >
            {VAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-900">
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Line Total */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <span className="text-sm text-white/60">Iznos stavke:</span>
        <span className="text-lg font-semibold text-white tabular-nums">
          {formatCurrency(lineTotal)}
        </span>
      </div>
    </div>
  )
}

export default LineItemRow
