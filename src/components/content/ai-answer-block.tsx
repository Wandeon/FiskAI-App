import React, { ReactNode } from "react"
import { cn } from "@/lib/utils"

// New Living Truth types
export type AnswerType = "regulatory" | "procedural" | "definitional"
export type ConfidenceLevel = "high" | "medium" | "low" | "pending"
export type EvidenceStrength = "primary-law" | "secondary" | "guidance" | "mixed"
export type ContentType = "guide" | "glossary" | "howto" | "faq"

export interface AIAnswerSource {
  ref: string // Canonical: "NN:2/25"
  label: string // Human: "Narodne novine 2/25"
  url?: string // Link to source
}

export interface AIAnswerBlockProps {
  // Identity
  answerId: string // Stable: "pdv-threshold:bluf:v1"
  version?: number // Default: 1

  // Classification
  type: AnswerType
  confidence: ConfidenceLevel
  evidenceStrength?: EvidenceStrength
  contentType: ContentType
  conceptId?: string

  // Temporal
  lastUpdated: string // ISO date
  asOf?: string // Confidence evaluation date

  // Content
  bluf: string // Bottom Line Up Front - plain text
  sources?: AIAnswerSource[]
  children: ReactNode // Detailed explanation
  className?: string
}

// Confidence badge labels in Croatian
const confidenceLabels: Record<ConfidenceLevel, string> = {
  high: "Visoka pouzdanost",
  medium: "Srednja pouzdanost",
  low: "Niska pouzdanost",
  pending: "Na cekanju",
}

export function AIAnswerBlock({
  answerId,
  version = 1,
  type,
  confidence,
  evidenceStrength,
  contentType,
  conceptId,
  lastUpdated,
  asOf,
  bluf,
  sources,
  children,
  className,
}: AIAnswerBlockProps) {
  // Format date for display in Croatian locale
  const displayDate = new Date(lastUpdated).toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  // Show confidence badge only when confidence is not high
  const showConfidenceBadge = confidence !== "high"

  return (
    <article
      data-ai-answer="true"
      data-answer-id={answerId}
      data-version={version.toString()}
      data-answer-type={type}
      data-confidence={confidence}
      {...(evidenceStrength && { "data-evidence-strength": evidenceStrength })}
      data-content-type={contentType}
      {...(conceptId && { "data-concept-id": conceptId })}
      data-last-updated={lastUpdated}
      {...(asOf && { "data-as-of": asOf })}
      lang="hr"
      className={cn("ai-answer-block", className)}
    >
      <header data-ai-bluf="true" className="ai-answer-header mb-6">
        <p className="text-lg font-medium mb-2">{bluf}</p>
        <div className="ai-answer-meta flex items-center gap-4 text-sm text-white/70">
          <time dateTime={lastUpdated}>Azurirano: {displayDate}</time>
          {showConfidenceBadge && (
            <span
              className={cn(
                "confidence-badge px-2 py-1 rounded text-xs font-medium",
                confidence === "medium" && "bg-warning-bg text-yellow-800",
                confidence === "low" && "bg-danger-bg text-red-800",
                confidence === "pending" && "bg-surface-2 text-foreground"
              )}
            >
              {confidenceLabels[confidence]}
            </span>
          )}
        </div>
      </header>

      <main
        data-ai-explanation="true"
        className="ai-answer-content prose prose-invert max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-accent prose-strong:text-white"
      >
        {children}
      </main>

      {sources && sources.length > 0 && (
        <footer
          data-ai-sources="true"
          className="ai-answer-sources mt-8 pt-6 border-t border-white/10"
        >
          <h2 className="text-lg font-semibold mb-4">Izvori</h2>
          <ul className="list-disc list-inside space-y-2">
            {sources.map((source) => (
              <li key={source.ref} data-source-ref={source.ref} className="text-sm">
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link hover:underline"
                  >
                    {source.label}
                  </a>
                ) : (
                  <span>{source.label}</span>
                )}
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  )
}
