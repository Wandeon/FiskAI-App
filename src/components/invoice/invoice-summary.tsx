"use client"

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

  // Consistent currency formatting with tabular figures
  const formatCurrency = (amount: number) =>
    amount.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-subtle shadow-sm sticky top-20",
        className
      )}
    >
      <div className="border-b border-default px-4 py-3">
        <h3 className="font-semibold text-foreground">Pregled računa</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Buyer Info */}
        <div className="flex items-start gap-3">
          <User className="h-4 w-4 text-muted mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-tertiary">Kupac</p>
            <p className="text-sm font-medium text-foreground truncate">
              {buyer?.name || "Nije odabran"}
            </p>
            {buyer?.oib && <p className="text-xs text-tertiary">OIB: {buyer.oib}</p>}
          </div>
        </div>

        {/* Invoice Number */}
        <div className="flex items-start gap-3">
          <FileText className="h-4 w-4 text-muted mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-tertiary">Broj računa</p>
            <p className="text-sm font-medium text-foreground">{invoiceNumber || "Automatski"}</p>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-start gap-3">
          <Calendar className="h-4 w-4 text-muted mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-tertiary">Datum izdavanja</p>
            <p className="text-sm font-medium text-foreground">
              {issueDate ? new Date(issueDate).toLocaleDateString("hr-HR") : "Danas"}
            </p>
          </div>
        </div>

        {/* Line Items Summary */}
        <div className="border-t border-default pt-4">
          <p className="text-xs text-tertiary mb-2">
            {lines.length} {lines.length === 1 ? "stavka" : lines.length < 5 ? "stavke" : "stavki"}
          </p>
          <div className="space-y-2 text-sm text-secondary">
            {lines.slice(0, 3).map((line, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="truncate flex-1 min-w-0">{line.description || "Stavka"}</span>
                {/* tabular-nums ensures digits line up perfectly */}
                <span
                  className="font-medium text-foreground tabular-nums flex-shrink-0"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatCurrency((line.quantity || 0) * (line.unitPrice || 0))} {currencySymbol}
                </span>
              </div>
            ))}
            {lines.length > 3 && (
              <p className="text-xs text-muted">+{lines.length - 3} više...</p>
            )}
          </div>
        </div>

        {/* Divider Line - more visible */}
        <div className="border-t border-default" />

        {/* Totals Block */}
        <div className="space-y-2 text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
          <div className="flex justify-between text-secondary">
            <span>Neto</span>
            <span className="tabular-nums">
              {formatCurrency(totals.net)} {currencySymbol}
            </span>
          </div>
          <div className="flex justify-between text-secondary">
            <span>PDV</span>
            <span className="tabular-nums">
              {formatCurrency(totals.vat)} {currencySymbol}
            </span>
          </div>

          <div className="flex justify-between items-center text-lg font-bold text-foreground pt-2 border-t border-default">
            <span>Ukupno</span>
            <span className="text-link tabular-nums">
              {formatCurrency(totals.total)} {currencySymbol}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
