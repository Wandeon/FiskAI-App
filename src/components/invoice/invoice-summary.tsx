'use client'

import { cn } from "@/lib/utils"
import { FileText, User, Calendar } from "lucide-react"

interface InvoiceSummaryProps {
  buyer?: { name: string; oib: string | null } | null
  invoiceNumber?: string
  issueDate?: Date
  lines: Array<{
    description: string
    quantity: number
    unitPrice: number
    vatRate?: number
  }>
  currency?: string
  className?: string
}

export function InvoiceSummary({
  buyer,
  invoiceNumber,
  issueDate,
  lines,
  currency = "EUR",
  className,
}: InvoiceSummaryProps) {
  const totals = lines.reduce(
    (acc, line) => {
      const net = (line.quantity || 0) * (line.unitPrice || 0)
      const vat = net * ((line.vatRate || 0) / 100)
      return {
        net: acc.net + net,
        vat: acc.vat + vat,
        total: acc.total + net + vat,
      }
    },
    { net: 0, vat: 0, total: 0 }
  )

  const currencySymbol = currency === "EUR" ? "€" : currency

  return (
    <div className={cn("card sticky top-20", className)}>
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h3 className="font-semibold text-[var(--foreground)]">Pregled računa</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Buyer Info */}
        <div className="flex items-start gap-3">
          <User className="h-4 w-4 text-[var(--muted)] mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--muted)]">Kupac</p>
            <p className="text-sm font-medium text-[var(--foreground)] truncate">
              {buyer?.name || "Nije odabran"}
            </p>
            {buyer?.oib && (
              <p className="text-xs text-[var(--muted)]">OIB: {buyer.oib}</p>
            )}
          </div>
        </div>

        {/* Invoice Number */}
        <div className="flex items-start gap-3">
          <FileText className="h-4 w-4 text-[var(--muted)] mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--muted)]">Broj računa</p>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {invoiceNumber || "Automatski"}
            </p>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-start gap-3">
          <Calendar className="h-4 w-4 text-[var(--muted)] mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--muted)]">Datum izdavanja</p>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {issueDate ? new Date(issueDate).toLocaleDateString("hr-HR") : "Danas"}
            </p>
          </div>
        </div>

        {/* Line Items Summary */}
        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--muted)] mb-2">
            {lines.length} {lines.length === 1 ? 'stavka' : lines.length < 5 ? 'stavke' : 'stavki'}
          </p>
          <div className="space-y-1.5 text-sm">
            {lines.slice(0, 3).map((line, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="truncate text-[var(--muted)]">{line.description || "Stavka"}</span>
                <span className="flex-shrink-0 font-medium">
                  {((line.quantity || 0) * (line.unitPrice || 0)).toLocaleString('hr-HR', { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
              </div>
            ))}
            {lines.length > 3 && (
              <p className="text-xs text-[var(--muted)]">
                +{lines.length - 3} više...
              </p>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t border-[var(--border)] pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Neto</span>
            <span className="font-medium">{totals.net.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} {currencySymbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">PDV</span>
            <span className="font-medium">{totals.vat.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} {currencySymbol}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-[var(--border)]">
            <span>Ukupno</span>
            <span className="text-brand-600">{totals.total.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} {currencySymbol}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
