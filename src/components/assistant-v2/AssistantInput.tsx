"use client"

import React, { useState, useRef, useCallback, type KeyboardEvent } from "react"
import { Send } from "lucide-react"
import type { Surface } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface AssistantInputProps {
  surface: Surface
  onSubmit: (query: string) => void
  disabled?: boolean
  className?: string
}

const PLACEHOLDERS: Record<Surface, string> = {
  MARKETING: "Ask about Croatian tax, VAT, contributions, fiscalization...",
  APP: "Ask about regulations or your business...",
}

export function AssistantInput({
  surface,
  onSubmit,
  disabled = false,
  className,
}: AssistantInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return

    onSubmit(trimmed)
    setValue("")
  }, [value, disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className={cn("relative", className)}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={PLACEHOLDERS[surface]}
        disabled={disabled}
        rows={2}
        aria-describedby="assistant-input-hint"
        className={cn(
          "w-full p-3 pr-12 border rounded-lg resize-none",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        aria-label="Send"
        className={cn(
          "absolute right-2 bottom-2 p-2 rounded-md",
          "text-primary hover:bg-primary/10",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "focus:outline-none focus:ring-2 focus:ring-primary/50"
        )}
      >
        <Send className="w-5 h-5" />
      </button>

      <p id="assistant-input-hint" className="sr-only">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  )
}
