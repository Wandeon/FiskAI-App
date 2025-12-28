import React, { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type ConfidenceLevel = "high" | "medium" | "low" | "pending"

export interface RegulatorySectionProps {
  id: string
  confidence: ConfidenceLevel
  version?: number
  source?: string
  sourceRef?: string
  sourceEvidenceId?: string
  sourcePointerId?: string
  derivedConfidence?: ConfidenceLevel
  derivedReason?: string
  effectiveFrom?: string
  asOf?: string
  hasConflict?: boolean
  children: ReactNode
  className?: string
}

// Confidence ordering for the downgrade policy
// Lower index = higher confidence
const CONFIDENCE_ORDER: ConfidenceLevel[] = ["high", "medium", "low", "pending"]

function getConfidenceRank(level: ConfidenceLevel): number {
  return CONFIDENCE_ORDER.indexOf(level)
}

function computeEffectiveConfidence(
  stated: ConfidenceLevel,
  derived?: ConfidenceLevel
): ConfidenceLevel {
  if (!derived) return stated

  const statedRank = getConfidenceRank(stated)
  const derivedRank = getConfidenceRank(derived)

  // Return the lower confidence (higher rank index)
  return derivedRank > statedRank ? derived : stated
}

// Icon components for confidence levels
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ExclamationTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// Reusable badge class for conflict indicator
const CONFLICT_BADGE_CLASS =
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-warning-bg text-warning-text border-warning-border"

const CONFIDENCE_CONFIG: Record<
  ConfidenceLevel,
  {
    icon: typeof CheckCircleIcon
    label: string
    iconClass: string
    badgeClass: string
  }
> = {
  high: {
    icon: CheckCircleIcon,
    label: "High confidence",
    iconClass: "text-success-icon",
    badgeClass: "bg-success-bg text-success-text border-success-border",
  },
  medium: {
    icon: ExclamationTriangleIcon,
    label: "Medium confidence",
    iconClass: "text-warning-icon",
    badgeClass: "bg-warning-bg text-warning-text border-warning-border",
  },
  low: {
    icon: ExclamationTriangleIcon,
    label: "Low confidence",
    iconClass: "text-danger-icon",
    badgeClass: "bg-danger-bg text-danger-text border-danger-border",
  },
  pending: {
    icon: ClockIcon,
    label: "Pending verification",
    iconClass: "text-muted",
    badgeClass: "bg-surface-1 text-tertiary border-border",
  },
}

export function RegulatorySection({
  id,
  confidence,
  version = 1,
  source,
  sourceRef,
  sourceEvidenceId,
  sourcePointerId,
  derivedConfidence,
  // derivedReason is available in the interface for future tooltip/diagnostic use
  effectiveFrom,
  asOf,
  hasConflict = false,
  children,
  className,
}: RegulatorySectionProps) {
  const effectiveConfidence = computeEffectiveConfidence(confidence, derivedConfidence)
  const confidenceConfig = CONFIDENCE_CONFIG[effectiveConfidence]
  const ConfidenceIcon = confidenceConfig.icon

  return (
    <section
      id={id}
      data-regulatory-section="true"
      data-regulatory-section-version={version.toString()}
      data-confidence-stated={confidence}
      {...(derivedConfidence && { "data-confidence-derived": derivedConfidence })}
      data-confidence-effective={effectiveConfidence}
      {...(source && { "data-source-label": source })}
      {...(sourceRef && { "data-source-ref": sourceRef })}
      {...(sourceEvidenceId && { "data-source-evidence-id": sourceEvidenceId })}
      {...(sourcePointerId && { "data-source-pointer-id": sourcePointerId })}
      {...(effectiveFrom && { "data-effective-from": effectiveFrom })}
      {...(asOf && { "data-as-of": asOf })}
      data-conflict={hasConflict ? "true" : "false"}
      className={cn("regulatory-section relative", className)}
    >
      {/* Metadata bar */}
      <div className="regulatory-section-meta flex items-center gap-2 mb-2 text-xs">
        {/* Confidence badge */}
        <span
          role="status"
          aria-label={confidenceConfig.label}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border",
            confidenceConfig.badgeClass
          )}
          title={confidenceConfig.label}
        >
          <ConfidenceIcon className={cn("w-3.5 h-3.5", confidenceConfig.iconClass)} />
          <span className="sr-only">{confidenceConfig.label}</span>
        </span>

        {/* Conflict warning */}
        {hasConflict && (
          <span
            role="status"
            aria-label="Conflict detected"
            className={CONFLICT_BADGE_CLASS}
            title="Conflict detected - multiple sources disagree"
          >
            <XCircleIcon className="w-3.5 h-3.5 text-warning-icon" />
            <span className="text-xs font-medium">Conflict</span>
          </span>
        )}

        {/* Source citation */}
        {source && <cite className="not-italic text-secondary font-medium">{source}</cite>}
      </div>

      {/* Main content */}
      <div className="regulatory-section-content">{children}</div>
    </section>
  )
}
