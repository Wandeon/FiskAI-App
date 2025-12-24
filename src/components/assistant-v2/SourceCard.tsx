"use client"

import React from "react"
import { ExternalLink } from "lucide-react"
import type { SourceCard as SourceCardType } from "@/lib/assistant/client"
import { AuthorityBadge } from "./AuthorityBadge"
import { cn } from "@/lib/utils"

interface SourceCardProps {
  source: SourceCardType
  variant: "expanded" | "compact"
  className?: string
}

export function SourceCard({ source, variant, className }: SourceCardProps) {
  const { title, authority, reference, quote, pageNumber, url, effectiveFrom, confidence, status } =
    source

  const isExpanded = variant === "expanded"
  const isSuperseded = status === "SUPERSEDED"

  return (
    <article
      className={cn(
        "rounded-lg border",
        isSuperseded && "opacity-60",
        isExpanded ? "p-4" : "p-3",
        className
      )}
    >
      {/* Header: Authority badge + Title */}
      <div className="flex items-start gap-2">
        <AuthorityBadge authority={authority} />
        <div className="flex-1 min-w-0">
          <h4 className={cn("font-medium", isExpanded ? "text-base" : "text-sm")}>{title}</h4>
          {reference && <p className="text-sm text-muted-foreground">{reference}</p>}
        </div>
        {isSuperseded && (
          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
            Superseded
          </span>
        )}
      </div>

      {/* Quote excerpt (expanded only) */}
      {isExpanded && quote && (
        <blockquote className="mt-3 pl-3 border-l-2 border-muted text-sm text-muted-foreground italic">
          &ldquo;{quote}&rdquo;
        </blockquote>
      )}

      {/* Footer: Date, Confidence, Link */}
      {isExpanded && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>Effective: {new Date(effectiveFrom).toLocaleDateString()}</span>
            <span>Confidence: {Math.round(confidence * 100)}%</span>
          </div>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            View source
            <ExternalLink className="w-3 h-3" />
            {pageNumber && <span className="text-muted-foreground">(page {pageNumber})</span>}
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
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            View source
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </article>
  )
}
