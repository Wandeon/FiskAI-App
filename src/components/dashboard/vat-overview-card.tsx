import { BadgePercent, ShieldAlert, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface VatOverviewCardProps {
  paidVat: number
  pendingVat: number
  isVatPayer: boolean
}

const formatCurrency = (value: number) =>
  `${value.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export function VatOverviewCard({ paidVat, pendingVat, isVatPayer }: VatOverviewCardProps) {
  const total = paidVat + pendingVat
  const paidPercent = total > 0 ? Math.min((paidVat / total) * 100, 100) : 0
  const pendingPercent = total > 0 ? Math.min((pendingVat / total) * 100, 100) : 0

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">PDV pregled</p>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Obveze i plaćanja</h3>
          <p className="text-sm text-[var(--muted)]">
            Sažetak izračunat iz statusa e-računa (fiskalizirani, poslani, prihvaćeni).
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
            isVatPayer ? "bg-success-bg text-success-text" : "bg-warning-bg text-warning-text"
          )}
        >
          <BadgePercent className="h-4 w-4" />
          {isVatPayer ? "PDV obveznik" : "Niste PDV obveznik"}
        </span>
      </div>

      {!isVatPayer && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning-text">
          <ShieldAlert className="h-4 w-4" />
          <span>Provjerite jeste li pravilno označili PDV status i datume obveza.</span>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">PDV plaćen</p>
          <p className="text-2xl font-semibold text-[var(--foreground)]">
            {formatCurrency(paidVat)}
          </p>
          <p className="text-xs font-medium text-success-text">
            {paidPercent.toFixed(0)}% od ukupnog
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">PDV u tijeku</p>
          <p className="text-2xl font-semibold text-[var(--foreground)]">
            {formatCurrency(pendingVat)}
          </p>
          <p className="text-xs font-medium text-warning-text">
            {pendingPercent.toFixed(0)}% od ukupnog
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <span>Napredak uplata</span>
          <span className="font-semibold text-[var(--foreground)]">{formatCurrency(total)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
          <div
            className="h-full bg-gradient-to-r from-success via-brand-500 to-chart-1 transition-all"
            style={{ width: `${paidPercent}%` }}
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
          <ShieldCheck className="h-4 w-4 text-success-text" />
          <span>
            Plaćeno uključuje fiskalizirane/prihvaćene; u tijeku su poslani ili na fiskalizaciji.
          </span>
        </div>
      </div>
    </div>
  )
}
