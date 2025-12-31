"use client"

import React from "react"
import type { Surface } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"
import type { AssistantVariant } from "./AssistantContainer"

type EmptyStateType = "answer" | "evidence" | "clientData"

interface EmptyStateProps {
  type: EmptyStateType
  surface: Surface
  className?: string
  variant?: AssistantVariant
}

const COPY: Record<EmptyStateType, Record<Surface, { title: string; subtitle: string }>> = {
  answer: {
    MARKETING: {
      title: "Verified answer will appear here",
      subtitle: "Every response includes verified citations from official sources",
    },
    APP: {
      title: "Verified answer will appear here",
      subtitle: "Answers can include calculations based on your connected data",
    },
  },
  evidence: {
    MARKETING: {
      title: "Sources",
      subtitle: "Official regulations, laws, and guidance",
    },
    APP: {
      title: "Sources",
      subtitle: "Official regulations and your business data",
    },
  },
  clientData: {
    MARKETING: {
      title: "Your data",
      subtitle: "Connect your data for personalized answers",
    },
    APP: {
      title: "Your data",
      subtitle: "Connected sources will be used for personalized answers",
    },
  },
}

export function EmptyState({ type, surface, className, variant = "light" }: EmptyStateProps) {
  const copy = COPY[type][surface]
  const isDark = variant === "dark"

  return (
    <div
      className={cn(
        "p-6 border rounded-lg border-dashed",
        isDark ? "bg-surface-elevated/20 border-subtle/50 backdrop-blur-sm" : "bg-background",
        className
      )}
    >
      <h3 className={cn("font-medium", isDark ? "text-muted" : "text-muted-foreground")}>
        {copy.title}
      </h3>
      <p className={cn("text-sm mt-1", isDark ? "text-tertiary" : "text-muted-foreground/70")}>
        {copy.subtitle}
      </p>
    </div>
  )
}
