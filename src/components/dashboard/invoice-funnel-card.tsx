import { ArrowRight } from "lucide-react"

interface FunnelStage {
  label: string
  value: number
}

interface InvoiceFunnelCardProps {
  stages: FunnelStage[]
}

export function InvoiceFunnelCard({ stages }: InvoiceFunnelCardProps) {
  const total = stages.reduce((sum, stage) => sum + stage.value, 0)
  const accepted = stages[stages.length - 1]?.value ?? 0
  const conversionRate = total > 0 ? (accepted / total) * 100 : 0
  const maxValue = Math.max(...stages.map((stage) => stage.value), 0)

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Lijevak fakturiranja
          </p>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Od nacrta do prihvaćeno
          </h3>
          <p className="text-sm text-[var(--muted)]">
            Pratite gdje zaglave računi i koliko ih stiže do kupca.
          </p>
        </div>
        <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          {conversionRate.toFixed(0)}% prolaznost
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {stages.map((stage, index) => {
          const baseWidth = maxValue > 0 ? (stage.value / maxValue) * 100 : 0
          const width = stage.value === 0 ? 0 : Math.max(baseWidth, 6)
          return (
            <div key={stage.label} className="flex items-center gap-3">
              <div className="w-24 text-sm font-medium text-[var(--foreground)]">{stage.label}</div>
              <div className="flex-1 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-brand-500 via-chart-1 to-chart-2 transition-all"
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="flex items-center gap-1 text-sm font-semibold text-[var(--foreground)]">
                {stage.value}
                {index < stages.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-[var(--muted)]" />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3 text-sm">
        <span className="text-[var(--muted)]">Ukupno u toku</span>
        <div className="text-right">
          <p className="text-base font-semibold text-[var(--foreground)]">{total} računa</p>
          <p className="text-xs text-[var(--muted)]">Prihvaćeno: {accepted}</p>
        </div>
      </div>
    </div>
  )
}
