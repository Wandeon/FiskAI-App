// src/components/guidance/ChecklistItem.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, X, Clock, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import type { ChecklistItem as ChecklistItemType } from "@/lib/guidance/types"

interface ChecklistItemProps {
  item: ChecklistItemType
  onComplete?: (reference: string) => void
  onDismiss?: (reference: string) => void
  onSnooze?: (reference: string, until: Date) => void
  showActions?: boolean
  className?: string
}

const urgencyStyles = {
  critical: {
    icon: "🔴",
    bg: "bg-danger/10 border-danger-border/20",
    text: "text-danger-text",
  },
  soon: {
    icon: "🟡",
    bg: "bg-warning/10 border-warning/20",
    text: "text-warning",
  },
  upcoming: {
    icon: "🔵",
    bg: "bg-interactive/10 border-focus/20",
    text: "text-link",
  },
  optional: {
    icon: "⚪",
    bg: "bg-[var(--surface-secondary)] border-[var(--border)]",
    text: "text-[var(--muted)]",
  },
}

function formatDueDate(date: Date): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(date)
  due.setHours(0, 0, 0, 0)
  const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntil < 0) return "Kasni " + Math.abs(daysUntil) + " dana!"
  if (daysUntil === 0) return "Danas!"
  if (daysUntil === 1) return "Sutra"
  if (daysUntil <= 7) return "Za " + daysUntil + " dana"
  return due.toLocaleDateString("hr-HR", { day: "numeric", month: "short" })
}

export function ChecklistItem({
  item,
  onComplete,
  onDismiss,
  onSnooze,
  showActions = true,
  className,
}: ChecklistItemProps) {
  const [isLoading, setIsLoading] = useState(false)
  const style = urgencyStyles[item.urgency]

  const handleComplete = async () => {
    if (!onComplete) return
    setIsLoading(true)
    await onComplete(item.reference)
    setIsLoading(false)
  }

  const handleDismiss = async () => {
    if (!onDismiss) return
    setIsLoading(true)
    await onDismiss(item.reference)
    setIsLoading(false)
  }

  const handleSnooze = async (days: number) => {
    if (!onSnooze) return
    setIsLoading(true)
    const until = new Date()
    until.setDate(until.getDate() + days)
    await onSnooze(item.reference, until)
    setIsLoading(false)
  }

  const content = (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border p-3 transition-all",
        style.bg,
        item.action.href && "hover:bg-[var(--surface-secondary)] cursor-pointer",
        className
      )}
    >
      <span className="text-lg mt-0.5">{style.icon}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-[var(--foreground)]">{item.title}</p>
            <p className="text-sm text-[var(--muted)] mt-0.5">{item.description}</p>
          </div>

          {item.dueDate && (
            <span className={cn("text-sm font-medium whitespace-nowrap", style.text)}>
              {formatDueDate(item.dueDate)}
            </span>
          )}
        </div>

        {showActions && (onComplete || onDismiss || onSnooze) && (
          <div className="flex gap-2 mt-3">
            {onComplete && (
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.preventDefault()
                  handleComplete()
                }}
                disabled={isLoading}
                className="h-7 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Gotovo
              </Button>
            )}
            {onSnooze && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isLoading}
                    className="h-7 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Odgodi
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleSnooze(1)}>
                    <Clock className="h-3 w-3 mr-2" />
                    Odgodi 1 dan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSnooze(3)}>
                    <Clock className="h-3 w-3 mr-2" />
                    Odgodi 3 dana
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSnooze(7)}>
                    <Clock className="h-3 w-3 mr-2" />
                    Odgodi 1 tjedan
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault()
                  handleDismiss()
                }}
                disabled={isLoading}
                className="h-7 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <X className="h-3 w-3 mr-1" />
                Odbaci
              </Button>
            )}
          </div>
        )}
      </div>

      {item.action.href && (
        <ChevronRight className="h-5 w-5 text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors mt-0.5" />
      )}
    </div>
  )

  if (item.action.href) {
    return <Link href={item.action.href}>{content}</Link>
  }

  return content
}
