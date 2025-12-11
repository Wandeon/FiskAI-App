import Link from "next/link"
import { Sparkles, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"

interface OnboardingProgressPillProps {
  completed: number
  total: number
  className?: string
}

export function OnboardingProgressPill({ completed, total, className }: OnboardingProgressPillProps) {
  const percent = Math.round((completed / total) * 100)

  return (
    <div
      className={cn(
        "hidden items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 px-4 py-2 text-sm text-[var(--foreground)] shadow-sm lg:flex",
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Onboarding
        </p>
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {completed}/{total} dovršeno ({percent}%)
        </p>
      </div>
      <div className="flex flex-col gap-1 text-right">
        <Link
          href="/onboarding"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          Nastavi postavke
        </Link>
        <Link
          href="mailto:?subject=Pozovi%20računovođu%20na%20FiskAI&body=Pridruži%20se%20mojoj%20tvrtki%20na%20FiskAI"
          className="inline-flex items-center justify-end gap-1 text-xs text-[var(--muted)] hover:text-brand-600"
        >
          <UserPlus className="h-3 w-3" />
          Pozovi računovođu
        </Link>
      </div>
    </div>
  )
}
