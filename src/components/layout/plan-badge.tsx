import { Shield, Percent, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Capabilities } from "@/lib/capabilities"
import { getStatusAriaLabel } from "@/lib/a11y"

interface PlanBadgeProps {
  capabilities: Capabilities
  className?: string
}

export function PlanBadge({ capabilities, className }: PlanBadgeProps) {
  const moduleCount = capabilities.entitlements.length
  const vatStatus = capabilities.isVatPayer ? "PDV obveznik" : "Nije PDV obveznik"
  const ariaLabel = getStatusAriaLabel(
    capabilities.legalForm,
    `${vatStatus}, ${moduleCount} aktivnih modula`,
    "hr"
  )

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]",
        className
      )}
      role="status"
      aria-label={ariaLabel}
    >
      <Shield className="h-4 w-4 text-brand-600" aria-hidden="true" />
      <span>{capabilities.legalForm}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
          capabilities.isVatPayer ? "bg-info-bg text-link" : "bg-surface-2 text-secondary"
        )}
        aria-hidden="true"
      >
        <Percent className="h-3 w-3" />
        {capabilities.isVatPayer ? "PDV" : "Bez PDV"}
      </span>
      <span className="inline-flex items-center gap-1 text-[var(--muted)]" aria-hidden="true">
        <Package className="h-3 w-3" />
        {moduleCount} modula
      </span>
    </div>
  )
}
