// src/components/assistant-v2/reasoning/ReasoningCard.tsx
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, Check } from "lucide-react"
import type { ReasoningEvent, ReasoningStage } from "@/lib/assistant/reasoning"
import { getStageLabel, getStageIcon } from "@/lib/assistant/reasoning/client"

interface ReasoningCardProps {
  stage: ReasoningStage
  completeEvent: ReasoningEvent
  allEvents: ReasoningEvent[]
  defaultExpanded?: boolean
  className?: string
}

export function ReasoningCard({
  stage,
  completeEvent,
  allEvents,
  defaultExpanded = false,
  className,
}: ReasoningCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const label = getStageLabel(stage)
  const icon = getStageIcon(stage)

  // Get summary from complete event data
  const data = completeEvent.data as { summary?: string } | undefined
  const summary = data?.summary || completeEvent.message || "Zavrseno"

  // Filter events for this stage
  const stageEvents = allEvents.filter((e) => e.stage === stage)

  return (
    <div className={cn("bg-surface rounded-lg border border-default overflow-hidden", className)}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-1 transition-colors"
        aria-expanded={isExpanded}
      >
        {/* Stage icon */}
        <span className="text-lg">{icon}</span>

        {/* Label and summary */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground">{label}</span>
            <Check className="w-4 h-4 text-success-icon" />
          </div>
          <p className="text-sm text-secondary truncate">{summary}</p>
        </div>

        {/* Expand/collapse icon */}
        <div className="text-tertiary">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-subtle bg-surface-1">
          <StageDetails stage={stage} events={stageEvents} data={data} />
        </div>
      )}
    </div>
  )
}

interface StageDetailsProps {
  stage: ReasoningStage
  events: ReasoningEvent[]
  data: unknown
}

function StageDetails({ stage, events, data }: StageDetailsProps) {
  // Render different content based on stage
  switch (stage) {
    case "SOURCES":
      return <SourcesDetails data={data} />
    case "APPLICABILITY":
      return <ApplicabilityDetails data={data} />
    case "CONFIDENCE":
      return <ConfidenceDetails data={data} />
    default:
      return <GenericDetails events={events} />
  }
}

function SourcesDetails({ data }: { data: unknown }) {
  const sourcesData = data as {
    sources?: Array<{ name: string; authority: string }>
  }
  const sources = sourcesData?.sources || []

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-tertiary uppercase">Pronadeni izvori</h4>
      <ul className="space-y-1">
        {sources.slice(0, 3).map((source, i) => (
          <li key={i} className="text-sm text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-interactive" />
            {source.name}
            <span className="text-xs text-tertiary">({source.authority})</span>
          </li>
        ))}
        {sources.length > 3 && (
          <li className="text-sm text-secondary">+ {sources.length - 3} vise</li>
        )}
      </ul>
    </div>
  )
}

function ApplicabilityDetails({ data }: { data: unknown }) {
  const appData = data as {
    eligibleCount?: number
    exclusions?: Array<{
      ruleTitle: string
      code: string
      expected: string
      actual: string
    }>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-success-text">
          ✓ {appData?.eligibleCount || 0} primjenjivih pravila
        </span>
      </div>

      {appData?.exclusions && appData.exclusions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-tertiary uppercase mb-2">Iskljucena pravila</h4>
          <ul className="space-y-2">
            {appData.exclusions.map((exc, i) => (
              <li key={i} className="text-sm bg-warning-bg p-2 rounded">
                <span className="font-medium">{exc.ruleTitle}</span>
                <p className="text-secondary text-xs mt-1">
                  Ocekivano: {exc.expected}, Stvarno: {exc.actual}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ConfidenceDetails({ data }: { data: unknown }) {
  const confData = data as {
    score?: number
    label?: string
    drivers?: string[]
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            confData?.label === "HIGH" && "bg-success-bg text-success-text",
            confData?.label === "MEDIUM" && "bg-warning-bg text-warning-text",
            confData?.label === "LOW" && "bg-danger-bg text-danger-text"
          )}
        >
          {confData?.label || "N/A"}
        </span>
        <span className="text-sm text-tertiary">
          {confData?.score ? `${Math.round(confData.score * 100)}%` : ""}
        </span>
      </div>

      {confData?.drivers && confData.drivers.length > 0 && (
        <ul className="text-sm text-secondary space-y-1">
          {confData.drivers.map((driver, i) => (
            <li key={i}>• {driver}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GenericDetails({ events }: { events: ReasoningEvent[] }) {
  const progressEvents = events.filter((e) => e.status === "progress" || e.status === "checkpoint")

  if (progressEvents.length === 0) {
    return null
  }

  return (
    <ul className="space-y-1 text-sm text-secondary">
      {progressEvents.map((event, i) => (
        <li key={i}>• {event.message}</li>
      ))}
    </ul>
  )
}
