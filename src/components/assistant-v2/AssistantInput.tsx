"use client"

import React, {
  useState,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type KeyboardEvent,
} from "react"
import { motion } from "framer-motion"
import { Send, Loader2 } from "lucide-react"
import type { Surface } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

export interface AssistantInputHandle {
  /** Fill the input with text and focus it (does NOT submit) */
  fill: (text: string) => void
  /** Focus the input */
  focus: () => void
}

interface AssistantInputProps {
  surface: Surface
  onSubmit: (query: string) => void
  disabled?: boolean
  loading?: boolean
  className?: string
  variant?: "light" | "dark"
}

const PLACEHOLDERS: Record<Surface, string> = {
  MARKETING: "Postavite pitanje o porezima, PDV-u, doprinosima...",
  APP: "Pitajte o propisima ili svom poslovanju...",
}

export const AssistantInput = forwardRef<AssistantInputHandle, AssistantInputProps>(
  function AssistantInput(
    { surface, onSubmit, disabled = false, loading = false, className, variant = "light" },
    ref
  ) {
    const [value, setValue] = useState("")
    const [isFocused, setIsFocused] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Expose imperative methods for parent components
    useImperativeHandle(
      ref,
      () => ({
        fill: (text: string) => {
          setValue(text)
          // Focus after state update
          requestAnimationFrame(() => {
            textareaRef.current?.focus()
          })
        },
        focus: () => {
          textareaRef.current?.focus()
        },
      }),
      []
    )

    const handleSubmit = useCallback(() => {
      const trimmed = value.trim()
      if (!trimmed || disabled || loading) return

      onSubmit(trimmed)
      setValue("")
    }, [value, disabled, loading, onSubmit])

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          handleSubmit()
        }
      },
      [handleSubmit]
    )

    const isDark = variant === "dark"

    return (
      <motion.div
        className={cn(
          "relative rounded-2xl transition-all duration-300",
          isDark
            ? [
                "bg-surface/60 backdrop-blur-xl",
                "border border-interactive/30",
                "shadow-[0_0_30px_rgba(6,182,212,0.15)]",
                isFocused && [
                  "border-accent-light/60",
                  "shadow-[0_0_40px_rgba(6,182,212,0.25)]",
                  "ring-2 ring-cyan-500/20",
                ],
              ]
            : [
                "bg-surface border-2 border-default",
                "shadow-sm",
                isFocused && "border-primary ring-2 ring-primary/20",
              ],
          className
        )}
        animate={
          isDark && isFocused
            ? {
                boxShadow: [
                  "0 0 30px rgba(6,182,212,0.15)",
                  "0 0 40px rgba(6,182,212,0.22)",
                  "0 0 30px rgba(6,182,212,0.15)",
                ],
              }
            : {}
        }
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={PLACEHOLDERS[surface]}
          disabled={disabled || loading}
          rows={2}
          aria-describedby="assistant-input-hint"
          className={cn(
            "w-full p-4 pr-14 rounded-2xl resize-none bg-transparent",
            "focus:outline-none",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isDark
              ? "text-white placeholder:text-muted"
              : "text-foreground placeholder:text-muted-foreground"
          )}
        />

        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || loading || !value.trim()}
          aria-label={loading ? "Učitavanje..." : "Pošalji"}
          className={cn(
            "absolute right-3 bottom-3 p-2.5 rounded-xl",
            "transition-all duration-200",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            isDark
              ? [
                  "bg-gradient-to-r from-accent to-interactive",
                  "text-white",
                  "shadow-lg shadow-cyan-500/25",
                  "hover:shadow-xl hover:shadow-cyan-500/30",
                  "focus:ring-cyan-500 focus:ring-offset-slate-900",
                ]
              : ["bg-primary text-primary-foreground", "hover:bg-primary/90", "focus:ring-primary"]
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </motion.button>

        <p id="assistant-input-hint" className="sr-only">
          Pritisnite Enter za slanje, Shift+Enter za novi red
        </p>
      </motion.div>
    )
  }
)
