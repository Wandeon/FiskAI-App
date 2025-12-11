// src/components/ui/combobox.tsx
"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
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
  disabled,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  const filteredOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(search.toLowerCase()) ||
      option.description?.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (!isOpen) {
      setSearch("")
      setHighlightedIndex(0)
    }
  }, [isOpen])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          Math.min(prev + 1, filteredOptions.length - 1)
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => Math.max(prev - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].value)
          setIsOpen(false)
        }
        break
      case "Escape":
        setIsOpen(false)
        break
    }
  }

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={
          isOpen && filteredOptions[highlightedIndex]
            ? `${id}-option-${highlightedIndex}`
            : undefined
        }
        className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={isOpen ? "Pretraži..." : selectedOption?.label || placeholder}
        value={isOpen ? search : ""}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />

      {/* Display selected value when not searching */}
      {!isOpen && selectedOption && (
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">
          {selectedOption.label}
        </div>
      )}

      {/* Dropdown arrow */}
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <svg
          className={cn("h-4 w-4 text-gray-400 transition-transform", isOpen && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</li>
          ) : (
            filteredOptions.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm",
                  index === highlightedIndex && "bg-blue-50",
                  option.value === value && "bg-blue-100 font-medium"
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={() => handleSelect(option.value)}
              >
                <div>{option.label}</div>
                {option.description && (
                  <div className="text-xs text-gray-500">{option.description}</div>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
