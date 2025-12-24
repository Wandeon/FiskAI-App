"use client"

import React from "react"
import { X, Calculator, Link2 } from "lucide-react"
import type { Topic } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface CTABlockProps {
  variant: "contextual" | "personalization"
  topic: Topic
  onAction: () => void
  onDismiss: () => void
  className?: string
}

const CONTEXTUAL_COPY = {
  headline: "Calculate this for your business",
  description: "Connect your invoices to see your exact threshold status and remaining amount.",
  action: "Start free",
  trustLink: "See how sources are verified",
  trustHref: "/izvori",
}

const PERSONALIZATION_COPY = {
  headline: "Personalize this answer",
  description: "Connect your business data to get calculations specific to your situation.",
  action: "Connect your data",
  trustLink: "How calculations work",
  trustHref: "/methodology",
}

export function CTABlock({ variant, topic, onAction, onDismiss, className }: CTABlockProps) {
  const copy = variant === "contextual" ? CONTEXTUAL_COPY : PERSONALIZATION_COPY
  const Icon = variant === "contextual" ? Calculator : Link2

  return (
    <div className={cn("relative p-4 rounded-lg bg-muted/50 border", className)}>
      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Content */}
      <div className="flex items-start gap-3 pr-6">
        <Icon className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1">
          <h4 className="font-medium">{copy.headline}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>

          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              onClick={onAction}
              className={cn(
                "text-sm px-4 py-2 rounded-md transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {copy.action}
            </button>

            <a
              href={copy.trustHref}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              {copy.trustLink}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
