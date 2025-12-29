"use client"

import { useMemo, useState, useRef, useEffect, useCallback } from "react"
import { Trash2, Search } from "lucide-react"

export type ProductSuggestion = {
  id: string
  name: string
  sku?: string | null
  description?: string | null
  unit: string
  price: number
  vatRate: number
  vatCategory?: string
}

type Line = {
  description: string
  quantity: number
  unit?: string
  unitPrice: number
  vatRate?: number
}

interface LineItemTableProps {
  lines: Line[]
  onChange: (index: number, field: keyof Line, value: string | number) => void
  onRemove: (index: number) => void
  canRemove: (index: number) => boolean
  showVat?: boolean
  products?: ProductSuggestion[]
}

// Map unit codes to short Croatian labels
const unitLabels: Record<string, string> = {
  C62: "kom",
  HUR: "sat",
  DAY: "dan",
  MON: "mj",
  KGM: "kg",
  LTR: "L",
  MTR: "m",
  MTK: "m²",
}

// Number input that formats on blur, not while typing
function NumberInput({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (value: number) => void
  className?: string
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
    return Number.isFinite(num) ? num : 0
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

// Auto-resizing textarea component that reports if it's multiline
function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className,
  onMultilineChange,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onMultilineChange?: (isMultiline: boolean) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevMultilineRef = useRef(false)

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      const newHeight = Math.max(44, textarea.scrollHeight)
      textarea.style.height = newHeight + "px"

      // Check if multiline (height > single line ~48px)
      const isMultiline = newHeight > 50
      if (isMultiline !== prevMultilineRef.current) {
        prevMultilineRef.current = isMultiline
        onMultilineChange?.(isMultiline)
      }
    }
  }, [value, onMultilineChange])

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

export function LineItemTable({
  lines,
  onChange,
  onRemove,
  canRemove,
  showVat = true,
  products = [],
}: LineItemTableProps) {
  const [searchIndex, setSearchIndex] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [multilineRows, setMultilineRows] = useState<Record<number, boolean>>({})

  const formatCurrency = (amount: number) =>
    amount.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"

  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return []
    const q = searchTerm.toLowerCase()
    return products
      .map((p) => {
        const matches = [
          p.name?.toLowerCase().indexOf(q),
          p.sku ? p.sku.toLowerCase().indexOf(q) : -1,
          p.description ? p.description.toLowerCase().indexOf(q) : -1,
        ].filter((i) => i !== -1)
        const score = matches.length ? Math.min(...matches) : 999
        return { ...p, score }
      })
      .filter((p) => p.score !== 999)
      .sort((a, b) => a.score - b.score)
      .slice(0, 6)
  }, [products, searchTerm])

  const applySuggestion = (row: number, s: ProductSuggestion) => {
    onChange(row, "description", s.name)
    onChange(row, "unit", s.unit || "C62")
    onChange(row, "unitPrice", s.price)
    onChange(row, "vatRate", showVat ? s.vatRate : 0)
    setSearchIndex(null)
    setSearchTerm("")
  }

  const handleMultilineChange = useCallback((index: number, isMultiline: boolean) => {
    setMultilineRows((prev) => {
      if (prev[index] === isMultiline) return prev
      return { ...prev, [index]: isMultiline }
    })
  }, [])

  const inputBase =
    "w-full h-full bg-transparent border-0 px-3 py-3 text-[13px] outline-none focus:bg-info-bg/50 placeholder:text-muted transition-colors"
  const numberInputBase =
    "w-full h-full bg-transparent border-0 px-3 py-3 text-[13px] outline-none focus:bg-info-bg/50 text-right tabular-nums transition-colors"

  return (
    <div className="overflow-hidden rounded-card border border-[var(--border)] bg-white">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-1 text-[12px] font-medium text-tertiary">
            <th className="text-left px-3 py-2.5 border-b border-[var(--border)]">Opis</th>
            <th className="text-center px-3 py-2.5 border-b border-l border-[var(--border)] w-[80px]">
              Kol.
            </th>
            <th className="text-center px-3 py-2.5 border-b border-l border-[var(--border)] w-[80px]">
              Jed.
            </th>
            <th className="text-right px-3 py-2.5 border-b border-l border-[var(--border)] w-[100px]">
              Cijena
            </th>
            {showVat && (
              <th className="text-center px-3 py-2.5 border-b border-l border-[var(--border)] w-[70px]">
                PDV
              </th>
            )}
            <th className="text-right px-3 py-2.5 border-b border-l border-[var(--border)] w-[110px]">
              Ukupno
            </th>
            <th className="w-[44px] border-b border-l border-[var(--border)]"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const lineTotal = (line.quantity || 0) * (line.unitPrice || 0)
            const vatAmount = showVat ? lineTotal * ((line.vatRate || 0) / 100) : 0
            const total = lineTotal + vatAmount
            const isActiveSuggestions = searchIndex === index && suggestions.length > 0
            const isMultiline = multilineRows[index] || false
            // When multiline: align-top, otherwise: align-middle
            const cellAlign = isMultiline ? "align-top" : "align-middle"

            return (
              <tr
                key={index}
                className={`text-[13px] hover:bg-surface-1/50 transition-colors ${
                  index > 0 ? "border-t border-[var(--border)]" : ""
                }`}
              >
                {/* Description - always align-top */}
                <td className="p-0 align-top relative">
                  <AutoResizeTextarea
                    value={line.description}
                    onChange={(val) => {
                      onChange(index, "description", val)
                      setSearchIndex(index)
                      setSearchTerm(val)
                    }}
                    placeholder="Opis stavke ili pretraga kataloga..."
                    className={`${inputBase} min-h-[44px]`}
                    onMultilineChange={(isMulti) => handleMultilineChange(index, isMulti)}
                  />
                  {isActiveSuggestions && (
                    <div className="absolute left-0 right-0 z-50 mt-0 max-h-56 overflow-auto rounded-md border border-default bg-white shadow-lg">
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-tertiary">
                        <Search className="h-3.5 w-3.5" />
                        Pronađeno u katalogu
                      </div>
                      <ul>
                        {suggestions.map((s) => (
                          <li
                            key={s.id}
                            className="cursor-pointer px-3 py-2 hover:bg-info-bg"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              applySuggestion(index, s)
                            }}
                          >
                            <div className="text-sm font-medium text-foreground">{s.name}</div>
                            <div className="text-xs text-tertiary">
                              {s.price.toLocaleString("hr-HR", { minimumFractionDigits: 2 })} € •{" "}
                              {unitLabels[s.unit] || "kom"} • PDV {s.vatRate}%
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </td>

                {/* Quantity */}
                <td className={`p-0 border-l border-[var(--border)] ${cellAlign}`}>
                  <NumberInput
                    value={line.quantity}
                    onChange={(val) => onChange(index, "quantity", val)}
                    className={`${numberInputBase} min-h-[44px]`}
                  />
                </td>

                {/* Unit */}
                <td className={`p-0 border-l border-[var(--border)] ${cellAlign}`}>
                  <select
                    value={line.unit || "C62"}
                    onChange={(e) => onChange(index, "unit", e.target.value)}
                    className="w-full bg-transparent border-0 px-3 py-3 text-[13px] text-center outline-none focus:bg-info-bg/50 cursor-pointer transition-colors min-h-[44px]"
                  >
                    <option value="C62">kom</option>
                    <option value="HUR">sat</option>
                    <option value="DAY">dan</option>
                    <option value="MON">mj</option>
                    <option value="KGM">kg</option>
                    <option value="LTR">L</option>
                    <option value="MTR">m</option>
                    <option value="MTK">m²</option>
                  </select>
                </td>

                {/* Price */}
                <td className={`p-0 border-l border-[var(--border)] ${cellAlign}`}>
                  <NumberInput
                    value={line.unitPrice}
                    onChange={(val) => onChange(index, "unitPrice", val)}
                    className={`${numberInputBase} min-h-[44px]`}
                  />
                </td>

                {/* VAT */}
                {showVat && (
                  <td className={`p-0 border-l border-[var(--border)] ${cellAlign}`}>
                    <select
                      value={line.vatRate ?? 25}
                      onChange={(e) => onChange(index, "vatRate", parseInt(e.target.value))}
                      className="w-full bg-transparent border-0 px-2 py-3 text-[13px] text-center tabular-nums outline-none focus:bg-info-bg/50 cursor-pointer transition-colors min-h-[44px]"
                    >
                      <option value={25}>25%</option>
                      <option value={13}>13%</option>
                      <option value={5}>5%</option>
                      <option value={0}>0%</option>
                    </select>
                  </td>
                )}

                {/* Total */}
                <td
                  className={`px-3 py-3 text-right font-semibold text-foreground tabular-nums whitespace-nowrap border-l border-[var(--border)] ${cellAlign}`}
                >
                  {formatCurrency(total)}
                </td>

                {/* Delete button */}
                <td className={`p-0 border-l border-[var(--border)] ${cellAlign}`}>
                  <div className="flex items-center justify-center min-h-[44px]">
                    {canRemove(index) ? (
                      <button
                        type="button"
                        onClick={() => onRemove(index)}
                        className="rounded-md p-1.5 text-muted hover:text-danger-text hover:bg-danger-bg transition-colors"
                        aria-label={`Ukloni stavku ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="w-7" />
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
