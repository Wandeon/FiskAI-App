"use client"

import { useState, useEffect } from "react"
import { Circle, ChevronRight, ListTodo } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ChecklistStats {
  total: number
  completed: number
  critical: number
  soon: number
}

interface ChecklistMiniViewProps {
  collapsed?: boolean
  className?: string
}

export function ChecklistMiniView({ collapsed = false, className }: ChecklistMiniViewProps) {
  const [stats, setStats] = useState<ChecklistStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/guidance/checklist")
        if (res.ok) {
          const data = await res.json()
          // Use the stats object returned by the API which correctly
          // tracks completed items from the interactions table
          const apiStats = data.stats || { total: 0, completed: 0, critical: 0, soon: 0 }
          setStats({
            total: apiStats.total,
            completed: apiStats.completed,
            critical: apiStats.critical,
            soon: apiStats.soon,
          })
        }
      } catch (error) {
        console.error("Failed to fetch checklist stats:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  const pending = stats ? stats.total - stats.completed : 0
  const progress = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  if (collapsed) {
    // Collapsed mini icon view
    return (
      <Link
        href="/checklist"
        className={cn(
          "relative flex items-center justify-center rounded-xl p-2 transition-colors",
          "hover:bg-surface/5",
          pending > 0 ? "text-warning" : "text-success",
          className
        )}
        title={`${pending} zadataka`}
      >
        <ListTodo className="h-5 w-5" />
        {pending > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-white">
            {pending > 9 ? "9+" : pending}
          </span>
        )}
      </Link>
    )
  }

  // Expanded view
  return (
    <div className={cn("rounded-2xl surface-glass p-3", className)}>
      <Link href="/checklist" className="flex items-center justify-between group">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-[var(--muted)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">Zadaci</span>
        </div>
        <ChevronRight className="h-4 w-4 text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors" />
      </Link>

      {isLoading ? (
        <div className="mt-3 h-2 rounded-full bg-surface/5 animate-pulse" />
      ) : stats ? (
        <>
          {/* Progress bar */}
          <div className="mt-3 h-2 rounded-full bg-surface/5 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                progress === 100 ? "bg-chart-4" : "bg-brand-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[var(--muted)]">
              {stats.completed}/{stats.total} dovršeno
            </span>
            <span
              className={cn(
                "font-medium",
                progress === 100 ? "text-success" : "text-[var(--foreground)]"
              )}
            >
              {progress}%
            </span>
          </div>

          {/* Urgency indicators */}
          {(stats.critical > 0 || stats.soon > 0) && (
            <div className="mt-2 flex gap-2">
              {stats.critical > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-danger-text">
                  <Circle className="h-2 w-2 fill-danger" />
                  {stats.critical} hitno
                </span>
              )}
              {stats.soon > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-warning">
                  <Circle className="h-2 w-2 fill-warning" />
                  {stats.soon} uskoro
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted)]">Nema podataka</p>
      )}
    </div>
  )
}
