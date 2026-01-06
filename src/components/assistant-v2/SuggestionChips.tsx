"use client"

import React, { useState, useCallback, type KeyboardEvent } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { AssistantVariant } from "./AssistantContainer"

interface SuggestionChipsProps {
  suggestions: string[]
  onSelect: (suggestion: string) => void
  className?: string
  variant?: AssistantVariant
}

const MAX_DISPLAY_LENGTH = 40

function truncate(text: string): string {
  if (text.length <= MAX_DISPLAY_LENGTH) return text
  return text.slice(0, MAX_DISPLAY_LENGTH - 3) + "..."
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const chipVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function SuggestionChips({
  suggestions,
  onSelect,
  className,
  variant = "light",
}: SuggestionChipsProps) {
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

  const isDark = variant === "dark"

  return (
    <motion.div
      role="listbox"
      tabIndex={0}
      aria-activedescendant={`chip-${activeIndex}`}
      aria-label="Suggested questions"
      onKeyDown={handleKeyDown}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn("flex flex-wrap gap-3 justify-center", className)}
    >
      {suggestions.map((suggestion, index) => (
        <motion.button
          key={index}
          id={`chip-${index}`}
          role="option"
          aria-selected={index === activeIndex}
          tabIndex={-1}
          onClick={() => onSelect(suggestion)}
          variants={chipVariants}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          animate={
            isDark
              ? {
                  y: [0, -3, 0],
                  transition: {
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.2,
                  },
                }
              : {}
          }
          className={cn(
            "px-4 py-2.5 text-sm rounded-full",
            "transition-all duration-300",
            "focus:outline-none",
            isDark
              ? [
                  "bg-surface-elevated/30 backdrop-blur-sm",
                  "border border-accent/20",
                  "text-accent-light",
                  "hover:bg-accent/10 hover:border-accent-light/40",
                  "hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]",
                  "hover:text-white",
                  index === activeIndex &&
                    "ring-2 ring-accent/30 ring-offset-2 ring-offset-surface",
                ]
              : [
                  "bg-background text-foreground border border-border",
                  "hover:bg-muted hover:border-muted-foreground/30",
                  index === activeIndex && "ring-2 ring-primary ring-offset-2",
                ]
          )}
        >
          {truncate(suggestion)}
        </motion.button>
      ))}
    </motion.div>
  )
}
