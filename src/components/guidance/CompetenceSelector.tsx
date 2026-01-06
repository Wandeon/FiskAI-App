// src/components/guidance/CompetenceSelector.tsx
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  COMPETENCE_LEVELS,
  GUIDANCE_CATEGORIES,
  LEVEL_LABELS,
  LEVEL_DESCRIPTIONS,
  CATEGORY_LABELS,
  type CompetenceLevel,
  type GuidanceCategory,
} from "@/lib/guidance/constants"

interface CompetenceSelectorProps {
  levels: {
    fakturiranje: CompetenceLevel
    financije: CompetenceLevel
    eu: CompetenceLevel
  }
  globalLevel?: CompetenceLevel | null
  onChange: (category: GuidanceCategory | "global", level: CompetenceLevel) => void
  variant?: "full" | "compact"
  className?: string
}

const levelColors: Record<CompetenceLevel, string> = {
  beginner: "bg-chart-4/20 text-success border-success/30",
  average: "bg-warning/20 text-warning border-warning/30",
  pro: "bg-chart-7/20 text-accent border-interactive/30",
}

export function CompetenceSelector({
  levels,
  globalLevel,
  onChange,
  variant = "full",
  className,
}: CompetenceSelectorProps) {
  const categories = Object.values(GUIDANCE_CATEGORIES) as GuidanceCategory[]
  const allLevels = Object.values(COMPETENCE_LEVELS) as CompetenceLevel[]

  if (variant === "compact") {
    return (
      <div className={cn("flex gap-1", className)}>
        {allLevels.map((level) => (
          <button
            key={level}
            onClick={() => onChange("global", level)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-all border",
              globalLevel === level
                ? levelColors[level]
                : "bg-surface/5 text-white/60 border-white/10 hover:bg-surface/10"
            )}
          >
            {LEVEL_LABELS[level]}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="text-sm text-white/60 mb-2">Odaberite razinu pomoći za svaku kategoriju:</div>

      {categories.map((category) => (
        <div key={category} className="space-y-2">
          <label className="text-sm font-medium text-white/80">{CATEGORY_LABELS[category]}</label>
          <div className="flex gap-2">
            {allLevels.map((level) => {
              const isActive = globalLevel ? globalLevel === level : levels[category] === level

              return (
                <button
                  key={level}
                  onClick={() => onChange(category, level)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all border",
                    isActive
                      ? levelColors[level]
                      : "bg-surface/5 text-white/60 border-white/10 hover:bg-surface/10"
                  )}
                >
                  {LEVEL_LABELS[level]}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="pt-4 border-t border-white/10">
        <div className="text-xs text-white/40">
          {globalLevel ? LEVEL_DESCRIPTIONS[globalLevel] : "Različite razine po kategoriji"}
        </div>
      </div>
    </div>
  )
}
