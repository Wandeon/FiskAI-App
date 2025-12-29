// src/components/ui/combobox.tsx
"use client"

import * as React from "react"
import * as Popover from "@radix-ui/react-popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: string
  label: string
  description?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  id?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Odaberite...",
  emptyMessage = "Nema rezultata",
  className,
  id,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  const filteredOptions = React.useMemo(() => {
    if (!search) return options
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(search.toLowerCase()) ||
        option.description?.toLowerCase().includes(search.toLowerCase())
    )
  }, [options, search])

  // Reset search and highlight when closing
  React.useEffect(() => {
    if (!open) {
      setSearch("")
      setHighlightedIndex(0)
    }
  }, [open])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => Math.max(prev - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].value)
          setOpen(false)
        }
        break
      case "Escape":
        setOpen(false)
        break
    }
  }

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md",
            "border border-default bg-surface-1 px-3 py-2",
            "text-sm text-foreground placeholder:text-muted",
            "hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn(!selectedOption && "text-muted")}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] rounded-md",
            "border border-default bg-surface-elevated p-1 shadow-xl",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          )}
          sideOffset={4}
          align="start"
        >
          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            placeholder="Pretraži..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "w-full rounded-md border-0 bg-surface-1 px-3 py-2 mb-1",
              "text-sm text-foreground placeholder:text-muted",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            )}
            autoFocus
          />

          {/* Options list */}
          <ul role="listbox" aria-label="Options" className="max-h-60 overflow-auto">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">{emptyMessage}</li>
            ) : (
              filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "flex cursor-pointer items-center rounded-md px-3 py-2",
                    "text-sm text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                    index === highlightedIndex && "bg-surface-1",
                    option.value === value && "bg-interactive-secondary"
                  )}
                  tabIndex={0}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      option.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <div>{option.label}</div>
                    {option.description && (
                      <div className="text-xs text-muted">{option.description}</div>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
