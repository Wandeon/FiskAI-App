'use client'

import Link from "next/link"
import { CheckCircle2, Circle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageCard, PageCardHeader, PageCardTitle, PageCardContent } from "@/components/ui/page-card"

interface ChecklistItem {
  id: string
  label: string
  description: string
  href: string
  completed: boolean
}

interface OnboardingChecklistProps {
  items: ChecklistItem[]
  className?: string
}

export function OnboardingChecklist({ items, className }: OnboardingChecklistProps) {
  const completedCount = items.filter(i => i.completed).length
  const progress = (completedCount / items.length) * 100

  if (completedCount === items.length) {
    return null // Hide when all complete
  }

  return (
    <PageCard className={cn("overflow-hidden", className)}>
      <PageCardHeader>
        <div className="flex items-center justify-between">
          <PageCardTitle>Započnite s FiskAI</PageCardTitle>
          <span className="text-sm font-medium text-[var(--muted)]">
            {completedCount}/{items.length} dovršeno
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
          <div
            className="h-full bg-brand-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </PageCardHeader>
      <PageCardContent noPadding>
        <div className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-4 px-6 py-4 transition-colors",
                item.completed
                  ? "bg-success-50/50"
                  : "hover:bg-[var(--surface-secondary)]"
              )}
            >
              {item.completed ? (
                <CheckCircle2 className="h-6 w-6 text-success-500 flex-shrink-0" />
              ) : (
                <Circle className="h-6 w-6 text-[var(--muted)] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium",
                  item.completed ? "text-success-700" : "text-[var(--foreground)]"
                )}>
                  {item.label}
                </p>
                <p className="text-sm text-[var(--muted)] truncate">{item.description}</p>
              </div>
              {!item.completed && (
                <ArrowRight className="h-5 w-5 text-[var(--muted)] flex-shrink-0" />
              )}
            </Link>
          ))}
        </div>
      </PageCardContent>
    </PageCard>
  )
}
