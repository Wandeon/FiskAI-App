"use client"

import * as React from "react"
import { Info, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Option for a situation question
 */
export interface SituationOption<T extends string | boolean> {
  /** Unique value for this option */
  value: T
  /** Icon to display (emoji or Lucide icon component) */
  icon?: string | React.ReactNode
  /** Main label text */
  label: string
  /** Consequences/implications of choosing this option */
  consequences: {
    text: string
    /** Type: check (positive), cross (negative), arrow (neutral/obligation), warning */
    type: "check" | "cross" | "arrow" | "warning"
  }[]
}

interface SituationQuestionProps<T extends string | boolean> {
  /** Question text displayed at the top */
  question: string
  /** Options to choose from */
  options: SituationOption<T>[]
  /** Currently selected value */
  value: T | null
  /** Called when an option is selected */
  onChange: (value: T) => void
  /** Optional info link text */
  infoLinkText?: string
  /** Optional info link URL */
  infoLinkUrl?: string
  /** Optional hint text shown below the question */
  hint?: string
  /** Optional warning text shown at the bottom */
  warning?: string
  /** Whether to show options as a single card with dividers (for radio-style options) */
  compactMode?: boolean
  /** Custom class name */
  className?: string
}

/**
 * SituationQuestion - Reusable question card component for onboarding
 *
 * Displays a question with selectable card options, each showing consequences
 * of that choice. Supports both separate cards and compact (divided) mode.
 */
export function SituationQuestion<T extends string | boolean>({
  question,
  options,
  value,
  onChange,
  infoLinkText,
  infoLinkUrl,
  hint,
  warning,
  compactMode = false,
  className,
}: SituationQuestionProps<T>) {
  // Render consequence indicator based on type
  const renderConsequenceIndicator = (type: SituationOption<T>["consequences"][0]["type"]) => {
    switch (type) {
      case "check":
        return <span className="text-success">&#10003;</span>
      case "cross":
        return <span className="text-danger">&#10007;</span>
      case "warning":
        return <span className="text-warning">&#9888;</span>
      case "arrow":
      default:
        return <span className="text-muted">&rarr;</span>
    }
  }

  // Render a single option card
  const renderOptionCard = (option: SituationOption<T>, index: number) => {
    const isSelected = value === option.value
    const isCompactFirst = compactMode && index === 0
    const isCompactLast = compactMode && index === options.length - 1

    return (
      <button
        key={String(option.value)}
        type="button"
        onClick={() => onChange(option.value)}
        className={cn(
          "w-full text-left transition-all",
          !compactMode && "rounded-lg border shadow-card p-4",
          !compactMode && isSelected && "border-interactive bg-surface ring-2 ring-interactive/20",
          !compactMode && !isSelected && "border-border bg-surface hover:border-interactive/50",
          compactMode && "p-4",
          compactMode && isCompactFirst && "rounded-t-lg",
          compactMode && isCompactLast && "rounded-b-lg",
          compactMode && !isCompactLast && "border-b border-border"
        )}
        aria-pressed={isSelected}
      >
        {/* Option header with icon and label */}
        <div className="flex items-center gap-3">
          {/* Selection indicator for compact mode */}
          {compactMode && (
            <span
              className={cn(
                "w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center",
                isSelected ? "border-interactive bg-interactive" : "border-muted"
              )}
            >
              {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
          )}

          {/* Icon */}
          {option.icon && (
            <span className="text-xl flex-shrink-0">
              {typeof option.icon === "string" ? option.icon : option.icon}
            </span>
          )}

          {/* Label */}
          <span
            className={cn(
              "text-body-base font-medium",
              isSelected ? "text-foreground" : "text-secondary"
            )}
          >
            {option.label}
          </span>
        </div>

        {/* Divider (only in non-compact mode) */}
        {!compactMode && option.consequences.length > 0 && <hr className="my-3 border-border" />}

        {/* Consequences list */}
        {option.consequences.length > 0 && (
          <ul className={cn("space-y-1", compactMode ? "mt-2 ml-7" : "")}>
            {option.consequences.map((consequence, cIndex) => (
              <li key={cIndex} className="flex items-start gap-2 text-body-sm">
                <span className="flex-shrink-0 w-4">
                  {renderConsequenceIndicator(consequence.type)}
                </span>
                <span
                  className={cn(
                    consequence.type === "arrow" && consequence.text.includes("OBVEZA")
                      ? "text-warning-text font-medium"
                      : "text-secondary"
                  )}
                >
                  {consequence.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </button>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Question header */}
      <div className="flex items-center justify-between">
        <h3 className="text-body-lg font-medium text-foreground">{question}</h3>
        <Info className="h-5 w-5 text-muted flex-shrink-0" aria-hidden="true" />
      </div>

      {/* Hint text */}
      {hint && <p className="text-body-sm text-muted">{hint}</p>}

      {/* Options */}
      {compactMode ? (
        <div className="rounded-lg border border-border bg-surface shadow-card overflow-hidden">
          {options.map((option, index) => renderOptionCard(option, index))}
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((option, index) => renderOptionCard(option, index))}
        </div>
      )}

      {/* Warning text */}
      {warning && (
        <p className="flex items-start gap-2 text-body-sm text-warning-text">
          <span className="flex-shrink-0">&#9888;&#65039;</span>
          {warning}
        </p>
      )}

      {/* Info link */}
      {infoLinkText && (
        <a
          href={infoLinkUrl || "#"}
          className="inline-flex items-center gap-1 text-body-sm text-link hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>&#128214;</span>
          {infoLinkText}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
    </div>
  )
}
