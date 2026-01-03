/**
 * Empty Queue State
 *
 * Friendly empty state display when a queue has no items.
 * Shows icon, message, and optional CTA to create new items.
 *
 * @module components/capability
 * @since PHASE 4 - Visual Refinement
 */
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, FileText, Receipt, Building2 } from "lucide-react"
import Link from "next/link"

const QUEUE_CONFIG: Record<string, { icon: typeof FileText; message: string; cta?: { label: string; href: string } }> = {
  invoice: {
    icon: FileText,
    message: "Nema računa za obradu",
    cta: { label: "Kreiraj račun", href: "/invoices/new" },
  },
  expense: {
    icon: Receipt,
    message: "Nema troškova za obradu",
    cta: { label: "Dodaj trošak", href: "/expenses/new" },
  },
  bank: {
    icon: Building2,
    message: "Nema bankovnih transakcija za usklađivanje",
  },
  default: {
    icon: CheckCircle2,
    message: "Sve je obrađeno",
  },
}

interface EmptyQueueStateProps {
  type?: "invoice" | "expense" | "bank" | "default"
  className?: string
}

export function EmptyQueueState({ type = "default", className }: EmptyQueueStateProps) {
  const config = QUEUE_CONFIG[type] || QUEUE_CONFIG.default
  const Icon = config.icon

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-success/10 p-3 mb-4">
          <Icon className="h-6 w-6 text-success" />
        </div>
        <p className="text-muted-foreground">{config.message}</p>
        {config.cta && (
          <Link href={config.cta.href} className="mt-4">
            <Button variant="outline" size="sm">
              {config.cta.label}
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
