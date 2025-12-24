"use client"

import React, { useState, useCallback, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"

interface SuggestionChipsProps {
  suggestions: string[]
  onSelect: (suggestion: string) => void
  className?: string
}

const MAX_DISPLAY_LENGTH = 32

function truncate(text: string): string {
  if (text.length <= MAX_DISPLAY_LENGTH) return text
  return text.slice(0, MAX_DISPLAY_LENGTH - 3) + "..."
}

export function SuggestionChips({ suggestions, onSelect, className }: SuggestionChipsProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault()
          setActiveIndex((prev) => (prev + 1) % suggestions.length)
          break
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault()
          setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
          break
        case "Enter":
        case " ":
          e.preventDefault()
          onSelect(suggestions[activeIndex])
          break
      }
    },
    [suggestions, activeIndex, onSelect]
  )

  if (suggestions.length === 0) return null

  return (
    <div
      role="listbox"
      tabIndex={0}
      aria-activedescendant={`chip-${activeIndex}`}
      aria-label="Suggested questions"
      onKeyDown={handleKeyDown}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          id={`chip-${index}`}
          role="option"
          aria-selected={index === activeIndex}
          tabIndex={-1}
          onClick={() => onSelect(suggestion)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-full border",
            "hover:bg-muted transition-colors",
            "focus:outline-none",
            index === activeIndex && "ring-2 ring-primary/50"
          )}
        >
          {truncate(suggestion)}
        </button>
      ))}
    </div>
  )
}
