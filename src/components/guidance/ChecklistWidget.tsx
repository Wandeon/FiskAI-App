// src/components/guidance/ChecklistWidget.tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ClipboardList, ChevronRight, Loader2 } from "lucide-react"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { ChecklistItem } from "./ChecklistItem"
import type { ChecklistItem as ChecklistItemType } from "@/lib/guidance/types"

interface ChecklistWidgetProps {
  initialItems?: ChecklistItemType[]
  initialStats?: {
    total: number
    critical: number
    soon: number
    byCategory: Record<string, number>
  }
}

export function ChecklistWidget({ initialItems, initialStats }: ChecklistWidgetProps) {
  const [items, setItems] = useState<ChecklistItemType[]>(initialItems || [])
  const [stats, setStats] = useState(initialStats)
  const [isLoading, setIsLoading] = useState(!initialItems)

  useEffect(() => {
    if (initialItems) return

    async function fetchChecklist() {
      try {
        const res = await fetch("/api/guidance/checklist?limit=5")
        const data = await res.json()
        setItems(data.items || [])
        setStats(data.stats)
      } catch (error) {
        console.error("Failed to fetch checklist:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchChecklist()
  }, [initialItems])

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
    <GlassCard hover={false} padding="default">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-white">Što moram napraviti?</h3>
        </div>
        <span className="text-sm text-white/50 capitalize">{currentMonth}</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-white/60">Sve je odrađeno! 🎉</p>
          <p className="text-sm text-white/40 mt-1">Nema zadataka za ovaj mjesec</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              onComplete={handleComplete}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}

      {stats && stats.total > items.length && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <Link
            href="/checklist"
            className="flex items-center justify-between text-sm text-accent hover:text-cyan-300 transition-colors"
          >
            <span>
              Još {stats.total - items.length} zadatak
              {stats.total - items.length === 1 ? "" : "a"}
            </span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </GlassCard>
  )
}
