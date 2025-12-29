import React from "react"
import { AlertTriangle, CheckCircle, Info } from "lucide-react"
import type { ConflictBlock } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

interface ConflictBannerProps {
  conflict: ConflictBlock | null | undefined
  className?: string
}

export function ConflictBanner({ conflict, className }: ConflictBannerProps) {
  if (!conflict) return null

  const isResolved = conflict.status === "RESOLVED"
  const isUnresolved = conflict.status === "UNRESOLVED"
  const isContextDependent = conflict.status === "CONTEXT_DEPENDENT"

  const Icon = isResolved ? CheckCircle : isUnresolved ? AlertTriangle : Info

  const styles = cn(
    "p-3 rounded-lg flex items-start gap-3 text-sm",
    isResolved && "bg-muted/50 text-muted-foreground",
    isUnresolved && "bg-warning-bg text-warning-text border border-warning-border",
    isContextDependent && "bg-info-bg text-info-text border border-info-border",
    className
  )

  return (
    <div role={isUnresolved ? "alert" : "status"} className={styles}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{conflict.description}</p>
        {isResolved && conflict.resolvedAt && (
          <p className="text-xs mt-1 opacity-75">
            Resolved on {new Date(conflict.resolvedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
