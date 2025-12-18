// src/app/(dashboard)/checklist/ChecklistPageClient.tsx
"use client"

import { useState } from "react"
import { ClipboardList, Filter, CheckCircle2 } from "lucide-react"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { ChecklistItem, CompetenceSelector } from "@/components/guidance"
import { Button } from "@/components/ui/primitives/button"
import type { ChecklistItem as ChecklistItemType } from "@/lib/guidance/types"
import type { UserGuidancePreferences } from "@/lib/db/schema/guidance"
import { CATEGORY_LABELS, type GuidanceCategory } from "@/lib/guidance/constants"

interface Props {
  initialItems: ChecklistItemType[]
  initialStats: {
    total: number
    critical: number
    soon: number
    upcoming: number
    optional: number
    byCategory: Record<GuidanceCategory, number>
  }
  preferences: UserGuidancePreferences
  companyName: string
}

export function ChecklistPageClient({
  initialItems,
  initialStats,
  preferences,
  companyName,
}: Props) {
  const [items, setItems] = useState(initialItems)
  const [stats, setStats] = useState(initialStats)
  const [filter, setFilter] = useState<GuidanceCategory | "all">("all")
  const [showCompleted, setShowCompleted] = useState(false)

  const filteredItems = items.filter((item) => {
    if (filter !== "all" && item.category !== filter) return false
    return true
  })

  const handleComplete = async (reference: string) => {
    const item = items.find((i) => i.reference === reference)
    if (!item) return

    try {
      await fetch("/api/guidance/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          itemType: item.type,
          itemReference: reference,
        }),
      })

      setItems((prev) => prev.filter((i) => i.reference !== reference))
      setStats((prev) => ({
        ...prev,
        total: prev.total - 1,
        [item.urgency]: (prev[item.urgency as keyof typeof prev] as number) - 1,
      }))
    } catch (error) {
      console.error("Failed to complete item:", error)
    }
  }

  const handleDismiss = async (reference: string) => {
    const item = items.find((i) => i.reference === reference)
    if (!item) return

    try {
      await fetch("/api/guidance/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dismiss",
          itemType: item.type,
          itemReference: reference,
        }),
      })

      setItems((prev) => prev.filter((i) => i.reference !== reference))
    } catch (error) {
      console.error("Failed to dismiss item:", error)
    }
  }

  const currentMonth = new Date().toLocaleDateString("hr-HR", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-cyan-400" />
          Što moram napraviti?
        </h1>
        <p className="text-[var(--muted)] mt-1">
          {companyName} • <span className="capitalize">{currentMonth}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard hover={false} padding="sm">
          <div className="text-2xl font-bold text-[var(--foreground)]">{stats.total}</div>
          <div className="text-sm text-[var(--muted)]">Ukupno zadataka</div>
        </GlassCard>
        <GlassCard hover={false} padding="sm">
          <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
          <div className="text-sm text-[var(--muted)]">Kritično</div>
        </GlassCard>
        <GlassCard hover={false} padding="sm">
          <div className="text-2xl font-bold text-amber-400">{stats.soon}</div>
          <div className="text-sm text-[var(--muted)]">Uskoro</div>
        </GlassCard>
        <GlassCard hover={false} padding="sm">
          <div className="text-2xl font-bold text-emerald-400">
            {initialStats.total - stats.total}
          </div>
          <div className="text-sm text-[var(--muted)]">Dovršeno</div>
        </GlassCard>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === "all" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          Sve ({stats.total})
        </Button>
        {(Object.keys(stats.byCategory) as GuidanceCategory[]).map((cat) => (
          <Button
            key={cat}
            variant={filter === cat ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFilter(cat)}
          >
            {CATEGORY_LABELS[cat]} ({stats.byCategory[cat]})
          </Button>
        ))}
      </div>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <GlassCard hover={false} padding="lg">
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
            <p className="text-[var(--foreground)] text-lg font-medium">Sve je odrađeno!</p>
            <p className="text-[var(--muted)] mt-1">
              {filter === "all"
                ? "Nema zadataka za ovaj mjesec"
                : `Nema zadataka u kategoriji ${CATEGORY_LABELS[filter]}`}
            </p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              onComplete={handleComplete}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  )
}
