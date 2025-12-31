"use client"

import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { X, ArrowRight, AlertTriangle, CheckCircle, Info } from "lucide-react"
import Link from "next/link"
import type { ContextualTrigger } from "@/lib/tutorials/triggers"

interface ContextualHelpBannerProps {
  triggers: ContextualTrigger[]
  onDismiss?: (triggerId: string) => void
}

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
}

const VARIANTS = {
  success: "border-success-border bg-success-bg text-success-text",
  warning: "border-warning-border bg-warning-bg text-warning-text",
  info: "border-info-border bg-info-bg text-info-text",
}

export function ContextualHelpBanner({ triggers, onDismiss }: ContextualHelpBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visibleTriggers = triggers.filter((t) => !dismissed.has(t.id))

  if (visibleTriggers.length === 0) return null

  const handleDismiss = (triggerId: string) => {
    setDismissed((prev) => new Set([...prev, triggerId]))
    onDismiss?.(triggerId)
  }

  return (
    <div className="space-y-2">
      {visibleTriggers.map((trigger) => {
        const Icon = ICONS[trigger.type]
        return (
          <Alert key={trigger.id} className={VARIANTS[trigger.type]}>
            <Icon className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between">
              {trigger.title}
              {trigger.dismissible && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleDismiss(trigger.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </AlertTitle>
            <AlertDescription>
              <div className="flex items-center justify-between gap-4">
                <span>{trigger.description}</span>
                {trigger.href && (
                  <Link href={trigger.href}>
                    <Button variant="ghost" size="sm" className="gap-1">
                      Saznaj više
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )
      })}
    </div>
  )
}
