import Link from "next/link"
import { Settings, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageCard, PageCardHeader, PageCardTitle, PageCardContent } from "@/components/ui/page-card"

interface FiscalizationStatusProps {
  isVatPayer: boolean
  eInvoiceProvider: string | null
  oib: string
  vatNumber?: string | null
  className?: string
}

export function FiscalizationStatus({
  isVatPayer,
  eInvoiceProvider,
  oib,
  vatNumber,
  className,
}: FiscalizationStatusProps) {
  const StatusIcon = eInvoiceProvider ? CheckCircle2 : XCircle
  const statusColor = eInvoiceProvider ? "text-success-500" : "text-danger-500"

  return (
    <PageCard className={className}>
      <PageCardHeader
        actions={
          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <Settings className="h-4 w-4" />
            Postavke
          </Link>
        }
      >
        <PageCardTitle>Fiskalizacija 2.0</PageCardTitle>
      </PageCardHeader>
      <PageCardContent>
        <div className="space-y-4">
          {/* Provider Status */}
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-4">
            <StatusIcon className={cn("h-6 w-6", statusColor)} />
            <div className="flex-1">
              <p className="font-medium text-[var(--foreground)]">Posrednik</p>
              <p className={cn("text-sm", eInvoiceProvider ? "text-success-600" : "text-danger-600")}>
                {eInvoiceProvider || "Nije konfiguriran"}
              </p>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-[var(--surface-secondary)] p-3">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">OIB</p>
              <p className="mt-1 font-mono text-sm text-[var(--foreground)]">{oib}</p>
            </div>
            <div className="rounded-lg bg-[var(--surface-secondary)] p-3">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">PDV obveznik</p>
              <p className={cn("mt-1 text-sm font-medium", isVatPayer ? "text-success-600" : "text-[var(--muted)]")}>
                {isVatPayer ? "Da" : "Ne"}
              </p>
            </div>
            {vatNumber && (
              <div className="rounded-lg bg-[var(--surface-secondary)] p-3 sm:col-span-2">
                <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">PDV broj</p>
                <p className="mt-1 font-mono text-sm text-[var(--foreground)]">{vatNumber}</p>
              </div>
            )}
          </div>
        </div>
      </PageCardContent>
    </PageCard>
  )
}
