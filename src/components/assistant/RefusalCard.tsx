// src/components/assistant/RefusalCard.tsx
"use client"

import { cn } from "@/lib/utils"
import type { RefusalPayload } from "@/lib/assistant/reasoning/types"

interface RefusalCardProps {
  payload: RefusalPayload
  language?: "hr" | "en"
  className?: string
  onNextStepClick?: (stepIndex: number) => void
}

const SEVERITY_STYLES = {
  info: "border-info-border bg-info-bg text-info-text",
  warning: "border-warning-border bg-warning-bg text-warning-text",
  critical: "border-danger-border bg-danger-bg text-danger-text",
}

const SEVERITY_ICONS = {
  info: "\u2139\ufe0f",
  warning: "\u26a0\ufe0f",
  critical: "\ud83d\udeab",
}

export function RefusalCard({
  payload,
  language = "hr",
  className,
  onNextStepClick,
}: RefusalCardProps) {
  const { code, messageHr, messageEn, nextSteps = [], context } = payload

  // Determine severity from code
  const severity =
    code === "UNRESOLVED_CONFLICT" || code === "GRAY_ZONE"
      ? "critical"
      : code === "MISSING_REQUIRED_DIMENSION"
        ? "warning"
        : "info"

  return (
    <div className={cn("rounded-lg border p-4", SEVERITY_STYLES[severity], className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{SEVERITY_ICONS[severity]}</span>
        <h3 className="font-medium">
          {language === "hr" ? "Ne mogu odgovoriti" : "Cannot Answer"}
        </h3>
      </div>

      {/* Message */}
      <p className="text-sm mb-3">{language === "hr" ? messageHr : messageEn}</p>

      {/* Missing dimensions context */}
      {context?.missingDimensions && context.missingDimensions.length > 0 && (
        <div className="mb-3 text-sm">
          <span className="font-medium">
            {language === "hr" ? "Nedostaju informacije:" : "Missing information:"}
          </span>
          <ul className="mt-1 list-disc list-inside">
            {context.missingDimensions.map((dim, i) => (
              <li key={i}>{dim}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Conflicting rules context */}
      {context?.conflictingRules && context.conflictingRules.length > 0 && (
        <div className="mb-3 text-sm">
          <span className="font-medium">
            {language === "hr" ? "Proturječna pravila:" : "Conflicting rules:"}
          </span>
          <ul className="mt-1 list-disc list-inside">
            {context.conflictingRules.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Next steps */}
      {nextSteps.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">
            {language === "hr" ? "Sljedeći koraci:" : "Next steps:"}
          </h4>
          <div className="space-y-2">
            {nextSteps.map((step, index) => (
              <button
                key={index}
                onClick={() => onNextStepClick?.(index)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm",
                  "bg-surface/50 border border-current/20",
                  "hover:bg-surface/80 transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-current/30"
                )}
              >
                {language === "hr" ? step.promptHr : step.prompt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
