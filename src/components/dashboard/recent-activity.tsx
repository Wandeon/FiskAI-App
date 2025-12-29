import Link from "next/link"
import { FileText, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageCard, PageCardHeader, PageCardTitle, PageCardContent } from "@/components/ui/page-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"

interface Invoice {
  id: string
  invoiceNumber: string | null
  totalAmount: number | { toString(): string }
  status: string
  createdAt: Date
  buyer?: { name: string } | null
}

interface RecentActivityProps {
  invoices: Invoice[]
  className?: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Nacrt", className: "bg-[var(--surface-secondary)] text-[var(--muted)]" },
  PENDING_FISCALIZATION: { label: "Fiskalizacija", className: "bg-warning-100 text-warning-700" },
  FISCALIZED: { label: "Fiskalizirano", className: "bg-brand-100 text-brand-700" },
  SENT: { label: "Poslano", className: "bg-purple-100 text-purple-700" },
  DELIVERED: { label: "Dostavljeno", className: "bg-success-100 text-success-700" },
  ACCEPTED: { label: "Prihvaćeno", className: "bg-success-100 text-success-700" },
  REJECTED: { label: "Odbijeno", className: "bg-danger-100 text-danger-700" },
  ERROR: { label: "Greška", className: "bg-danger-100 text-danger-700" },
}

export function RecentActivity({ invoices, className }: RecentActivityProps) {
  return (
    <PageCard className={className}>
      <PageCardHeader
        actions={
          <Link
            href="/e-invoices"
            className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
          >
            Vidi sve
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        <PageCardTitle>Nedavni e-računi</PageCardTitle>
      </PageCardHeader>
      <PageCardContent noPadding>
        {invoices.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="Nema e-računa"
            description="Kreirajte svoj prvi e-račun"
            action={
              <Link href="/e-invoices/new">
                <Button>Novi e-račun</Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {invoices.map((invoice) => {
              const status = statusConfig[invoice.status] || {
                label: invoice.status,
                className: "bg-surface-2",
              }
              const amount =
                typeof invoice.totalAmount === "number"
                  ? invoice.totalAmount
                  : Number(invoice.totalAmount.toString())

              return (
                <Link
                  key={invoice.id}
                  href={`/e-invoices/${invoice.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-[var(--surface-secondary)] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)]">
                      {invoice.invoiceNumber || "Bez broja"}
                    </p>
                    <p className="text-sm text-[var(--muted)] truncate">
                      {invoice.buyer?.name || "—"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="font-semibold text-[var(--foreground)]">
                      {amount.toLocaleString("hr-HR", { minimumFractionDigits: 2 })} €
                    </p>
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        status.className
                      )}
                    >
                      {status.label}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </PageCardContent>
    </PageCard>
  )
}
