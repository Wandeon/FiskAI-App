"use client"

import React from "react"
import { FileText, Building2, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

interface PersonalizationPanelProps {
  onConnect: () => void
  onDismiss: () => void
  className?: string
}

const DATA_SOURCES = [
  { icon: FileText, label: "Invoices", description: "Track revenue and VAT" },
  { icon: Building2, label: "Bank accounts", description: "Verify transactions" },
  { icon: CreditCard, label: "Expenses", description: "Calculate deductions" },
]

export function PersonalizationPanel({
  onConnect,
  onDismiss,
  className,
}: PersonalizationPanelProps) {
  return (
    <section aria-label="Personalization" className={cn("border rounded-lg", className)}>
      <header className="p-4 border-b">
        <h3 className="font-medium">Personalize this answer</h3>
      </header>

      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Connect your data to get calculations specific to your business.
        </p>

        {/* Data sources */}
        <ul className="space-y-3">
          {DATA_SOURCES.map(({ icon: Icon, label, description }) => (
            <li key={label} className="flex items-start gap-3">
              <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={onConnect}
            className={cn(
              "w-full text-sm px-4 py-2 rounded-md transition-colors",
              "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Connect your data
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="w-full text-sm px-4 py-2 text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </section>
  )
}
