"use client"

import React from "react"
import { motion } from "framer-motion"
import { ExternalLink } from "lucide-react"
import type { SourceCard as SourceCardType } from "@/lib/assistant/client"
import { AuthorityBadge } from "./AuthorityBadge"
import { cn } from "@/lib/utils"
import type { AssistantVariant } from "./AssistantContainer"

interface SourceCardProps {
  source: SourceCardType
  variant: "expanded" | "compact"
  className?: string
  theme?: AssistantVariant
}

export function SourceCard({ source, variant, className, theme = "light" }: SourceCardProps) {
  const { title, authority, reference, quote, pageNumber, url, effectiveFrom, confidence, status } =
    source

  const isExpanded = variant === "expanded"
  const isSuperseded = status === "SUPERSEDED"
  const isDark = theme === "dark"

  return (
    <motion.article
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-lg border",
        isSuperseded && "opacity-60",
        isExpanded ? "p-4" : "p-3",
        isDark ? "bg-surface-elevated/30 border-subtle/50" : "bg-background border-border",
        className
      )}
    >
      {/* Header: Authority badge + Title */}
      <div className="flex items-start gap-2">
        <AuthorityBadge authority={authority} theme={theme} />
        <div className="flex-1 min-w-0">
          <h4
            className={cn(
              "font-medium",
              isExpanded ? "text-base" : "text-sm",
              isDark ? "text-white" : "text-foreground"
            )}
          >
            {title}
          </h4>
          {reference && (
            <p className={cn("text-sm", isDark ? "text-muted" : "text-muted-foreground")}>
              {reference}
            </p>
          )}
        </div>
        {isSuperseded && (
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded",
              isDark
                ? "bg-warning-bg/30 text-warning border border-warning/30"
                : "bg-warning-bg text-warning-text"
            )}
          >
            Superseded
          </span>
        )}
      </div>

      {/* Quote excerpt (expanded only) */}
      {isExpanded && quote && (
        <blockquote
          className={cn(
            "mt-3 pl-3 border-l-2 text-sm italic",
            isDark ? "border-interactive/30 text-muted" : "border-muted text-muted-foreground"
          )}
        >
          &ldquo;{quote}&rdquo;
        </blockquote>
      )}

      {/* Footer: Date, Confidence, Link */}
      {isExpanded && (
        <div
          className={cn(
            "mt-3 flex items-center justify-between text-xs",
            isDark ? "text-muted" : "text-muted-foreground"
          )}
        >
          <div className="flex items-center gap-3">
            <span>
              Effective: {effectiveFrom ? new Date(effectiveFrom).toLocaleDateString() : "Unknown"}
            </span>
            <span>Confidence: {Math.round(confidence * 100)}%</span>
          </div>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1 hover:underline",
              isDark ? "text-accent-light" : "text-primary"
            )}
          >
            View source
            <ExternalLink className="w-3 h-3" />
            {pageNumber && (
              <span className={isDark ? "text-tertiary" : "text-muted-foreground"}>
                (page {pageNumber})
              </span>
            )}
          </a>
        </div>
      )}

      {/* Compact: just show link */}
      {!isExpanded && (
        <div className="mt-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "text-xs hover:underline inline-flex items-center gap-1",
              isDark ? "text-accent-light" : "text-primary"
            )}
          >
            View source
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </motion.article>
  )
}
