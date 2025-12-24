"use client"

import React from "react"
import type { Surface } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

type EmptyStateType = "answer" | "evidence" | "clientData"

interface EmptyStateProps {
  type: EmptyStateType
  surface: Surface
  className?: string
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

export function EmptyState({ type, surface, className }: EmptyStateProps) {
  const copy = COPY[type][surface]

  return (
    <div className={cn("p-6 border rounded-lg border-dashed", className)}>
      <h3 className="font-medium text-muted-foreground">{copy.title}</h3>
      <p className="text-sm text-muted-foreground/70 mt-1">{copy.subtitle}</p>
    </div>
  )
}
