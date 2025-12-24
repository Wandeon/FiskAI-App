"use client"

import React, { useState } from "react"
import type { CitationBlock, ControllerStatus } from "@/lib/assistant/client"
import { SourceCard } from "./SourceCard"
import { SupportingSources } from "./SupportingSources"
import { cn } from "@/lib/utils"

interface EvidencePanelProps {
  citations: CitationBlock | undefined
  status: ControllerStatus
  className?: string
}

export function EvidencePanel({ citations, status, className }: EvidencePanelProps) {
  const [supportingExpanded, setSupportingExpanded] = useState(false)

  const isLoading = status === "LOADING"
  const isEmpty = !citations && status !== "LOADING"

  return (
    <section
      id="assistant-sources"
      aria-label="Sources"
      className={cn("border rounded-lg", className)}
    >
      <header className="p-4 border-b">
        <h3 className="font-medium">Sources</h3>
      </header>

      <div className="p-4">
        {/* Loading skeleton */}
        {isLoading && (
          <div data-testid="evidence-skeleton" className="space-y-4">
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            <div className="h-16 bg-muted rounded animate-pulse" />
            <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
          </div>
        )}

        {/* Empty state */}
        {isEmpty && <p className="text-sm text-muted-foreground">Sources will appear here</p>}

        {/* Citations content */}
        {citations && (
          <div className="space-y-4">
            {/* Primary source - expanded */}
            <SourceCard source={citations.primary} variant="expanded" />

            {/* Supporting sources - collapsed */}
            {citations.supporting.length > 0 && (
              <SupportingSources
                sources={citations.supporting}
                isExpanded={supportingExpanded}
                onToggle={() => setSupportingExpanded(!supportingExpanded)}
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}
