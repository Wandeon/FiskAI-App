import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, FileText, Clock, X, ClipboardList } from "lucide-react"

/**
 * Format a date in Croatian format: DD.MM.YYYY
 */
function formatDateCroatian(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

/**
 * Format datetime in Croatian format: DD.MM. HH:mm (short) or DD.MM.YYYY HH:mm (full)
 */
function formatDateTimeCroatian(date: Date, short = false): string {
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  if (short) {
    return `${day}.${month}. ${hours}:${minutes}`
  }
  return `${day}.${month}.${year} ${hours}:${minutes}`
}

/**
 * Format amount in Croatian/Euro format: €1.200,00
 */
function formatAmountCroatian(cents: number): string {
  const euros = cents / 100
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros)
}

/**
 * Match method type - how the payment was matched to invoice
 */
export type MatchMethod = "auto_reference" | "auto_amount" | "auto_client" | "manual"

/**
 * Get method display text in Croatian
 */
function getMethodDisplayText(method: MatchMethod): string {
  switch (method) {
    case "auto_reference":
      return "Automatski (referenca u opisu)"
    case "auto_amount":
      return "Automatski (iznos)"
    case "auto_client":
      return "Automatski (klijent)"
    case "manual":
      return "Ručno"
    default:
      return "Nepoznato"
  }
}

/**
 * Get confidence level display in Croatian
 */
function getConfidenceDisplay(confidence: number): {
  text: string
  variant: "success" | "warning" | "danger"
} {
  if (confidence >= 0.9) {
    return { text: "VISOKA", variant: "success" }
  } else if (confidence >= 0.7) {
    return { text: "SREDNJA", variant: "warning" }
  } else {
    return { text: "NISKA", variant: "danger" }
  }
}

/**
 * Audit trail entry
 */
export interface AuditTrailEntry {
  date: Date
  action: string
  actor: string
}

/**
 * Payment match information
 */
export interface PaymentMatchInfo {
  paymentAmount: number
  paymentDate: Date
  paymentDescription: string
  method: MatchMethod
  confidence: number // 0-1
  reason: string
  matchedAt: Date
  matchedBy: string // 'system' or user name
}

export interface PaymentMatchDisplayProps {
  /** Invoice number (e.g., "002") */
  invoiceNumber: string
  /** Client/company name */
  clientName: string
  /** Invoice amount in cents */
  invoiceAmount: number
  /** Invoice date */
  invoiceDate: Date
  /** Payment match information (if paid) */
  matchInfo?: PaymentMatchInfo
  /** Audit trail history */
  auditTrail: AuditTrailEntry[]
  /** Callback when user wants to unlink the payment */
  onUnlink?: () => void
  /** Additional CSS classes */
  className?: string
}

/**
 * PaymentMatchDisplay: Shows payment matching information for an invoice.
 *
 * Displays:
 * - Invoice header with client name, number, date, and amount
 * - Payment status badge (PLAĆENO or PLAĆENO (ručno označeno))
 * - Payment details (amount, date, description)
 * - Match method and confidence with reason
 * - Audit trail history
 * - Unlink action button
 *
 * @example
 * ```tsx
 * <PaymentMatchDisplay
 *   invoiceNumber="002"
 *   clientName="Beta j.d.o.o."
 *   invoiceAmount={120000} // cents
 *   invoiceDate={new Date('2025-01-18')}
 *   matchInfo={{
 *     paymentAmount: 120000,
 *     paymentDate: new Date('2025-01-22'),
 *     paymentDescription: "Račun 002-2025 Beta",
 *     method: 'auto_reference',
 *     confidence: 0.98,
 *     reason: 'Broj računa "002-2025" u opisu uplate',
 *     matchedAt: new Date('2025-01-22T14:32:00'),
 *     matchedBy: 'system'
 *   }}
 *   auditTrail={[
 *     { date: new Date('2025-01-22T14:32:00'), action: 'Auto-linked', actor: 'system' }
 *   ]}
 *   onUnlink={() => console.log('Unlink clicked')}
 * />
 * ```
 */
export function PaymentMatchDisplay({
  invoiceNumber,
  clientName,
  invoiceAmount,
  invoiceDate,
  matchInfo,
  auditTrail,
  onUnlink,
  className,
}: PaymentMatchDisplayProps) {
  const isManuallyMarked = matchInfo?.method === "manual"
  const confidenceDisplay = matchInfo ? getConfidenceDisplay(matchInfo.confidence) : null
  const confidencePercent = matchInfo ? Math.round(matchInfo.confidence * 100) : 0

  return (
    <Card variant="default" padding="none" className={cn("overflow-hidden", className)}>
      {/* Invoice Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-secondary mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-body-base font-medium text-foreground">{clientName}</p>
              <p className="text-body-sm text-secondary">
                Račun #{invoiceNumber} &bull; {formatDateCroatian(invoiceDate)}
              </p>
            </div>
          </div>
          <p className="text-heading-md font-semibold text-foreground">
            {formatAmountCroatian(invoiceAmount)}
          </p>
        </div>
      </div>

      {/* Payment Status Section */}
      {matchInfo && (
        <div className="m-4 rounded-lg border border-success-border bg-success-bg p-4">
          {/* Status Header */}
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success-icon shrink-0" aria-hidden="true" />
            <Badge variant="success" size="lg">
              {isManuallyMarked ? "PLAĆENO (ručno označeno)" : "PLAĆENO"}
            </Badge>
          </div>

          {/* Divider */}
          <div className="my-3 h-px bg-success-border" />

          {/* Payment Details */}
          <div className="space-y-1.5 text-body-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-secondary min-w-[60px]">Uplata:</span>
              <span className="text-foreground font-medium">
                {formatAmountCroatian(matchInfo.paymentAmount)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-secondary min-w-[60px]">Datum:</span>
              <span className="text-foreground">{formatDateCroatian(matchInfo.paymentDate)}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-secondary min-w-[60px]">Opis:</span>
              <span className="text-foreground">&ldquo;{matchInfo.paymentDescription}&rdquo;</span>
            </div>
          </div>

          {/* Divider */}
          <div className="my-3 h-px bg-success-border" />

          {/* Match Information */}
          <div className="space-y-1.5 text-body-sm">
            <p className="text-secondary font-medium">Povezivanje:</p>
            <ul className="space-y-1 pl-4">
              <li className="flex items-baseline gap-2">
                <span className="text-secondary">&bull;</span>
                <span className="text-secondary">Metoda:</span>
                <span className="text-foreground">{getMethodDisplayText(matchInfo.method)}</span>
              </li>
              {!isManuallyMarked && confidenceDisplay && (
                <li className="flex items-baseline gap-2">
                  <span className="text-secondary">&bull;</span>
                  <span className="text-secondary">Pouzdanost:</span>
                  <Badge variant={confidenceDisplay.variant} size="sm">
                    {confidenceDisplay.text} ({confidencePercent}%)
                  </Badge>
                </li>
              )}
              <li className="flex items-baseline gap-2">
                <span className="text-secondary">&bull;</span>
                <span className="text-secondary">Razlog:</span>
                <span className="text-foreground">{matchInfo.reason}</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-secondary">&bull;</span>
                <span className="text-secondary">Povezano:</span>
                <span className="text-foreground">
                  {formatDateTimeCroatian(matchInfo.matchedAt)}
                </span>
              </li>
            </ul>
          </div>

          {/* Unlink Button */}
          {onUnlink && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={onUnlink}>
                <X className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Poništi povezivanje
              </Button>
            </div>
          )}

          {/* Audit Trail */}
          {auditTrail.length > 0 && (
            <>
              <div className="my-3 h-px bg-success-border" />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-body-sm text-secondary">
                  <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="font-medium">Povijest promjena</span>
                </div>
                <ul className="space-y-1 pl-6 text-body-sm">
                  {auditTrail.map((entry, index) => (
                    <li key={index} className="flex items-baseline gap-1">
                      <Clock
                        className="h-3 w-3 text-secondary shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-secondary">
                        {formatDateTimeCroatian(entry.date, true)} - {entry.action} ({entry.actor})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {/* No Payment Info State */}
      {!matchInfo && (
        <div className="px-6 py-4 text-center">
          <p className="text-body-sm text-secondary">
            Račun još nije plaćen ili uplata nije povezana.
          </p>
        </div>
      )}
    </Card>
  )
}
