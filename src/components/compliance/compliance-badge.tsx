"use client"

import { Shield, CheckCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { getStatusAriaLabel } from "@/lib/a11y"

interface ComplianceBadgeProps {
  variant?: "footer" | "inline" | "card"
  showDetails?: boolean
}

export function ComplianceBadge({ variant = "footer", showDetails = false }: ComplianceBadgeProps) {
  const statusLabel = getStatusAriaLabel(
    "Certificirano",
    "Usklađeno s hrvatskim zakonima o fiskalizaciji",
    "hr"
  )

  if (variant === "footer") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/compliance"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            aria-label={statusLabel}
          >
            <Shield className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
            <span>Fiskalizacija 2.0 Certificirano</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent role="tooltip">
          <p>Usklađeno s hrvatskim zakonima o fiskalizaciji</p>
          <p className="text-xs text-muted-foreground">Kliknite za više detalja</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  if (variant === "card") {
    return (
      <div
        className="flex items-center gap-2 p-3 border rounded-lg bg-green-50 border-green-200"
        role="status"
        aria-label={statusLabel}
      >
        <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-green-900">Fiskalizacija 2.0 Certificirano</p>
          <p className="text-xs text-green-700">Usklađeno s Poreznom upravom</p>
        </div>
      </div>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      role="status"
      aria-label="Fiskalizacija certificirano"
    >
      <Shield className="h-3 w-3 text-green-600" aria-hidden="true" />
      <span>Certificirano</span>
    </span>
  )
}
