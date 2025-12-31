"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import type { SourceCard as SourceCardType } from "@/lib/assistant/client"
import { SourceCard } from "./SourceCard"
import { cn } from "@/lib/utils"
import type { AssistantVariant } from "./AssistantContainer"

interface SupportingSourcesProps {
  sources: SourceCardType[]
  isExpanded: boolean
  onToggle: () => void
  className?: string
  theme?: AssistantVariant
}

export function SupportingSources({
  sources,
  isExpanded,
  onToggle,
  className,
  theme = "light",
}: SupportingSourcesProps) {
  if (sources.length === 0) return null

  const isDark = theme === "dark"

  return (
    <div className={cn("border-t pt-4", isDark ? "border-subtle/50" : "border-border", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={cn(
          "w-full flex items-center justify-between",
          "text-sm focus:outline-none focus:ring-2 rounded transition-colors",
          isDark
            ? "text-muted hover:text-white focus:ring-cyan-500/50"
            : "text-muted-foreground hover:text-foreground focus:ring-primary/50"
        )}
      >
        <span>Supporting sources ({sources.length})</span>
        <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown data-testid="chevron-icon" className="w-4 h-4" />
        </motion.span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 space-y-3 overflow-hidden"
          >
            {sources.map((source, i) => (
              <motion.div
                key={source.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <SourceCard source={source} variant="compact" theme={theme} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
