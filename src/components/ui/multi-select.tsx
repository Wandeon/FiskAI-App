'use client'

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Check, ChevronDown } from "lucide-react"

export interface MultiSelectOption {
  label: string
  value: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: MultiSelectOption[]
  onChange: (selected: MultiSelectOption[]) => void
  placeholder?: string
}

export function MultiSelect({ options, value, onChange, placeholder = "Odaberite" }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleOption = (option: MultiSelectOption) => {
    if (value.some((item) => item.value === option.value)) {
      onChange(value.filter((item) => item.value !== option.value))
    } else {
      onChange([...value, option])
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-button border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
      >
        <span className="truncate">
          {value.length > 0 ? value.map((item) => item.label).join(", ") : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-card">
          <div className="max-h-60 overflow-y-auto p-2">
            {options.map((option) => {
              const isSelected = value.some((item) => item.value === option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleOption(option)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--surface-secondary)]"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded border",
                      isSelected
                        ? "border-brand-500 bg-brand-50 text-brand-600"
                        : "border-[var(--border)] text-transparent"
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
