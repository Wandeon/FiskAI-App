import Link from "next/link"
import { Brain, UserCog } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonBaseStyles =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 h-10 px-4 py-2 mt-4 w-full"

export function ActionCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">FiskAI asistent</p>
            <p className="text-sm text-[var(--muted)]">
              Pitaj bilo što o financijama, računima ili zakonima
            </p>
          </div>
        </div>
        <Link
          href="/assistant"
          className={cn(buttonBaseStyles, "bg-interactive text-white hover:bg-interactive-hover")}
        >
          Pokreni asistenta
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-bg text-success-text">
            <UserCog className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Workspace za računovođu
            </p>
            <p className="text-sm text-[var(--muted)]">
              Vanjski računovođa radi direktno u FiskAI, bez eksportanja
            </p>
          </div>
        </div>
        <Link
          href="/accountant"
          className={cn(
            buttonBaseStyles,
            "border border-success-border bg-surface text-success-text hover:bg-success-bg"
          )}
        >
          Otvori workspace
        </Link>
      </div>
    </div>
  )
}
