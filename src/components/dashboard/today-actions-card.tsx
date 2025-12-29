import Link from "next/link"
import { AlertTriangle, CheckCircle2, Circle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActionAlert {
  id: string
  type: "warning" | "info"
  title: string
  description: string
  action?: { label: string; href: string }
}

interface ActionStat {
  id: string
  label: string
  value: string
  change?: string
  icon: React.ReactNode
}

interface ActionTask {
  id: string
  label: string
  href: string
  completed: boolean
}

interface TodayActionsCardProps {
  alerts: ActionAlert[]
  stats: ActionStat[]
  tasks: ActionTask[]
}

export function TodayActionsCard({ alerts, stats, tasks }: TodayActionsCardProps) {
  return (
    <div className="rounded-3xl border border-white/20 bg-white/70 p-6 shadow-card backdrop-blur lg:p-8 dark:bg-white/5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Današnje akcije</p>
          <h3 className="text-display text-2xl font-semibold text-[var(--foreground)]">
            Zatvorite preostale korake i ostanite na putu
          </h3>
        </div>
        {tasks.length > 0 && (
          <span className="rounded-full bg-brand-50 px-4 py-1 text-xs font-semibold text-brand-600">
            {tasks.length} zadatak{tasks.length === 1 ? "" : "a"}
          </span>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 rounded-2xl border px-4 py-3",
                alert.type === "warning"
                  ? "border-warning-border bg-warning-bg/80 text-amber-800"
                  : "border-brand-200 bg-brand-50/70 text-brand-800"
              )}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs opacity-80">{alert.description}</p>
                {alert.action && (
                  <Link
                    href={alert.action.href}
                    className="text-xs font-semibold underline mt-1 inline-flex items-center gap-1"
                  >
                    {alert.action.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {stats.map((stat) => (
          <div
            key={stat.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-50 p-2 text-brand-600">{stat.icon}</div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{stat.label}</p>
                <p className="text-lg font-semibold text-[var(--foreground)]">{stat.value}</p>
                {stat.change && <p className="text-xs text-[var(--muted)]">{stat.change}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-sm font-semibold text-[var(--foreground)]">
          <p>Preostali koraci</p>
          <Link
            href="/settings"
            className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            Pogledaj sve <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sve obaveze su dovršene 🎉</p>
          ) : (
            tasks.slice(0, 3).map((task) => (
              <Link
                key={task.id}
                href={task.href}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-brand-200"
              >
                {task.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-success-500" />
                ) : (
                  <Circle className="h-4 w-4 text-[var(--muted)]" />
                )}
                <span>{task.label}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-[var(--muted)]" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
