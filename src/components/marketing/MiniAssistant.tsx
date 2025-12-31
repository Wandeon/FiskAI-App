"use client"

import React, { useState, useCallback, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Send, ArrowRight, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

const HIGH_INTENT_CHIPS = [
  "Kad moram u sustav PDV-a?",
  "Koji je prag za paušalni obrt?",
  "Koji su rokovi i doprinosi za ovaj mjesec?",
]

const AUTHORITY_SOURCES = [
  { name: "Narodne novine", short: "NN" },
  { name: "Porezna uprava", short: "PU" },
  { name: "HNB", short: "HNB" },
]

export function MiniAssistant() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  const navigateToAssistant = useCallback(
    (q: string) => {
      const params = new URLSearchParams({
        q: q.trim(),
        surface: "MARKETING",
        src: "landing-mini",
      })
      router.push(`/assistant?${params.toString()}`)
    },
    [router]
  )

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim()
    if (!trimmed) return
    navigateToAssistant(trimmed)
  }, [query, navigateToAssistant])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const handleChipClick = useCallback(
    (chip: string) => {
      navigateToAssistant(chip)
    },
    [navigateToAssistant]
  )

  return (
    <section className="relative bg-gradient-to-b from-surface-dark via-surface-1 to-white py-12 md:py-16">
      {/* Subtle grid overlay continuing from hero */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      <div className="relative mx-auto max-w-2xl px-4 md:px-6">
        {/* Card container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl bg-surface/50 backdrop-blur-md border border-border p-6 md:p-8"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-white">
              Pitajte nas bilo što o porezima i poslovanju
            </h2>
            <p className="text-sm text-secondary mt-1">
              Svaki odgovor potkrijepljen službenim izvorima
            </p>
          </div>

          {/* Input */}
          <div className="relative mb-4">
            <motion.div
              className={cn(
                "relative rounded-xl transition-all duration-300",
                "bg-surface-dark border",
                isFocused ? "border-focus shadow-focus" : "border-border"
              )}
              animate={
                isFocused
                  ? {
                      boxShadow: [
                        "0 0 15px rgba(6,182,212,0.1)",
                        "0 0 25px rgba(6,182,212,0.15)",
                        "0 0 15px rgba(6,182,212,0.1)",
                      ],
                    }
                  : {}
              }
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Postavite pitanje..."
                className={cn(
                  "w-full px-4 py-3.5 pr-12 rounded-xl",
                  "bg-transparent text-white placeholder:text-muted",
                  "focus:outline-none"
                )}
              />
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={!query.trim()}
                aria-label="Pošalji"
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2",
                  "p-2 rounded-lg transition-all duration-200",
                  "disabled:opacity-30 disabled:cursor-not-allowed",
                  "bg-interactive",
                  "text-white shadow-lg",
                  "hover:bg-interactive-hover hover:shadow-xl"
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Send className="w-4 h-4" />
              </motion.button>
            </motion.div>

            {/* Verified answers microline */}
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted mt-2">
              <Shield className="w-3 h-3" />
              Verificirani odgovori s izvorima
            </p>
          </div>

          {/* Suggestion chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-6 md:flex-nowrap md:overflow-x-auto md:justify-start md:scrollbar-hide">
            {HIGH_INTENT_CHIPS.map((chip, i) => (
              <motion.button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "px-3 py-2 text-sm rounded-full whitespace-nowrap",
                  "bg-surface-1 border border-border",
                  "text-secondary hover:text-white",
                  "hover:bg-surface-2 hover:border-border-hover",
                  "transition-all duration-200"
                )}
              >
                {chip}
              </motion.button>
            ))}
          </div>

          {/* Authority proof strip */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-xs text-muted">Izvori:</span>
            {AUTHORITY_SOURCES.map((source) => (
              <span
                key={source.short}
                className="px-2 py-1 text-xs rounded bg-surface-1 text-secondary border border-border"
                title={source.name}
              >
                {source.name}
              </span>
            ))}
          </div>

          {/* CTA link */}
          <div className="text-center">
            <motion.a
              href="/assistant"
              className="inline-flex items-center gap-1.5 text-sm text-link hover:text-link-hover transition-colors"
              whileHover={{ x: 3 }}
            >
              Otvori puni odgovor sa izvorima
              <ArrowRight className="w-4 h-4" />
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
